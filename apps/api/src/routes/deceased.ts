import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { legacyContact, estateClaim, users } from "../db/schema.js";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { z } from "zod/v4";

const createLegacyContactSchema = z.object({
  contactEmail: z.email("Invalid contact email"),
});

const createEstateClaimSchema = z.object({
  patientEmail: z.email("Invalid patient email"),
  legalDocumentImageRef: z.string().min(1, "Legal document image reference is required"),
  legalDocumentTranscript: z.string().min(1, "Legal document transcript is required"),
});

const updateLegacyStatusSchema = z.object({
  status: z.enum(["active", "transferred", "revoked"]),
});

const updateEstateClaimStatusSchema = z.object({
  status: z.enum(["pending_review", "approved", "denied"]),
});

export default async function deceasedRoutes(app: FastifyInstance) {
  // POST /api/legacy-contact — patient designates legacy contact
  app.post(
    "/legacy-contact",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      if (user.role !== "patient") {
        return reply
          .code(403)
          .send({ error: "Only patients can designate a legacy contact" });
      }

      const parsed = createLegacyContactSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const { contactEmail } = parsed.data;

      // Find contact
      const [contact] = await db
        .select()
        .from(users)
        .where(eq(users.email, contactEmail))
        .limit(1);

      if (!contact) {
        return reply.code(404).send({ error: "Contact not found" });
      }

      if (contact.id === user.id) {
        return reply.code(400).send({ error: "Cannot designate yourself as legacy contact" });
      }

      // Check for existing active legacy contact
      const [existing] = await db
        .select()
        .from(legacyContact)
        .where(
          and(
            eq(legacyContact.patientId, user.id),
            eq(legacyContact.status, "active"),
          ),
        )
        .limit(1);

      if (existing) {
        return reply.code(409).send({ error: "Active legacy contact already exists" });
      }

      const [lc] = await db
        .insert(legacyContact)
        .values({
          patientId: user.id,
          contactId: contact.id,
        })
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "guardian.grant", // Using existing audit action
        targetPatientId: user.id,
        details: { legacyContactId: lc.id, contactId: contact.id },
      });

      return reply.code(201).send({ legacyContact: lc });
    },
  );

  // GET /api/legacy-contact — list legacy contacts
  app.get("/legacy-contact", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;

    let rows;
    if (user.role === "patient") {
      rows = await db
        .select({
          id: legacyContact.id,
          patientId: legacyContact.patientId,
          contactId: legacyContact.contactId,
          designatedAt: legacyContact.designatedAt,
          status: legacyContact.status,
          transferredAt: legacyContact.transferredAt,
          contactName: users.name,
          contactEmail: users.email,
        })
        .from(legacyContact)
        .innerJoin(users, eq(legacyContact.contactId, users.id))
        .where(eq(legacyContact.patientId, user.id));
    } else {
      rows = await db
        .select({
          id: legacyContact.id,
          patientId: legacyContact.patientId,
          contactId: legacyContact.contactId,
          designatedAt: legacyContact.designatedAt,
          status: legacyContact.status,
          transferredAt: legacyContact.transferredAt,
          patientName: users.name,
          patientEmail: users.email,
        })
        .from(legacyContact)
        .innerJoin(users, eq(legacyContact.patientId, users.id))
        .where(eq(legacyContact.contactId, user.id));
    }

    return reply.send({ legacyContacts: rows });
  });

  // PATCH /api/legacy-contact/:id/status — update legacy contact status
  app.patch(
    "/legacy-contact/:id/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const parsed = updateLegacyStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const [existing] = await db
        .select()
        .from(legacyContact)
        .where(eq(legacyContact.id, id))
        .limit(1);

      if (!existing) {
        return reply.code(404).send({ error: "Legacy contact not found" });
      }

      // Only patient can revoke; transfer happens on death confirmation (admin)
      const isPatient = user.id === existing.patientId;
      const isAdmin = user.role === "admin";

      const newStatus = parsed.data.status;

      if (isPatient && newStatus === "revoked" && existing.status === "active") {
        // OK - patient revokes
      } else if (isAdmin && newStatus === "transferred" && existing.status === "active") {
        // OK - admin transfers on death confirmation
      } else {
        return reply.code(403).send({ error: "Not authorized for this transition" });
      }

      const updateData: Record<string, any> = { status: newStatus };
      if (newStatus === "transferred") {
        updateData.transferredAt = new Date();
      }

      const [updated] = await db
        .update(legacyContact)
        .set(updateData)
        .where(eq(legacyContact.id, id))
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: newStatus === "revoked" ? "guardian.revoke" : "guardian.grant",
        targetPatientId: existing.patientId,
        details: { legacyContactId: id, contactId: existing.contactId, newStatus },
      });

      return reply.send({ legacyContact: updated });
    },
  );

  // POST /api/estate-claim — claimant files estate claim
  app.post(
    "/estate-claim",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const parsed = createEstateClaimSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const { patientEmail, legalDocumentImageRef, legalDocumentTranscript } = parsed.data;

      // Find patient
      const [patient] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, patientEmail), eq(users.role, "patient")))
        .limit(1);

      if (!patient) {
        return reply.code(404).send({ error: "Patient not found" });
      }

      if (patient.id === user.id) {
        return reply.code(400).send({ error: "Cannot file estate claim for yourself" });
      }

      // Check for existing pending/approved claim
      const [existing] = await db
        .select()
        .from(estateClaim)
        .where(
          and(
            eq(estateClaim.patientId, patient.id),
            or(
              eq(estateClaim.status, "pending_review"),
              eq(estateClaim.status, "approved"),
            ),
          ),
        )
        .limit(1);

      if (existing) {
        return reply.code(409).send({ error: "Estate claim already exists for this patient" });
      }

      const [claim] = await db
        .insert(estateClaim)
        .values({
          patientId: patient.id,
          claimantId: user.id,
          legalDocumentImageRef,
          legalDocumentTranscript,
        })
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "guardian.grant",
        targetPatientId: patient.id,
        details: { estateClaimId: claim.id, claimantId: user.id },
      });

      return reply.code(201).send({ estateClaim: claim });
    },
  );

  // GET /api/estate-claim — list estate claims
  app.get("/estate-claim", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;

    let rows;
    if (user.role === "admin") {
      rows = await db
        .select({
          id: estateClaim.id,
          patientId: estateClaim.patientId,
          claimantId: estateClaim.claimantId,
          legalDocumentImageRef: estateClaim.legalDocumentImageRef,
          legalDocumentTranscript: estateClaim.legalDocumentTranscript,
          status: estateClaim.status,
          createdAt: estateClaim.createdAt,
          updatedAt: estateClaim.updatedAt,
          reviewedAt: estateClaim.reviewedAt,
          reviewerId: estateClaim.reviewerId,
          patientName: users.name,
          patientEmail: users.email,
        })
        .from(estateClaim)
        .innerJoin(users, eq(estateClaim.patientId, users.id));
    } else {
      rows = await db
        .select({
          id: estateClaim.id,
          patientId: estateClaim.patientId,
          claimantId: estateClaim.claimantId,
          legalDocumentImageRef: estateClaim.legalDocumentImageRef,
          legalDocumentTranscript: estateClaim.legalDocumentTranscript,
          status: estateClaim.status,
          createdAt: estateClaim.createdAt,
          updatedAt: estateClaim.updatedAt,
          reviewedAt: estateClaim.reviewedAt,
          reviewerId: estateClaim.reviewerId,
          patientName: users.name,
          patientEmail: users.email,
        })
        .from(estateClaim)
        .innerJoin(users, eq(estateClaim.patientId, users.id))
        .where(eq(estateClaim.claimantId, user.id));
    }

    return reply.send({ estateClaims: rows });
  });

  // PATCH /api/estate-claim/:id/status — admin reviews estate claim
  app.patch(
    "/estate-claim/:id/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      if (user.role !== "admin") {
        return reply.code(403).send({ error: "Only admins can review estate claims" });
      }

      const { id } = request.params as { id: string };
      const parsed = updateEstateClaimStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const [existing] = await db
        .select()
        .from(estateClaim)
        .where(eq(estateClaim.id, id))
        .limit(1);

      if (!existing) {
        return reply.code(404).send({ error: "Estate claim not found" });
      }

      if (existing.status !== "pending_review") {
        return reply.code(400).send({ error: "Only pending claims can be reviewed" });
      }

      const newStatus = parsed.data.status;
      const updateData: Record<string, any> = {
        status: newStatus,
        updatedAt: new Date(),
        reviewedAt: new Date(),
        reviewerId: user.id,
      };

      const [updated] = await db
        .update(estateClaim)
        .set(updateData)
        .where(eq(estateClaim.id, id))
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "guardian.grant",
        targetPatientId: existing.patientId,
        details: { estateClaimId: id, claimantId: existing.claimantId, newStatus },
      });

      return reply.send({ estateClaim: updated });
    },
  );

  // GET /api/deceased/:patientId — check deceased status and transfer info
  app.get(
    "/deceased/:patientId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const { patientId } = request.params as { patientId: string };

      // Only patient themselves or admin can check
      if (user.role !== "admin" && user.id !== patientId) {
        return reply.code(403).send({ error: "Access denied" });
      }

      // Check for transferred legacy contact
      const [legacy] = await db
        .select()
        .from(legacyContact)
        .where(
          and(
            eq(legacyContact.patientId, patientId),
            eq(legacyContact.status, "transferred"),
          ),
        )
        .limit(1);

      // Check for approved estate claim
      const [claim] = await db
        .select()
        .from(estateClaim)
        .where(
          and(
            eq(estateClaim.patientId, patientId),
            eq(estateClaim.status, "approved"),
          ),
        )
        .limit(1);

      // Determine ownership
      let ownership: "patient" | "legacy_contact" | "estate_claimant" | null = null;
      let ownerId: string | null = null;

      if (legacy) {
        ownership = "legacy_contact";
        ownerId = legacy.contactId;
      } else if (claim) {
        ownership = "estate_claimant";
        ownerId = claim.claimantId;
      }

      return reply.send({
        isDeceased: !!legacy || !!claim,
        legacyContact: legacy ?? null,
        estateClaim: claim ?? null,
        ownership,
        ownerId,
      });
    },
  );
}