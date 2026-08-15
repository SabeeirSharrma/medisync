import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { emergencyAccess, users, accessRequests } from "../db/schema.js";
import { eq, and, gte, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { z } from "zod/v4";

const createEmergencyAccessSchema = z.object({
  patientEmail: z.email("Invalid patient email"),
  reasonCode: z.enum([
    "cardiac_arrest",
    "stroke",
    "trauma",
    "unconscious",
    "severe_bleeding",
    "respiratory_failure",
    "sepsis",
    "other",
  ]),
  reasonText: z.string().min(10, "Reason must be at least 10 characters"),
});

const EMERGENCY_DURATION_HOURS = 48; // 24-72h window, default 48h
const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX = 3; // max 3 emergency accesses per doctor per 24h

export default async function emergencyAccessRoutes(app: FastifyInstance) {
  // POST /api/emergency-access — doctor invokes break-glass
  app.post(
    "/emergency-access",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      if (user.role !== "doctor") {
        return reply
          .code(403)
          .send({ error: "Only doctors can invoke emergency access" });
      }

      const parsed = createEmergencyAccessSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const { patientEmail, reasonCode, reasonText } = parsed.data;

      // Find patient by email
      const [patient] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, patientEmail), eq(users.role, "patient")))
        .limit(1);

      if (!patient) {
        return reply.code(404).send({ error: "Patient not found" });
      }

      if (patient.id === user.id) {
        return reply
          .code(400)
          .send({ error: "Cannot invoke emergency access on yourself" });
      }

      // Rate limiting: check recent emergency accesses by this doctor
      const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
      const [recentCount] = await db
        .select({ value: count() })
        .from(emergencyAccess)
        .where(
          and(
            eq(emergencyAccess.doctorId, user.id),
            gte(emergencyAccess.createdAt, windowStart),
          ),
        );

      if (Number(recentCount?.value ?? 0) >= RATE_LIMIT_MAX) {
        return reply.code(429).send({
          error: `Rate limit exceeded: max ${RATE_LIMIT_MAX} emergency accesses per ${RATE_LIMIT_WINDOW_HOURS}h`,
        });
      }

      // Check for existing active emergency access
      const [existing] = await db
        .select()
        .from(emergencyAccess)
        .where(
          and(
            eq(emergencyAccess.doctorId, user.id),
            eq(emergencyAccess.patientId, patient.id),
            eq(emergencyAccess.status, "active"),
          ),
        )
        .limit(1);

      if (existing) {
        return reply.code(409).send({
          error: "Active emergency access already exists for this patient",
        });
      }

      const grantedAt = new Date();
      const expiresAt = new Date(grantedAt.getTime() + EMERGENCY_DURATION_HOURS * 60 * 60 * 1000);

      const [ea] = await db
        .insert(emergencyAccess)
        .values({
          doctorId: user.id,
          patientId: patient.id,
          reasonCode,
          reasonText,
          grantedAt,
          expiresAt,
        })
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "emergency.access",
        targetPatientId: patient.id,
        details: {
          emergencyAccessId: ea.id,
          reasonCode,
          reasonText,
          expiresAt: expiresAt.toISOString(),
        },
      });

      // TODO: Trigger patient notification (email/push/SMS)
      // For now, set notified timestamp immediately
      await db
        .update(emergencyAccess)
        .set({ patientNotifiedAt: new Date() })
        .where(eq(emergencyAccess.id, ea.id));

      return reply.code(201).send({ emergencyAccess: ea });
    },
  );

  // GET /api/emergency-access — list emergency accesses
  // Doctors see ones they invoked; patients see ones on them
  app.get(
    "/emergency-access",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;

      let rows;
      if (user.role === "doctor") {
        rows = await db
          .select({
            id: emergencyAccess.id,
            doctorId: emergencyAccess.doctorId,
            patientId: emergencyAccess.patientId,
            reasonCode: emergencyAccess.reasonCode,
            reasonText: emergencyAccess.reasonText,
            status: emergencyAccess.status,
            grantedAt: emergencyAccess.grantedAt,
            expiresAt: emergencyAccess.expiresAt,
            patientNotifiedAt: emergencyAccess.patientNotifiedAt,
            patientName: users.name,
            patientEmail: users.email,
          })
          .from(emergencyAccess)
          .innerJoin(users, eq(emergencyAccess.patientId, users.id))
          .where(eq(emergencyAccess.doctorId, user.id));
      } else {
        rows = await db
          .select({
            id: emergencyAccess.id,
            doctorId: emergencyAccess.doctorId,
            patientId: emergencyAccess.patientId,
            reasonCode: emergencyAccess.reasonCode,
            reasonText: emergencyAccess.reasonText,
            status: emergencyAccess.status,
            grantedAt: emergencyAccess.grantedAt,
            expiresAt: emergencyAccess.expiresAt,
            patientNotifiedAt: emergencyAccess.patientNotifiedAt,
            doctorName: users.name,
            doctorEmail: users.email,
          })
          .from(emergencyAccess)
          .innerJoin(users, eq(emergencyAccess.doctorId, users.id))
          .where(eq(emergencyAccess.patientId, user.id));
      }

      return reply.send({ emergencyAccesses: rows });
    },
  );

  // PATCH /api/emergency-access/:id/revoke — patient/admin revokes
  app.patch(
    "/emergency-access/:id/revoke",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(emergencyAccess)
        .where(eq(emergencyAccess.id, id))
        .limit(1);

      if (!existing) {
        return reply.code(404).send({ error: "Emergency access not found" });
      }

      // Patient can revoke their own; admin can revoke any
      const canRevoke =
        user.role === "admin" ||
        (user.role === "patient" && existing.patientId === user.id);

      if (!canRevoke) {
        return reply.code(403).send({ error: "Not authorized to revoke" });
      }

      if (existing.status !== "active") {
        return reply
          .code(400)
          .send({ error: `Cannot revoke ${existing.status} emergency access` });
      }

      const [updated] = await db
        .update(emergencyAccess)
        .set({ status: "revoked" })
        .where(eq(emergencyAccess.id, id))
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "emergency.revoke",
        targetPatientId: existing.patientId,
        details: { emergencyAccessId: id, doctorId: existing.doctorId },
      });

      return reply.send({ emergencyAccess: updated });
    },
  );

  // GET /api/emergency-access/active/:patientId — check if patient has active emergency access
  app.get(
    "/emergency-access/active/:patientId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const { patientId } = request.params as { patientId: string };

      // Only allow checking for self (patient) or if doctor has access
      if (user.role === "patient" && user.id !== patientId) {
        return reply.code(403).send({ error: "Access denied" });
      }

      const now = new Date();
      const [active] = await db
        .select()
        .from(emergencyAccess)
        .where(
          and(
            eq(emergencyAccess.patientId, patientId),
            eq(emergencyAccess.status, "active"),
            gte(emergencyAccess.expiresAt, now),
          ),
        )
        .limit(1);

      return reply.send({ active: !!active, emergencyAccess: active ?? null });
    },
  );
}