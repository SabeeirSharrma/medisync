import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { accessRequests, users } from "../db/schema.js";
import { eq, and, or } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { z } from "zod/v4";

const scopeSchema = z.object({
  categories: z.array(z.string()).nullable().optional(),
  dateFrom: z.string().nullable().optional(),
  dateTo: z.string().nullable().optional(),
});

const createAccessRequestSchema = z.object({
  patientEmail: z.email("Invalid patient email"),
  scope: scopeSchema.optional(),
});

const approveSchema = z.object({
  scope: scopeSchema,
});

export default async function accessRequestRoutes(app: FastifyInstance) {
  // POST /api/access-requests — doctor requests access to a patient
  app.post(
    "/access-requests",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      if (user.role !== "doctor") {
        return reply
          .code(403)
          .send({ error: "Only doctors can request access" });
      }

      const parsed = createAccessRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const { patientEmail, scope } = parsed.data;

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
          .send({ error: "Cannot request access to your own records" });
      }

      // Check for existing pending/approved request
      const [existing] = await db
        .select()
        .from(accessRequests)
        .where(
          and(
            eq(accessRequests.doctorId, user.id),
            eq(accessRequests.patientId, patient.id),
            or(
              eq(accessRequests.status, "pending"),
              eq(accessRequests.status, "approved"),
            ),
          ),
        )
        .limit(1);

      if (existing) {
        return reply.code(409).send({
          error: `Access request already ${existing.status}`,
        });
      }

      const [request_] = await db
        .insert(accessRequests)
        .values({
          doctorId: user.id,
          patientId: patient.id,
          scope: scope ?? {},
        })
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "access.request",
        targetPatientId: patient.id,
        details: { accessRequestId: request_.id, scope: scope ?? {} },
      });

      return reply.code(201).send({ accessRequest: request_ });
    },
  );

  // GET /api/access-requests — list access requests
  // Doctors see requests they sent; patients see requests they received
  app.get(
    "/access-requests",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;

      let rows;
      if (user.role === "doctor") {
        rows = await db
          .select({
            id: accessRequests.id,
            doctorId: accessRequests.doctorId,
            patientId: accessRequests.patientId,
            scope: accessRequests.scope,
            status: accessRequests.status,
            expiry: accessRequests.expiry,
            createdAt: accessRequests.createdAt,
            updatedAt: accessRequests.updatedAt,
            patientName: users.name,
            patientEmail: users.email,
          })
          .from(accessRequests)
          .innerJoin(users, eq(accessRequests.patientId, users.id))
          .where(eq(accessRequests.doctorId, user.id));
      } else {
        // Patient: see requests sent to them
        rows = await db
          .select({
            id: accessRequests.id,
            doctorId: accessRequests.doctorId,
            patientId: accessRequests.patientId,
            scope: accessRequests.scope,
            status: accessRequests.status,
            expiry: accessRequests.expiry,
            createdAt: accessRequests.createdAt,
            updatedAt: accessRequests.updatedAt,
            doctorName: users.name,
            doctorEmail: users.email,
          })
          .from(accessRequests)
          .innerJoin(users, eq(accessRequests.doctorId, users.id))
          .where(eq(accessRequests.patientId, user.id));
      }

      return reply.send({ accessRequests: rows });
    },
  );

  // PATCH /api/access-requests/:id/approve — patient approves with scope
  app.patch(
    "/access-requests/:id/approve",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      if (user.role !== "patient") {
        return reply
          .code(403)
          .send({ error: "Only patients can approve access requests" });
      }

      const { id } = request.params as { id: string };
      const parsed = approveSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const [existing] = await db
        .select()
        .from(accessRequests)
        .where(
          and(
            eq(accessRequests.id, id),
            eq(accessRequests.patientId, user.id),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply.code(404).send({ error: "Access request not found" });
      }

      if (existing.status !== "pending") {
        return reply
          .code(400)
          .send({ error: `Cannot approve a ${existing.status} request` });
      }

      const [updated] = await db
        .update(accessRequests)
        .set({
          status: "approved",
          scope: parsed.data.scope,
          updatedAt: new Date(),
        })
        .where(eq(accessRequests.id, id))
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "access.grant",
        targetPatientId: user.id,
        details: {
          accessRequestId: id,
          doctorId: existing.doctorId,
          scope: parsed.data.scope,
        },
      });

      return reply.send({ accessRequest: updated });
    },
  );

  // PATCH /api/access-requests/:id/deny — patient denies
  app.patch(
    "/access-requests/:id/deny",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      if (user.role !== "patient") {
        return reply
          .code(403)
          .send({ error: "Only patients can deny access requests" });
      }

      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(accessRequests)
        .where(
          and(
            eq(accessRequests.id, id),
            eq(accessRequests.patientId, user.id),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply.code(404).send({ error: "Access request not found" });
      }

      if (existing.status !== "pending") {
        return reply
          .code(400)
          .send({ error: `Cannot deny a ${existing.status} request` });
      }

      const [updated] = await db
        .update(accessRequests)
        .set({ status: "denied", updatedAt: new Date() })
        .where(eq(accessRequests.id, id))
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "access.revoke",
        targetPatientId: user.id,
        details: { accessRequestId: id, doctorId: existing.doctorId },
      });

      return reply.send({ accessRequest: updated });
    },
  );

  // PATCH /api/access-requests/:id/revoke — patient revokes approved access, or doctor revokes their own
  app.patch(
    "/access-requests/:id/revoke",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;

      const { id } = request.params as { id: string };

      // Find the access request — patient can revoke their own, doctor can revoke ones they sent
      let existing;
      if (user.role === "patient") {
        [existing] = await db
          .select()
          .from(accessRequests)
          .where(
            and(
              eq(accessRequests.id, id),
              eq(accessRequests.patientId, user.id),
            ),
          )
          .limit(1);
      } else if (user.role === "doctor") {
        [existing] = await db
          .select()
          .from(accessRequests)
          .where(
            and(
              eq(accessRequests.id, id),
              eq(accessRequests.doctorId, user.id),
            ),
          )
          .limit(1);
      } else {
        return reply.code(403).send({ error: "Not authorized to revoke" });
      }

      if (!existing) {
        return reply.code(404).send({ error: "Access request not found" });
      }

      if (existing.status !== "approved") {
        return reply
          .code(400)
          .send({ error: `Cannot revoke a ${existing.status} request` });
      }

      const [updated] = await db
        .update(accessRequests)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(accessRequests.id, id))
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "access.revoke",
        targetPatientId: user.id,
        details: { accessRequestId: id, doctorId: existing.doctorId },
      });

      return reply.send({ accessRequest: updated });
    },
  );
}
