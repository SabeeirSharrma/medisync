import type { FastifyRequest, FastifyReply } from "fastify";
import { verifySession, isTokenRevoked } from "../lib/session.js";

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

  // Check if the token has been revoked (server-side session invalidation)
  if (await isTokenRevoked(sessionCookie)) {
    return reply.status(401).send({ error: "Session expired" });
  }

  request.userId = payload.userId;
}
