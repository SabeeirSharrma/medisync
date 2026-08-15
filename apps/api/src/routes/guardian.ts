import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { guardianLink, users } from "../db/schema.js";
import { eq, and, or, count, gte, lte, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { z } from "zod/v4";

const createGuardianLinkSchema = z.object({
  patientEmail: z.email("Invalid patient email"),
  guardianEmail: z.email("Invalid guardian email"),
  triggerType: z.enum(["minor", "advance_directive", "emergency_incapacity"]),
  authorityDocumentRef: z.string().optional(),
});

const updateGuardianStatusSchema = z.object({
  status: z.enum([
    "pending_guardian",
    "pending_senior",
    "active_shared_control",
    "sole_active",
    "denied",
    "revoked",
    "expired",
  ]),
});

export default async function guardianRoutes(app: FastifyInstance) {
  // POST /api/guardian-links — create guardian link
  app.post(
    "/guardian-links",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const parsed = createGuardianLinkSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const { patientEmail, guardianEmail, triggerType, authorityDocumentRef } = parsed.data;

      // Find patient
      const [patient] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, patientEmail), eq(users.role, "patient")))
        .limit(1);

      if (!patient) {
        return reply.code(404).send({ error: "Patient not found" });
      }

      // Find guardian
      const [guardian] = await db
        .select()
        .from(users)
        .where(eq(users.email, guardianEmail))
        .limit(1);

      if (!guardian) {
        return reply.code(404).send({ error: "Guardian not found" });
      }

      if (patient.id === guardian.id) {
        return reply.code(400).send({ error: "Patient and guardian cannot be the same person" });
      }

      // Check for existing link
      const [existing] = await db
        .select()
        .from(guardianLink)
        .where(
          and(
            eq(guardianLink.patientId, patient.id),
            eq(guardianLink.guardianId, guardian.id),
            or(
              eq(guardianLink.status, "pending_guardian"),
              eq(guardianLink.status, "pending_senior"),
              eq(guardianLink.status, "active_shared_control"),
              eq(guardianLink.status, "sole_active"),
            ),
          ),
        )
        .limit(1);

      if (existing) {
        return reply.code(409).send({ error: "Guardian link already exists" });
      }

      // For minors, auto-calculate age majority date (18 years from DOB)
      let ageMajorityDate: Date | null = null;
      if (triggerType === "minor" && patient.dob) {
        const dob = new Date(patient.dob);
        ageMajorityDate = new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate());
      }

      const [link] = await db
        .insert(guardianLink)
        .values({
          patientId: patient.id,
          guardianId: guardian.id,
          triggerType,
          status: triggerType === "minor" ? "active_shared_control" : "pending_guardian",
          authorityDocumentRef: authorityDocumentRef ?? null,
          ageMajorityDate,
          activatedAt: triggerType === "minor" ? new Date() : null,
        } as typeof guardianLink.$inferInsert)
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "guardian.grant",
        targetPatientId: patient.id,
        details: { guardianLinkId: link.id, guardianId: guardian.id, triggerType },
      });

      return reply.code(201).send({ guardianLink: link });
    },
  );

  // GET /api/guardian-links — list guardian links
  app.get("/guardian-links", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;

    let rows;
    if (user.role === "patient") {
      rows = await db
        .select({
          id: guardianLink.id,
          patientId: guardianLink.patientId,
          guardianId: guardianLink.guardianId,
          triggerType: guardianLink.triggerType,
          status: guardianLink.status,
          authorityDocumentRef: guardianLink.authorityDocumentRef,
          ageMajorityDate: guardianLink.ageMajorityDate,
          createdAt: guardianLink.createdAt,
          updatedAt: guardianLink.updatedAt,
          activatedAt: guardianLink.activatedAt,
          revokedAt: guardianLink.revokedAt,
          guardianName: users.name,
          guardianEmail: users.email,
        })
        .from(guardianLink)
        .innerJoin(users, eq(guardianLink.guardianId, users.id))
        .where(eq(guardianLink.patientId, user.id));
    } else {
      // For doctors/admins, show links where they are the guardian
      rows = await db
        .select({
          id: guardianLink.id,
          patientId: guardianLink.patientId,
          guardianId: guardianLink.guardianId,
          triggerType: guardianLink.triggerType,
          status: guardianLink.status,
          authorityDocumentRef: guardianLink.authorityDocumentRef,
          ageMajorityDate: guardianLink.ageMajorityDate,
          createdAt: guardianLink.createdAt,
          updatedAt: guardianLink.updatedAt,
          activatedAt: guardianLink.activatedAt,
          revokedAt: guardianLink.revokedAt,
          patientName: users.name,
          patientEmail: users.email,
        })
        .from(guardianLink)
        .innerJoin(users, eq(guardianLink.patientId, users.id))
        .where(eq(guardianLink.guardianId, user.id));
    }

    return reply.send({ guardianLinks: rows });
  });

  // PATCH /api/guardian-links/:id/status — update status (guardian/senior approval, revoke)
  app.patch(
    "/guardian-links/:id/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const parsed = updateGuardianStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const [existing] = await db
        .select()
        .from(guardianLink)
        .where(eq(guardianLink.id, id))
        .limit(1);

      if (!existing) {
        return reply.code(404).send({ error: "Guardian link not found" });
      }

      // Authorization: guardian can approve; patient can revoke; senior can approve
      const newStatus = parsed.data.status;
      const isGuardian = user.id === existing.guardianId;
      const isPatient = user.id === existing.patientId;
      const isAdmin = user.role === "admin";

      const allowedTransitions: Record<string, string[]> = {
        pending_guardian: ["pending_senior", "denied", "revoked"],
        pending_senior: ["active_shared_control", "denied", "revoked"],
        active_shared_control: ["sole_active", "revoked"],
        sole_active: ["revoked"],
      };

      // Guardian approval
      if (isGuardian && existing.status === "pending_guardian" && newStatus === "pending_senior") {
        // OK - guardian approves
      }
      // Senior approval (admin for solo practice)
      else if (isAdmin && existing.status === "pending_senior" && newStatus === "active_shared_control") {
        // OK - senior approves
      }
      // Patient revoke
      else if (isPatient && allowedTransitions[existing.status]?.includes(newStatus)) {
        // OK - patient can revoke/deny
      }
      // Admin can do anything
      else if (isAdmin) {
        // OK
      }
      else {
        return reply.code(403).send({ error: "Not authorized for this transition" });
      }

      const updateData: Record<string, any> = { status: newStatus, updatedAt: new Date() };
      if (newStatus === "active_shared_control" && !existing.activatedAt) {
        updateData.activatedAt = new Date();
      }
      if (newStatus === "revoked") {
        updateData.revokedAt = new Date();
      }

      const [updated] = await db
        .update(guardianLink)
        .set(updateData)
        .where(eq(guardianLink.id, id))
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: newStatus === "revoked" ? "guardian.revoke" : "guardian.grant",
        targetPatientId: existing.patientId,
        details: { guardianLinkId: id, guardianId: existing.guardianId, newStatus },
      });

      return reply.send({ guardianLink: updated });
    },
  );

  // GET /api/guardian-links/active/:patientId — check active guardian links for a patient
  app.get(
    "/guardian-links/active/:patientId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const { patientId } = request.params as { patientId: string };

      if (user.role === "patient" && user.id !== patientId) {
        return reply.code(403).send({ error: "Access denied" });
      }

      const activeLinks = await db
        .select({
          id: guardianLink.id,
          patientId: guardianLink.patientId,
          guardianId: guardianLink.guardianId,
          triggerType: guardianLink.triggerType,
          status: guardianLink.status,
          authorityDocumentRef: guardianLink.authorityDocumentRef,
          ageMajorityDate: guardianLink.ageMajorityDate,
          createdAt: guardianLink.createdAt,
          updatedAt: guardianLink.updatedAt,
          activatedAt: guardianLink.activatedAt,
          revokedAt: guardianLink.revokedAt,
          guardianName: users.name,
          guardianEmail: users.email,
        })
        .from(guardianLink)
        .innerJoin(users, eq(guardianLink.guardianId, users.id))
        .where(
          and(
            eq(guardianLink.patientId, patientId),
            or(
              eq(guardianLink.status, "active_shared_control"),
              eq(guardianLink.status, "sole_active"),
            ),
          ),
        );

      return reply.send({ guardianLinks: activeLinks });
    },
  );
}