import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { records, accessRequests } from "../db/schema.js";
import { eq, and, desc, count, inArray, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { createRecordSchema } from "../lib/validation.js";
import { logAudit } from "../lib/audit.js";

export default async function recordRoutes(app: FastifyInstance) {
  // POST /api/records — create a record
  app.post("/records", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createRecordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const user = request.user!;
    if (user.role !== "patient" && user.role !== "admin") {
      return reply
        .code(403)
        .send({ error: "Only patients can create records in M0" });
    }

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
  // Patients see their own; doctors see records for patients with approved access
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
      // Doctors see records for patients with approved access
      const approvedAccess = await db
        .select({ patientId: accessRequests.patientId })
        .from(accessRequests)
        .where(
          and(
            eq(accessRequests.doctorId, user.id),
            eq(accessRequests.status, "approved"),
          ),
        );

      const patientIds = approvedAccess.map((a) => a.patientId);

      if (patientIds.length === 0) {
        return reply.send({ records: [], total: 0, page, totalPages: 0 });
      }

      whereConditions.push(inArray(records.patientId, patientIds));

      // Apply scope filters — M1 uses broadest approved scope per patient
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

    await logAudit({
      actorId: user.id,
      actorRoleAtTime: user.role,
      actionType: "record.read",
      targetPatientId: record.patientId,
      recordId: record.id,
    });

    return reply.send({ record });
  });
}
