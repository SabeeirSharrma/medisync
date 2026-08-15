import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { records, accessRequests, emergencyAccess, guardianLink } from "../db/schema.js";
import { eq, and, or, desc, count, inArray, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { createRecordSchema } from "../lib/validation.js";
import { logAudit } from "../lib/audit.js";
import { uploadFile, getPresignedUrl, deleteFile } from "../lib/s3.js";
import { randomUUID } from "node:crypto";

export default async function recordRoutes(app: FastifyInstance) {
  // POST /api/records — create with optional file upload
  app.post("/records", { preHandler: requireAuth }, async (request, reply) => {
    const contentType = request.headers["content-type"] ?? "";

    if (contentType.includes("multipart/form-data")) {
      const parts = request.parts();
      const fields: Record<string, string> = {};
      let fileBuffer: Buffer | null = null;
      let fileName = "";
      let fileContentType = "";

      for await (const part of parts) {
        if (part.type === "file") {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          fileBuffer = Buffer.concat(chunks);
          fileName = part.filename;
          fileContentType = part.mimetype;
        } else {
          fields[part.fieldname] = await part.toString();
        }
      }

      const parsed = createRecordSchema.safeParse({
        type: fields.type,
        date: fields.date,
        doctorName: fields.doctorName,
        hospitalName: fields.hospitalName,
        details: fields.details ? JSON.parse(fields.details) : undefined,
      });

      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const user = request.user!;
      const { type, date, doctorName, hospitalName, details } = parsed.data;

      let attachmentKey: string | null = null;
      let contentType_: string | null = null;
      let fileSize: number | null = null;

      if (fileBuffer) {
        attachmentKey = `${randomUUID()}-${fileName}`;
        contentType_ = fileContentType;
        fileSize = fileBuffer.length;
        await uploadFile(attachmentKey, fileBuffer, fileContentType);
      }

      const [record] = await db
        .insert(records)
        .values({
          patientId: user.id,
          type,
          date,
          uploaderId: user.id,
          doctorName: doctorName ?? null,
          hospitalName: hospitalName ?? null,
          details: details ?? {},
          attachmentKey,
          contentType: contentType_,
          fileSize,
        })
        .returning();

      await logAudit({
        actorId: user.id,
        actorRoleAtTime: user.role,
        actionType: "record.create",
        targetPatientId: user.id,
        recordId: record.id,
        details: { type, date, hasAttachment: !!fileBuffer },
      });

      return reply.code(201).send({ record });
    }

    const parsed = createRecordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const user = request.user!;
    const { type, date, doctorName, hospitalName, details } = parsed.data;

    const [record] = await db
      .insert(records)
      .values({
        patientId: user.id,
        type,
        date,
        uploaderId: user.id,
        doctorName: doctorName ?? null,
        hospitalName: hospitalName ?? null,
        details: details ?? {},
      })
      .returning();

    await logAudit({
      actorId: user.id,
      actorRoleAtTime: user.role,
      actionType: "record.create",
      targetPatientId: user.id,
      recordId: record.id,
      details: { type, date },
    });

    return reply.code(201).send({ record });
  });

  // GET /api/records — list records (paginated)
  app.get("/records", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const query = request.query as Record<string, string | undefined>;

    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? "10", 10)));
    const offset = (page - 1) * limit;

    let whereConditions = [eq(records.softDeleted, false)];

    if (user.role === "patient") {
      whereConditions.push(eq(records.patientId, user.id));
    } else if (user.role === "doctor") {
      // Check approved access requests
      const approvedAccess = await db
        .select({ patientId: accessRequests.patientId })
        .from(accessRequests)
        .where(
          and(
            eq(accessRequests.doctorId, user.id),
            eq(accessRequests.status, "approved"),
          ),
        );

      // Check active emergency access (break-glass)
      const now = new Date();
      const emergencyAccesses = await db
        .select({ patientId: emergencyAccess.patientId })
        .from(emergencyAccess)
        .where(
          and(
            eq(emergencyAccess.doctorId, user.id),
            eq(emergencyAccess.status, "active"),
            gte(emergencyAccess.expiresAt, now),
          ),
        );

      // Check active guardian links (shared control)
      const guardianAccesses = await db
        .select({ patientId: guardianLink.patientId })
        .from(guardianLink)
        .where(
          and(
            eq(guardianLink.guardianId, user.id),
            or(
              eq(guardianLink.status, "active_shared_control"),
              eq(guardianLink.status, "sole_active"),
            ),
          ),
        );

      const approvedPatientIds = approvedAccess.map((a) => a.patientId);
      const emergencyPatientIds = emergencyAccesses.map((a) => a.patientId);
      const guardianPatientIds = guardianAccesses.map((a) => a.patientId);
      const allPatientIds = Array.from(
        new Set([...approvedPatientIds, ...emergencyPatientIds, ...guardianPatientIds]),
      );

      if (allPatientIds.length === 0) {
        return reply.send({ records: [], total: 0, page, totalPages: 0 });
      }

      whereConditions.push(inArray(records.patientId, allPatientIds));

      // Apply scope filters from approved access requests
      // Emergency access and guardian access have NO scope filtering (full access)
      for (const access of approvedAccess) {
        const [fullAccess] = await db
          .select({ scope: accessRequests.scope })
          .from(accessRequests)
          .where(
            and(
              eq(accessRequests.doctorId, user.id),
              eq(accessRequests.patientId, access.patientId),
              eq(accessRequests.status, "approved"),
            ),
          )
          .limit(1);

        if (fullAccess?.scope) {
          const scope = fullAccess.scope as {
            categories?: string[] | null;
            dateFrom?: string | null;
            dateTo?: string | null;
          };

          const hasEmergency = emergencyPatientIds.includes(access.patientId);
          const hasGuardian = guardianPatientIds.includes(access.patientId);

          // Only apply scope if NO emergency access AND NO guardian access
          if (!hasEmergency && !hasGuardian) {
            if (scope.categories && scope.categories.length > 0) {
              whereConditions.push(inArray(records.type, scope.categories as any));
            }
            if (scope.dateFrom) {
              whereConditions.push(gte(records.date, scope.dateFrom));
            }
            if (scope.dateTo) {
              whereConditions.push(lte(records.date, scope.dateTo));
            }
          }
        }
      }
    } else {
      whereConditions.push(eq(records.patientId, user.id));
    }

    const whereClause = and(...whereConditions);

    const [totalRow] = await db
      .select({ value: count() })
      .from(records)
      .where(whereClause);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    const rows = await db
      .select()
      .from(records)
      .where(whereClause)
      .orderBy(desc(records.date))
      .limit(limit)
      .offset(offset);

    return reply.send({
      records: rows,
      total,
      page,
      totalPages,
    });
  });

  // GET /api/records/:id — get a single record
  app.get("/records/:id", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const [record] = await db
      .select()
      .from(records)
      .where(eq(records.id, id))
      .limit(1);

    if (!record) {
      return reply.code(404).send({ error: "Record not found" });
    }

    if (user.role === "patient" && record.patientId !== user.id) {
      return reply.code(403).send({ error: "Access denied" });
    }

    if (user.role === "doctor") {
      // Check for active emergency access (break-glass)
      const now = new Date();
      const [emergency] = await db
        .select()
        .from(emergencyAccess)
        .where(
          and(
            eq(emergencyAccess.doctorId, user.id),
            eq(emergencyAccess.patientId, record.patientId),
            eq(emergencyAccess.status, "active"),
            gte(emergencyAccess.expiresAt, now),
          ),
        )
        .limit(1);

      if (!emergency) {
        // Check for active guardian link (shared control)
        const [guardian] = await db
          .select()
          .from(guardianLink)
          .where(
            and(
              eq(guardianLink.guardianId, user.id),
              eq(guardianLink.patientId, record.patientId),
              or(
                eq(guardianLink.status, "active_shared_control"),
                eq(guardianLink.status, "sole_active"),
              ),
            ),
          )
          .limit(1);

        if (!guardian) {
          // No guardian access — check normal approved access
          const [access] = await db
            .select()
            .from(accessRequests)
            .where(
              and(
                eq(accessRequests.doctorId, user.id),
                eq(accessRequests.patientId, record.patientId),
                eq(accessRequests.status, "approved"),
              ),
            )
            .limit(1);

          if (!access) {
            return reply.code(403).send({ error: "Access denied" });
          }

          const scope = access.scope as {
            categories?: string[] | null;
            dateFrom?: string | null;
            dateTo?: string | null;
          };

          if (scope.categories && scope.categories.length > 0) {
            if (!scope.categories.includes(record.type)) {
              return reply.code(403).send({ error: "Access denied for this record type" });
            }
          }
          if (scope.dateFrom && record.date < scope.dateFrom) {
            return reply.code(403).send({ error: "Access denied for this date range" });
          }
          if (scope.dateTo && record.date > scope.dateTo) {
            return reply.code(403).send({ error: "Access denied for this date range" });
          }
        }
        // If guardian access exists, skip scope checks (shared control = full access)
      }
      // If emergency access exists, skip scope checks (full access during emergency)
    }

    await logAudit({
      actorId: user.id,
      actorRoleAtTime: user.role,
      actionType: "record.read",
      targetPatientId: record.patientId,
      recordId: record.id,
    });

    return reply.send({ record });
  });

  // PATCH /api/records/:id — edit record (creates new version)
  app.patch("/records/:id", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const [existing] = await db
      .select()
      .from(records)
      .where(eq(records.id, id))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: "Record not found" });
    }

    if (user.role === "patient" && existing.patientId !== user.id) {
      return reply.code(403).send({ error: "Access denied" });
    }

    const parsed = createRecordSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const { type, date, doctorName, hospitalName, details } = parsed.data;

    const [newVersion] = await db
      .insert(records)
      .values({
        patientId: existing.patientId,
        type: type ?? existing.type,
        date: date ?? existing.date,
        uploaderId: user.id,
        doctorName: doctorName !== undefined ? (doctorName ?? null) : existing.doctorName,
        hospitalName: hospitalName !== undefined ? (hospitalName ?? null) : existing.hospitalName,
        details: details ?? existing.details,
        attachmentKey: existing.attachmentKey,
        contentType: existing.contentType,
        fileSize: existing.fileSize,
        versionOf: existing.id,
      })
      .returning();

    await logAudit({
      actorId: user.id,
      actorRoleAtTime: user.role,
      actionType: "record.update",
      targetPatientId: existing.patientId,
      recordId: newVersion.id,
      details: { originalId: existing.id },
    });

    return reply.send({ record: newVersion });
  });

  // DELETE /api/records/:id — soft-delete
  app.delete("/records/:id", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const [existing] = await db
      .select()
      .from(records)
      .where(eq(records.id, id))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: "Record not found" });
    }

    if (user.role === "patient" && existing.patientId !== user.id) {
      return reply.code(403).send({ error: "Access denied" });
    }

    await db
      .update(records)
      .set({ softDeleted: true, updatedAt: new Date() })
      .where(eq(records.id, id));

    await logAudit({
      actorId: user.id,
      actorRoleAtTime: user.role,
      actionType: "record.delete",
      targetPatientId: existing.patientId,
      recordId: existing.id,
    });

    return reply.send({ message: "Record deleted" });
  });

  // GET /api/records/:id/attachment — presigned URL for download
  app.get("/records/:id/attachment", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const [record] = await db
      .select()
      .from(records)
      .where(eq(records.id, id))
      .limit(1);

    if (!record) {
      return reply.code(404).send({ error: "Record not found" });
    }

    if (!record.attachmentKey) {
      return reply.code(404).send({ error: "No attachment" });
    }

    if (user.role === "patient" && record.patientId !== user.id) {
      return reply.code(403).send({ error: "Access denied" });
    }

    if (user.role === "doctor") {
      const [access] = await db
        .select()
        .from(accessRequests)
        .where(
          and(
            eq(accessRequests.doctorId, user.id),
            eq(accessRequests.patientId, record.patientId),
            eq(accessRequests.status, "approved"),
          ),
        )
        .limit(1);

      if (!access) {
        return reply.code(403).send({ error: "Access denied" });
      }
    }

    const url = await getPresignedUrl(record.attachmentKey);
    return reply.send({ url, contentType: record.contentType, fileSize: record.fileSize });
  });

  // GET /api/records/:id/versions — version history
  app.get("/records/:id/versions", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const [record] = await db
      .select()
      .from(records)
      .where(eq(records.id, id))
      .limit(1);

    if (!record) {
      return reply.code(404).send({ error: "Record not found" });
    }

    if (user.role === "patient" && record.patientId !== user.id) {
      return reply.code(403).send({ error: "Access denied" });
    }

    const rootId = record.versionOf ?? record.id;

    const versions = await db
      .select()
      .from(records)
      .where(
        eq(records.versionOf, rootId),
      )
      .orderBy(desc(records.createdAt));

    return reply.send({ versions });
  });
}
