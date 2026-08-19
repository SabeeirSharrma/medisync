import type { FastifyRequest, FastifyReply } from "fastify";
import { verifySession } from "../lib/session.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const sessionCookie = request.cookies?.["medisync-session"];
  if (!sessionCookie) {
    return reply.status(401).send({ error: "Not authenticated" });
  }

  const payload = verifySession(sessionCookie) as { userId?: string } | null;
  if (!payload?.userId) {
    return reply.status(401).send({ error: "Invalid session" });
  }

  request.userId = payload.userId;
}
