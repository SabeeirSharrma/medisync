import { db } from "../db/index.js";
import { sessions, users, doctorProfile } from "../db/schema.js";
import { eq, and, gt } from "drizzle-orm";
import { hashToken } from "../lib/auth.js";
import type { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      name: string;
      email: string;
      role: "patient" | "doctor" | "admin";
      dob: string | null;
      phone: string | null;
      orgId: string | null;
    };
    doctorProfile?: {
      department: string | null;
      role: "staff" | "head";
      reportsTo: string | null;
      verified: boolean;
      orgId: string | null;
    } | null;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies?.session;
  if (!token) {
    return reply.code(401).send({ error: "Not authenticated" });
  }

  const tokenHashVal = hashToken(token);
  const now = new Date();

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHashVal),
        gt(sessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!session) {
    reply.clearCookie("session", { path: "/" });
    return reply.code(401).send({ error: "Session expired" });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    reply.clearCookie("session", { path: "/" });
    return reply.code(401).send({ error: "User not found" });
  }

  request.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    dob: user.dob,
    phone: user.phone,
    orgId: user.orgId,
  };

  // Attach doctor profile if user is a doctor
  if (user.role === "doctor") {
    const [profile] = await db
      .select()
      .from(doctorProfile)
      .where(eq(doctorProfile.userId, user.id))
      .limit(1);
    request.doctorProfile = profile ?? null;
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Not authenticated" });
    }
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ error: "Insufficient permissions" });
    }
  };
}
