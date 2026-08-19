import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import argon2 from "@node-rs/argon2";
import { db } from "../db/index.js";
import { users, profiles } from "../db/schema.js";
import { signSession } from "../lib/session.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (request, reply) => {
    const { email, password, username, role } = request.body as {
      email: string;
      password: string;
      username?: string;
      role?: string;
    };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: "Password must be at least 6 characters" });
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const passwordHash = await argon2.hash(password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, username, role: role || "patient" })
      .returning();

    await db.insert(profiles).values({
      id: user.id,
      username: username || null,
      role: role || "patient",
    });

    const session = signSession({ userId: user.id });
    reply.setCookie("medisync-session", session, {
      path: "/",
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return reply.status(201).send({
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
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

  app.post("/api/auth/logout", async (_request, reply) => {
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
