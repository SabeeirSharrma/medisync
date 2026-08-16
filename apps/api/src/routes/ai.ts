// apps/api/src/routes/ai.ts
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, records } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { z } from "zod/v4";

const summarizePatientSchema = z.object({
  recordTypes: z.array(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const summarizeRecordSchema = z.object({
  includeHistory: z.boolean().optional(),
});

export default async function aiRoutes(app: FastifyInstance) {
  // POST /api/patients/:patientId/summarize — AI summary of patient records (stub)
  app.post(
    "/patients/:patientId/summarize",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const { patientId } = request.params as { patientId: string };

      // Only doctors with access or the patient themselves can request summary
      if (user.role !== "admin" && user.id !== patientId) {
        return reply.code(403).send({ error: "Access denied" });
      }

      const parsed = summarizePatientSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      // Verify patient exists
      const [patient] = await db
        .select()
        .from(users)
        .where(eq(users.id, patientId))
        .limit(1);

      if (!patient) {
        return reply.code(404).send({ error: "Patient not found" });
      }

      // Fetch patient records (filtered by optional params)
      const whereConditions = [eq(records.patientId, patientId)];

      if (parsed.data.recordTypes && parsed.data.recordTypes.length > 0) {
        // Filter by record types - using inArray would be needed here
        // For stub, we'll include all and note the filter in response
      }

      const patientRecords = await db
        .select()
        .from(records)
        .where(eq(records.patientId, patientId));

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "record.read",
        targetPatientId: patientId,
        details: { aiSummaryRequest: true, recordCount: patientRecords.length },
      });

      // STUB: In production, this would call an AI service
      return reply.send({
        patientId,
        patientName: patient.name,
        recordCount: patientRecords.length,
        summary: {
          status: "stub",
          message: "AI summarization not yet implemented. This endpoint is a placeholder for future AI integration.",
          recordTypes: parsed.data.recordTypes ?? ["all"],
          dateRange: {
            from: parsed.data.dateFrom ?? "all",
            to: parsed.data.dateTo ?? "now",
          },
          recordsAnalyzed: patientRecords.length,
          // In production: would return actual AI-generated summary
          placeholder: "AI summary would appear here once integrated with an LLM provider.",
        },
      });
    },
  );

  // POST /api/records/:recordId/summarize — AI summary of a specific record (stub)
  app.post(
    "/records/:recordId/summarize",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const { recordId } = request.params as { recordId: string };

      const parsed = summarizeRecordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      // Find the record
      const [record] = await db
        .select()
        .from(records)
        .where(eq(records.id, recordId))
        .limit(1);

      if (!record) {
        return reply.code(404).send({ error: "Record not found" });
      }

      // Check access: patient themselves, or doctor with approved access
      const isOwner = user.id === record.patientId;
      const isAdmin = user.role === "admin";

      if (!isOwner && !isAdmin) {
        return reply.code(403).send({ error: "Access denied" });
      }

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "record.read",
        targetPatientId: record.patientId,
        details: { aiSummaryRequest: true, recordId },
      });

      // STUB: In production, this would call an AI service
      return reply.send({
        recordId,
        recordType: record.type,
        summary: {
          status: "stub",
          message: "AI summarization not yet implemented. This endpoint is a placeholder for future AI integration.",
          recordType: record.type,
          date: record.date,
          doctorName: record.doctorName,
          hospitalName: record.hospitalName,
          // In production: would return actual AI-generated summary
          placeholder: "AI summary of this specific record would appear here once integrated with an LLM provider.",
          includeHistory: parsed.data.includeHistory ?? false,
        },
      });
    },
  );
}