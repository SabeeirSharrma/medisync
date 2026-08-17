// apps/api/src/routes/ai.ts
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, records } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import {
  summarizePatientRecords,
  summarizeRecord,
} from "../lib/ai.js";
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
  app.post(
    "/patients/:patientId/summarize",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const { patientId } = request.params as { patientId: string };

      if (user.role !== "admin" && user.id !== patientId) {
        return reply.code(403).send({ error: "Access denied" });
      }

      const parsed = summarizePatientSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const [patient] = await db
        .select()
        .from(users)
        .where(eq(users.id, patientId))
        .limit(1);

      if (!patient) {
        return reply.code(404).send({ error: "Patient not found" });
      }

      let patientRecords = await db
        .select()
        .from(records)
        .where(eq(records.patientId, patientId));

      if (parsed.data.recordTypes && parsed.data.recordTypes.length > 0) {
        const types = parsed.data.recordTypes;
        patientRecords = patientRecords.filter((r) => types.includes(r.type));
      }

      if (parsed.data.dateFrom) {
        patientRecords = patientRecords.filter(
          (r) => r.date >= parsed.data.dateFrom!,
        );
      }
      if (parsed.data.dateTo) {
        patientRecords = patientRecords.filter(
          (r) => r.date <= parsed.data.dateTo!,
        );
      }

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "record.read",
        targetPatientId: patientId,
        details: { aiSummaryRequest: true, recordCount: patientRecords.length },
      });

      const summary = await summarizePatientRecords(
        patient.name,
        patientRecords.map((r) => ({
          type: r.type,
          date: r.date,
          doctorName: r.doctorName,
          hospitalName: r.hospitalName,
          details: (r.details ?? {}) as Record<string, unknown>,
        })),
        {
          recordTypes: parsed.data.recordTypes,
          dateFrom: parsed.data.dateFrom,
          dateTo: parsed.data.dateTo,
        },
      );

      return reply.send({ patientId, patientName: patient.name, ...summary });
    },
  );

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

      const [record] = await db
        .select()
        .from(records)
        .where(eq(records.id, recordId))
        .limit(1);

      if (!record) {
        return reply.code(404).send({ error: "Record not found" });
      }

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

      const summary = await summarizeRecord(
        {
          type: record.type,
          date: record.date,
          doctorName: record.doctorName,
          hospitalName: record.hospitalName,
          details: (record.details ?? {}) as Record<string, unknown>,
        },
        parsed.data.includeHistory,
      );

      return reply.send({
        recordId,
        ...summary,
      });
    },
  );
}
