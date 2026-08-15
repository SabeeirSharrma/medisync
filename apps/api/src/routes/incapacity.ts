import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { incapacityRequest, users, orgs, accessRequests } from "../db/schema.js";
import { eq, and, or, count, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { z } from "zod/v4";

const createIncapacityRequestSchema = z.object({
  patientEmail: z.email("Invalid patient email"),
  proposedGuardianEmail: z.email("Invalid proposed guardian email"),
  practiceType: z.enum(["hospital", "org", "solo"]),
  reason: z.string().min(20, "Reason must be at least 20 characters"),
  supportingNote: z.string().optional(),
  legalDocumentImageRef: z.string().min(1, "Legal document image reference is required"),
  legalDocumentTranscript: z.string().min(1, "Legal document transcript is required"),
});

const updateIncapacityStatusSchema = z.object({
  status: z.enum([
    "pending_guardian",
    "pending_senior",
    "pending_legal_review",
    "active_shared_control",
    "denied",
    "revoked",
  ]),
  // Optional fields for different approval stages
  guardianApproved: z.boolean().optional(),
  seniorApproved: z.boolean().optional(),
  legalDocumentVerified: z.enum(["true", "false"]).optional(),
});

export default async function incapacityRoutes(app: FastifyInstance) {
  // POST /api/incapacity-requests — initiating doctor creates incapacity request
  app.post(
    "/incapacity-requests",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      if (user.role !== "doctor") {
        return reply
          .code(403)
          .send({ error: "Only doctors can initiate incapacity requests" });
      }

      const parsed = createIncapacityRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const {
        patientEmail,
        proposedGuardianEmail,
        practiceType,
        reason,
        supportingNote,
        legalDocumentImageRef,
        legalDocumentTranscript,
      } = parsed.data;

      // Find patient
      const [patient] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, patientEmail), eq(users.role, "patient")))
        .limit(1);

      if (!patient) {
        return reply.code(404).send({ error: "Patient not found" });
      }

      // Check if doctor has approved access to this patient (existing treating relationship)
      // This is a simplified check - in practice, you'd verify the doctor has access
      const [access] = await db
        .select()
        .from(accessRequests)
        .where(
          and(
            eq(accessRequests.doctorId, user.id),
            eq(accessRequests.patientId, patient.id),
            eq(accessRequests.status, "approved"),
          ),
        )
        .limit(1);

      if (!access) {
        return reply.code(403).send({
          error: "Incapacity request requires an existing approved treating relationship",
        });
      }

      // Find proposed guardian
      const [proposedGuardian] = await db
        .select()
        .from(users)
        .where(eq(users.email, proposedGuardianEmail))
        .limit(1);

      if (!proposedGuardian) {
        return reply.code(404).send({ error: "Proposed guardian not found" });
      }

      if (proposedGuardian.id === patient.id) {
        return reply.code(400).send({ error: "Patient cannot be their own guardian" });
      }

      if (proposedGuardian.id === user.id) {
        return reply.code(400).send({ error: "Doctor cannot be the proposed guardian" });
      }

      // Check for existing active/pending request for this patient
      const [existing] = await db
        .select()
        .from(incapacityRequest)
        .where(
          and(
            eq(incapacityRequest.patientId, patient.id),
            or(
              eq(incapacityRequest.status, "pending_guardian"),
              eq(incapacityRequest.status, "pending_senior"),
              eq(incapacityRequest.status, "pending_legal_review"),
              eq(incapacityRequest.status, "active_shared_control"),
            ),
          ),
        )
        .limit(1);

      if (existing) {
        return reply.code(409).send({ error: "Active incapacity request already exists for this patient" });
      }

      // Determine senior reviewer based on practice type
      let seniorReviewerId: string | null = null;
      if (practiceType === "hospital" || practiceType === "org") {
        // In a real implementation, you'd look up the department head or org admin
        // For now, we'll leave it null and require manual assignment
      }

      const [createdRequest] = await db
        .insert(incapacityRequest)
        .values({
          patientId: patient.id,
          initiatingDoctorId: user.id,
          practiceType,
          proposedGuardianId: proposedGuardian.id,
          seniorReviewerId,
          legalDocumentImageRef,
          legalDocumentTranscript,
          reason,
          supportingNote: supportingNote ?? null,
        })
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "guardian.grant", // Using existing audit action
        targetPatientId: patient.id,
        details: {
          incapacityRequestId: createdRequest.id,
          practiceType,
          proposedGuardianId: proposedGuardian.id,
          reason,
        },
      });

      return reply.code(201).send({ incapacityRequest: createdRequest });
    },
  );

  // GET /api/incapacity-requests — list incapacity requests
  app.get("/incapacity-requests", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;

    let rows;
    if (user.role === "doctor") {
      rows = await db
        .select({
          id: incapacityRequest.id,
          patientId: incapacityRequest.patientId,
          initiatingDoctorId: incapacityRequest.initiatingDoctorId,
          practiceType: incapacityRequest.practiceType,
          proposedGuardianId: incapacityRequest.proposedGuardianId,
          guardianApproved: incapacityRequest.guardianApproved,
          guardianApprovedAt: incapacityRequest.guardianApprovedAt,
          seniorReviewerId: incapacityRequest.seniorReviewerId,
          seniorApproved: incapacityRequest.seniorApproved,
          seniorApprovedAt: incapacityRequest.seniorApprovedAt,
          legalDocumentImageRef: incapacityRequest.legalDocumentImageRef,
          legalDocumentTranscript: incapacityRequest.legalDocumentTranscript,
          legalDocumentVerified: incapacityRequest.legalDocumentVerified,
          legalDocumentReviewerId: incapacityRequest.legalDocumentReviewerId,
          status: incapacityRequest.status,
          reason: incapacityRequest.reason,
          supportingNote: incapacityRequest.supportingNote,
          createdAt: incapacityRequest.createdAt,
          updatedAt: incapacityRequest.updatedAt,
          activatedAt: incapacityRequest.activatedAt,
          patientName: users.name,
          patientEmail: users.email,
        })
        .from(incapacityRequest)
        .innerJoin(users, eq(incapacityRequest.patientId, users.id))
        .where(eq(incapacityRequest.initiatingDoctorId, user.id));
    } else if (user.role === "patient") {
      rows = await db
        .select({
          id: incapacityRequest.id,
          patientId: incapacityRequest.patientId,
          initiatingDoctorId: incapacityRequest.initiatingDoctorId,
          practiceType: incapacityRequest.practiceType,
          proposedGuardianId: incapacityRequest.proposedGuardianId,
          guardianApproved: incapacityRequest.guardianApproved,
          guardianApprovedAt: incapacityRequest.guardianApprovedAt,
          seniorReviewerId: incapacityRequest.seniorReviewerId,
          seniorApproved: incapacityRequest.seniorApproved,
          seniorApprovedAt: incapacityRequest.seniorApprovedAt,
          legalDocumentImageRef: incapacityRequest.legalDocumentImageRef,
          legalDocumentTranscript: incapacityRequest.legalDocumentTranscript,
          legalDocumentVerified: incapacityRequest.legalDocumentVerified,
          legalDocumentReviewerId: incapacityRequest.legalDocumentReviewerId,
          status: incapacityRequest.status,
          reason: incapacityRequest.reason,
          supportingNote: incapacityRequest.supportingNote,
          createdAt: incapacityRequest.createdAt,
          updatedAt: incapacityRequest.updatedAt,
          activatedAt: incapacityRequest.activatedAt,
          doctorName: users.name,
          doctorEmail: users.email,
        })
        .from(incapacityRequest)
        .innerJoin(users, eq(incapacityRequest.initiatingDoctorId, users.id))
        .where(eq(incapacityRequest.patientId, user.id));
    } else {
      // Admin: see all
      rows = await db
        .select({
          id: incapacityRequest.id,
          patientId: incapacityRequest.patientId,
          initiatingDoctorId: incapacityRequest.initiatingDoctorId,
          practiceType: incapacityRequest.practiceType,
          proposedGuardianId: incapacityRequest.proposedGuardianId,
          guardianApproved: incapacityRequest.guardianApproved,
          guardianApprovedAt: incapacityRequest.guardianApprovedAt,
          seniorReviewerId: incapacityRequest.seniorReviewerId,
          seniorApproved: incapacityRequest.seniorApproved,
          seniorApprovedAt: incapacityRequest.seniorApprovedAt,
          legalDocumentImageRef: incapacityRequest.legalDocumentImageRef,
          legalDocumentTranscript: incapacityRequest.legalDocumentTranscript,
          legalDocumentVerified: incapacityRequest.legalDocumentVerified,
          legalDocumentReviewerId: incapacityRequest.legalDocumentReviewerId,
          status: incapacityRequest.status,
          reason: incapacityRequest.reason,
          supportingNote: incapacityRequest.supportingNote,
          createdAt: incapacityRequest.createdAt,
          updatedAt: incapacityRequest.updatedAt,
          activatedAt: incapacityRequest.activatedAt,
        })
        .from(incapacityRequest);
    }

    return reply.send({ incapacityRequests: rows });
  });

  // PATCH /api/incapacity-requests/:id/status — update status (guardian approval, senior approval, legal review)
  app.patch(
    "/incapacity-requests/:id/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const parsed = updateIncapacityStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const [existing] = await db
        .select()
        .from(incapacityRequest)
        .where(eq(incapacityRequest.id, id))
        .limit(1);

      if (!existing) {
        return reply.code(404).send({ error: "Incapacity request not found" });
      }

      const newStatus = parsed.data.status;
      const isProposedGuardian = user.id === existing.proposedGuardianId;
      const isSeniorReviewer = user.id === existing.seniorReviewerId;
      const isLegalReviewer = user.role === "admin"; // Admin acts as legal reviewer
      const isInitiatingDoctor = user.id === existing.initiatingDoctorId;
      const isAdmin = user.role === "admin";

      // Validate transitions based on current status and user role
      const valid = validateTransition(existing.status, newStatus, {
        isProposedGuardian,
        isSeniorReviewer,
        isLegalReviewer,
        isInitiatingDoctor,
        isAdmin,
      });

      if (!valid.allowed) {
        return reply.code(403).send({ error: valid.error });
      }

      const updateData: Record<string, any> = { status: newStatus, updatedAt: new Date() };

      // Handle specific approval fields
      if (parsed.data.guardianApproved !== undefined) {
        updateData.guardianApproved = parsed.data.guardianApproved;
        if (parsed.data.guardianApproved) {
          updateData.guardianApprovedAt = new Date();
        }
      }
      if (parsed.data.seniorApproved !== undefined) {
        updateData.seniorApproved = parsed.data.seniorApproved;
        if (parsed.data.seniorApproved) {
          updateData.seniorApprovedAt = new Date();
        }
      }
      if (parsed.data.legalDocumentVerified !== undefined) {
        updateData.legalDocumentVerified = parsed.data.legalDocumentVerified === "true" ? "true" : "false";
        updateData.legalDocumentReviewerId = user.id;
      }

      if (newStatus === "active_shared_control" && !existing.activatedAt) {
        updateData.activatedAt = new Date();
      }

      const [updated] = await db
        .update(incapacityRequest)
        .set(updateData)
        .where(eq(incapacityRequest.id, id))
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "guardian.grant",
        targetPatientId: existing.patientId,
        details: {
          incapacityRequestId: id,
          newStatus,
          guardianApproved: parsed.data.guardianApproved,
          seniorApproved: parsed.data.seniorApproved,
          legalDocumentVerified: parsed.data.legalDocumentVerified,
        },
      });

      return reply.send({ incapacityRequest: updated });
    },
  );

  // GET /api/incapacity-requests/:id — get single request details
  app.get(
    "/incapacity-requests/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const [req] = await db
        .select()
        .from(incapacityRequest)
        .where(eq(incapacityRequest.id, id))
        .limit(1);

      if (!req) {
        return reply.code(404).send({ error: "Incapacity request not found" });
      }

      // Authorization: patient, doctor, guardian, senior reviewer, admin
      const authorized =
        user.id === req.patientId ||
        user.id === req.initiatingDoctorId ||
        user.id === req.proposedGuardianId ||
        user.id === req.seniorReviewerId ||
        user.id === req.legalDocumentReviewerId ||
        user.role === "admin";

      if (!authorized) {
        return reply.code(403).send({ error: "Access denied" });
      }

      return reply.send({ incapacityRequest: req });
    },
  );
}

function validateTransition(
  currentStatus: string,
  newStatus: string,
  roles: {
    isProposedGuardian: boolean;
    isSeniorReviewer: boolean;
    isLegalReviewer: boolean;
    isInitiatingDoctor: boolean;
    isAdmin: boolean;
  },
): { allowed: boolean; error?: string } {
  // Admin can do anything
  if (roles.isAdmin) return { allowed: true };

  // Define valid transitions
  const transitions: Record<string, { status: string; roles: string[] }[]> = {
    pending_guardian: [
      { status: "pending_senior", roles: ["proposedGuardian"] }, // Guardian approves
      { status: "denied", roles: ["proposedGuardian", "admin"] }, // Guardian or admin denies
      { status: "revoked", roles: ["initiatingDoctor", "admin"] }, // Doctor revokes
    ],
    pending_senior: [
      { status: "pending_legal_review", roles: ["seniorReviewer", "admin"] }, // Senior approves
      { status: "denied", roles: ["seniorReviewer", "admin", "proposedGuardian"] }, // Senior or admin denies
      { status: "revoked", roles: ["initiatingDoctor", "admin"] }, // Doctor revokes
    ],
    pending_legal_review: [
      { status: "active_shared_control", roles: ["legalReviewer", "admin"] }, // Legal review passes
      { status: "denied", roles: ["legalReviewer", "admin"] }, // Legal review fails
    ],
    active_shared_control: [
      { status: "revoked", roles: ["admin", "initiatingDoctor"] }, // Admin or doctor revokes
    ],
    denied: [
      { status: "revoked", roles: ["admin"] }, // Can only revoke (close)
    ],
    revoked: [], // Terminal state
  };

  const validTransitions = transitions[currentStatus] || [];
  const matchingTransition = validTransitions.find((t) => t.status === newStatus);

  if (!matchingTransition) {
    return { allowed: false, error: `Invalid transition from ${currentStatus} to ${newStatus}` };
  }

  // Check if user has required role
  const hasRole = matchingTransition.roles.some((role) => {
    switch (role) {
      case "proposedGuardian":
        return roles.isProposedGuardian;
      case "seniorReviewer":
        return roles.isSeniorReviewer;
      case "legalReviewer":
        return roles.isLegalReviewer;
      case "initiatingDoctor":
        return roles.isInitiatingDoctor;
      case "admin":
        return roles.isAdmin;
      default:
        return false;
    }
  });

  if (!hasRole) {
    return { allowed: false, error: "Not authorized for this transition" };
  }

  return { allowed: true };
}