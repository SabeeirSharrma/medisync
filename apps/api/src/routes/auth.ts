import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import argon2 from "@node-rs/argon2";
import { Resend } from "resend";
import { db } from "../db/index.js";
import { users, profiles, verificationTokens } from "../db/schema.js";
import { signSession, revokeToken } from "../lib/session.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

/** Allowed role values — anything else is rejected. */
const VALID_ROLES = ["patient", "doctor", "admin"] as const;

/**
 * Map Postgres unique-violation (23505) to per-field 409 messages.
 * Handles the race-condition fallback when two concurrent requests
 * pass the app-level check but collide on the DB constraint.
 */
function mapPgUniqueViolation(err: unknown): { status: number; body: Record<string, string> } | null {
  const pgErr = err as { code?: string; constraint?: string; detail?: string };
  if (pgErr.code !== "23505") return null;

  const constraint = pgErr.constraint ?? "";
  if (constraint === "users_email_unique") {
    return { status: 409, body: { error: "Email already registered", field: "email" } };
  }
  if (constraint === "users_username_unique") {
    return { status: 409, body: { error: "Username already taken", field: "username" } };
  }
  // Unknown unique constraint — generic message, no internals leaked.
  return { status: 409, body: { error: "A record with the same value already exists" } };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (request, reply) => {
    const { email, password, username, role } = request.body as {
      email: string;
      password: string;
      username?: string;
      role?: string;
    };

    // --- Input validation ---
    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    const emailNorm = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return reply.status(400).send({ error: "Invalid email format", field: "email" });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: "Password must be at least 6 characters" });
    }

    if (username !== undefined && username !== null && username.trim().length > 0) {
      const uname = username.trim();
      if (uname.length < 3 || uname.length > 30) {
        return reply.status(400).send({ error: "Username must be between 3 and 30 characters", field: "username" });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(uname)) {
        return reply.status(400).send({ error: "Username may only contain letters, numbers, and underscores", field: "username" });
      }
    }

    const effectiveRole = (role || "patient").toLowerCase();
    if (!(VALID_ROLES as readonly string[]).includes(effectiveRole)) {
      return reply.status(400).send({ error: "Invalid role", field: "role" });
    }

    // --- App-level pre-checks (per-field 409s) ---
    const existingEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, emailNorm)).limit(1);
    if (existingEmail.length > 0) {
      return reply.status(409).send({ error: "Email already registered", field: "email" });
    }

    const trimmedUsername = username?.trim() || null;
    if (trimmedUsername) {
      const existingUsername = await db.select({ id: users.id }).from(users).where(eq(users.username, trimmedUsername)).limit(1);
      if (existingUsername.length > 0) {
        return reply.status(409).send({ error: "Username already taken", field: "username" });
      }
    }

    // --- Insert with 23505 fallback ---
    let user;
    try {
      const passwordHash = await argon2.hash(password);
      const insertResult = await db
        .insert(users)
        .values({ email: emailNorm, passwordHash, username: trimmedUsername, role: effectiveRole })
        .returning();
      user = insertResult[0];
    } catch (err) {
      const mapped = mapPgUniqueViolation(err);
      if (mapped) {
        return reply.status(mapped.status).send(mapped.body);
      }
      throw err; // Re-throw unexpected errors
    }

    await db.insert(profiles).values({
      id: user.id,
      username: trimmedUsername,
      role: effectiveRole,
    });

    const session = signSession({ userId: user.id });
    reply.setCookie("medisync-session", session, {
      path: "/",
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Auto-send verification email if Resend is configured
    if (config.resendApiKey) {
      try {
        const raw = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(raw).digest("hex");
        const expiresAt = new Date(Date.now() + config.verificationTokenExpiryMinutes * 60 * 1000);

        await db.insert(verificationTokens).values({
          userId: user.id,
          tokenHash,
          type: "email_verify",
          expiresAt,
        });

        const resend = new Resend(config.resendApiKey);
        const verifyUrl = `${config.corsOrigin[0] || "http://localhost:3000"}/verify?token=${raw}`;

        await resend.emails.send({
          from: config.resendFromEmail,
          to: emailNorm,
          subject: "Verify your MediSync account",
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #3525cd; margin-bottom: 16px;">Verify your email</h2>
              <p style="color: #46445a; line-height: 1.6;">
                Thanks for signing up for MediSync Health. Please click the button below to verify your email address.
              </p>
              <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background: #3525cd; color: white; text-decoration: none; border-radius: 9999px; font-weight: 600; margin: 24px 0;">
                Verify Email
              </a>
              <p style="color: #77768a; font-size: 13px;">
                This link expires in ${config.verificationTokenExpiryMinutes} minutes. If you didn't create an account, you can safely ignore this email.
              </p>
            </div>
          `,
        });
        console.log(`Verification email sent to ${emailNorm}`);
      } catch (err) {
        console.error("Failed to send verification email:", err);
      }
    }

    return reply.status(201).send({
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    const emailNorm = email.trim().toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, emailNorm)).limit(1);
    if (!user) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const session = signSession({ userId: user.id });
    reply.setCookie("medisync-session", session, {
      path: "/",
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    return reply.send({
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    // Server-side session invalidation: revoke the current token
    const sessionCookie = request.cookies?.["medisync-session"];
    if (sessionCookie) {
      await revokeToken(sessionCookie);
    }
    reply.clearCookie("medisync-session", { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const [user] = await db.select().from(users).where(eq(users.id, request.userId!)).limit(1);
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

    return reply.send({
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      profile: profile || null,
    });
  });
}
