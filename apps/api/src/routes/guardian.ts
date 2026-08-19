import type { FastifyInstance } from "fastify";
import { eq, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { guardianLinks, users } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

export async function guardianRoutes(app: FastifyInstance) {
  app.get("/api/guardian-links", { preHandler: [requireAuth] }, async (request, reply) => {
    const uid = request.userId!;
    const data = await db
      .select({
        id: guardianLinks.id,
        patientId: guardianLinks.patientId,
        guardianId: guardianLinks.guardianId,
        triggerType: guardianLinks.triggerType,
        status: guardianLinks.status,
        authorityDocumentRef: guardianLinks.authorityDocumentRef,
        createdAt: guardianLinks.createdAt,
        updatedAt: guardianLinks.updatedAt,
        patientName: users.username,
        patientEmail: users.email,
      })
      .from(guardianLinks)
      .innerJoin(users, eq(guardianLinks.patientId, users.id))
      .where(or(eq(guardianLinks.patientId, uid), eq(guardianLinks.guardianId, uid)));

    const guardianIds = [...new Set(data.map((r) => r.guardianId))];
    const guardianUsers = guardianIds.length > 0
      ? await db.select({ id: users.id, username: users.username, email: users.email }).from(users).where(or(...guardianIds.map((id) => eq(users.id, id))))
      : [];
    const guardianMap = new Map(guardianUsers.map((g) => [g.id, g]));

    const merged = data.map((row) => {
      const guardian = guardianMap.get(row.guardianId);
      return {
        ...row,
        guardianName: guardian?.username || null,
        guardianEmail: guardian?.email || null,
      };
    });

    return reply.send({ guardianLinks: merged });
  });

  app.post("/api/guardian-links", { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const guardianEmail = body.guardian_email as string;
    const [guardian] = await db.select().from(users).where(eq(users.email, guardianEmail)).limit(1);
    if (!guardian) return reply.status(404).send({ error: "Guardian not found" });

    const [gl] = await db
      .insert(guardianLinks)
      .values({
        patientId: request.userId!,
        guardianId: guardian.id,
        triggerType: body.trigger_type as string,
        status: "pending_guardian",
        authorityDocumentRef: body.authority_document_ref as string || null,
      })
      .returning();
    return reply.status(201).send({ guardianLink: gl });
  });

  app.patch("/api/guardian-links/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const uid = request.userId!;

    const [existing] = await db.select().from(guardianLinks).where(eq(guardianLinks.id, id)).limit(1);
    if (!existing) return reply.status(404).send({ error: "Guardian link not found" });

    // Only the patient or guardian involved in the link can update it
    if (existing.patientId !== uid && existing.guardianId !== uid) {
      return reply.status(403).send({ error: "Access denied" });
    }

    const [updated] = await db
      .update(guardianLinks)
      .set({ status, updatedAt: new Date() })
      .where(eq(guardianLinks.id, id))
      .returning();
    return reply.send({ guardianLink: updated });
  });
}
