import type { FastifyInstance } from "fastify";
import { eq, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { accessRequests, users } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

export async function accessRequestsRoutes(app: FastifyInstance) {
  app.get("/api/access-requests", { preHandler: [requireAuth] }, async (request, reply) => {
    const uid = request.userId!;
    const data = await db
      .select({
        id: accessRequests.id,
        doctorId: accessRequests.doctorId,
        patientId: accessRequests.patientId,
        scope: accessRequests.scope,
        status: accessRequests.status,
        createdAt: accessRequests.createdAt,
        updatedAt: accessRequests.updatedAt,
        doctorName: users.username,
        doctorEmail: users.email,
      })
      .from(accessRequests)
      .innerJoin(users, eq(accessRequests.doctorId, users.id))
      .where(or(eq(accessRequests.doctorId, uid), eq(accessRequests.patientId, uid)));

    const patientData = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, uid));

    const merged = data.map((row) => {
      const patient = patientData[0];
      return {
        ...row,
        patientName: patient?.username || null,
        patientEmail: patient?.email || null,
      };
    });

    return reply.send({ accessRequests: merged });
  });

  app.post("/api/access-requests", { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const patientEmail = body.patient_email as string;
    const [patient] = await db.select().from(users).where(eq(users.email, patientEmail)).limit(1);
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    const [ar] = await db
      .insert(accessRequests)
      .values({
        doctorId: request.userId!,
        patientId: patient.id,
        scope: body.scope || {},
        status: "pending",
      })
      .returning();
    return reply.status(201).send({ accessRequest: ar });
  });

  app.patch("/api/access-requests/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const uid = request.userId!;

    const [existing] = await db.select().from(accessRequests).where(eq(accessRequests.id, id)).limit(1);
    if (!existing) return reply.status(404).send({ error: "Access request not found" });

    // Only the patient can approve/deny, only the doctor who created it can revoke
    if (status === "approved" || status === "denied") {
      if (existing.patientId !== uid) {
        return reply.status(403).send({ error: "Only the patient can approve or deny access requests" });
      }
    } else if (status === "revoked") {
      if (existing.doctorId !== uid && existing.patientId !== uid) {
        return reply.status(403).send({ error: "Access denied" });
      }
    } else {
      return reply.status(400).send({ error: "Invalid status" });
    }

    const [updated] = await db
      .update(accessRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(accessRequests.id, id))
      .returning();
    return reply.send({ accessRequest: updated });
  });
}
