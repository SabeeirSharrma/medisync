import type { FastifyInstance } from "fastify";
import { eq, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { emergencyAccess, users } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

export async function emergencyAccessRoutes(app: FastifyInstance) {
  app.get("/api/emergency-access", { preHandler: [requireAuth] }, async (request, reply) => {
    const uid = request.userId!;
    const data = await db
      .select()
      .from(emergencyAccess)
      .where(or(eq(emergencyAccess.doctorId, uid), eq(emergencyAccess.patientId, uid)));
    return reply.send({ emergencyAccess: data });
  });

  app.post("/api/emergency-access", { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const patientEmail = body.patient_email as string;
    const [patient] = await db.select().from(users).where(eq(users.email, patientEmail)).limit(1);
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    const expiresAt = body.expires_at
      ? new Date(body.expires_at as string)
      : new Date(Date.now() + 48 * 60 * 60 * 1000);

    const [ea] = await db
      .insert(emergencyAccess)
      .values({
        doctorId: request.userId!,
        patientId: patient.id,
        reasonCode: body.reason_code as string,
        reasonText: body.reason_text as string,
        expiresAt,
      })
      .returning();
    return reply.status(201).send({ emergencyAccess: ea });
  });

  app.patch("/api/emergency-access/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const uid = request.userId!;

    if (status !== "revoked" && status !== "active") {
      return reply.status(400).send({ error: "Invalid status" });
    }

    const [existing] = await db.select().from(emergencyAccess).where(eq(emergencyAccess.id, id)).limit(1);
    if (!existing) return reply.status(404).send({ error: "Emergency access not found" });

    // Both the patient and the doctor who created it can revoke
    if (existing.doctorId !== uid && existing.patientId !== uid) {
      return reply.status(403).send({ error: "Access denied" });
    }

    const [updated] = await db
      .update(emergencyAccess)
      .set({ status })
      .where(eq(emergencyAccess.id, id))
      .returning();
    return reply.send({ emergencyAccess: updated });
  });
}
