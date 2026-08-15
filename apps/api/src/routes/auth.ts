import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { users, sessions, doctorProfile } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateToken, hashToken, hashPassword, verifyPassword } from "../lib/auth.js";
import { registerSchema, loginSchema } from "../lib/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export default async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post("/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const { name, email, password, role, dob, phone } = parsed.data;

    // Check if email already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    const passwordHashVal = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash: passwordHashVal, role, dob: dob ?? null, phone: phone ?? null })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        dob: users.dob,
      });

    // Create session
    const token = generateToken();
    const tokenHashVal = hashToken(token);
    const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE * 1000);

    await db.insert(sessions).values({
      userId: user.id,
      tokenHash: tokenHashVal,
      expiresAt,
    });

    reply.setCookie("session", token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    return reply.code(201).send({ user });
  });

  // POST /api/auth/login
  app.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const { email, password } = parsed.data;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    // Create session
    const token = generateToken();
    const tokenHashVal = hashToken(token);
    const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE * 1000);

    await db.insert(sessions).values({
      userId: user.id,
      tokenHash: tokenHashVal,
      expiresAt,
    });

    reply.setCookie("session", token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    return reply.send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        dob: user.dob,
      },
    });
  });

  // POST /api/auth/logout
  app.post("/logout", { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies?.session;
    if (token) {
      const tokenHashVal = hashToken(token);
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHashVal));
    }

    reply.clearCookie("session", { path: "/" });
    return reply.send({ message: "Logged out" });
  });

  // GET /api/auth/me
  app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    let profile: (typeof doctorProfile.$inferSelect) | null = null;

    if (request.user?.role === "doctor") {
      const [p] = await db
        .select()
        .from(doctorProfile)
        .where(eq(doctorProfile.userId, request.user.id))
        .limit(1);
      profile = p ?? null;
    }

    return reply.send({
      user: request.user,
      doctorProfile: profile,
    });
  });
}
