import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { records, accessRequests, emergencyAccess, guardianLink, users } from "../db/schema.js";
import { eq, and, inArray, gte, lte, or } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

function escapeCsv(value: string | null): string {
  if (value === null) return "";
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function recordsToCsv(rows: any[]): string {
  const headers = [
    "Type",
    "Date",
    "Doctor",
    "Hospital",
    "Details",
    "Created",
  ];

  const lines = [headers.join(",")];

  for (const row of rows) {
    const details = row.details ? JSON.stringify(row.details) : "";
    lines.push(
      [
        escapeCsv(row.type),
        escapeCsv(row.date),
        escapeCsv(row.doctorName),
        escapeCsv(row.hospitalName),
        escapeCsv(details),
        escapeCsv(new Date(row.createdAt).toISOString()),
      ].join(","),
    );
  }

  return lines.join("\n");
}

async function getAccessibleRecords(
  userId: string,
  role: string,
  filters: {
    type?: string;
    dateFrom?: string;
    dateTo?: string;
  },
) {
  const conditions = [eq(records.softDeleted, false)];

  if (role === "patient") {
    conditions.push(eq(records.patientId, userId));
  } else if (role === "doctor") {
    const approvedAccess = await db
      .select({ patientId: accessRequests.patientId })
      .from(accessRequests)
      .where(
        and(
          eq(accessRequests.doctorId, userId),
          eq(accessRequests.status, "approved"),
        ),
      );

    const now = new Date();
    const emergencyAccesses = await db
      .select({ patientId: emergencyAccess.patientId })
      .from(emergencyAccess)
      .where(
        and(
          eq(emergencyAccess.doctorId, userId),
          eq(emergencyAccess.status, "active"),
          gte(emergencyAccess.expiresAt, now),
        ),
      );

    const guardianAccesses = await db
      .select({ patientId: guardianLink.patientId })
      .from(guardianLink)
      .where(
        and(
          eq(guardianLink.guardianId, userId),
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

    if (allPatientIds.length === 0) return [];
    conditions.push(inArray(records.patientId, allPatientIds));
  } else {
    conditions.push(eq(records.patientId, userId));
  }

  if (filters.type) {
    conditions.push(eq(records.type, filters.type as any));
  }
  if (filters.dateFrom) {
    conditions.push(gte(records.date, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(records.date, filters.dateTo));
  }

  return db.select().from(records).where(and(...conditions));
}

export default async function exportRoutes(app: FastifyInstance) {
  // GET /api/records/export/csv — export records as CSV
  app.get("/records/export/csv", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const query = request.query as Record<string, string | undefined>;

    const rows = await getAccessibleRecords(user.id, user.role, {
      type: query.type,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    await logAudit({
      actorId: user.id,
      actorRoleAtTime: user.role,
      actionType: "record.read",
      targetPatientId: user.id,
      details: { export: "csv", count: rows.length },
    });

    const csv = recordsToCsv(rows);

    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", `attachment; filename="medisync-records-${new Date().toISOString().slice(0, 10)}.csv"`);
    return reply.send(csv);
  });

  // GET /api/records/export/pdf — export records as styled PDF
  app.get("/records/export/pdf", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const query = request.query as Record<string, string | undefined>;

    const rows = await getAccessibleRecords(user.id, user.role, {
      type: query.type,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    await logAudit({
      actorId: user.id,
      actorRoleAtTime: user.role,
      actionType: "record.read",
      targetPatientId: user.id,
      details: { export: "pdf", count: rows.length },
    });

    const html = buildPdfHtml(user, rows);

    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" as any });
      const pdf = await page.pdf({
        format: "A4",
        margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
        printBackground: true,
      });

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="medisync-records-${new Date().toISOString().slice(0, 10)}.pdf"`);
      return reply.send(pdf);
    } finally {
      await browser.close();
    }
  });
}

function buildPdfHtml(
  user: { name: string; email: string },
  rows: any[],
): string {
  const recordRows = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.type.replace("_", " "))}</td>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.doctorName ?? "—")}</td>
        <td>${escapeHtml(r.hospitalName ?? "—")}</td>
        <td>${escapeHtml(r.details ? JSON.stringify(r.details) : "")}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; font-size: 12px; line-height: 1.5; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: #2563eb; font-weight: 700; }
    .header p { color: #6b7280; font-size: 11px; margin-top: 4px; }
    .meta { display: flex; gap: 32px; margin-bottom: 24px; font-size: 11px; color: #6b7280; }
    .meta span { display: block; }
    .meta strong { color: #1f2937; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #f3f4f6; text-align: left; padding: 8px 12px; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
    .empty { text-align: center; padding: 48px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="header">
    <h1>MediSync</h1>
    <p>Patient-controlled electronic health records</p>
  </div>
  <div class="meta">
    <div><strong>Patient:</strong> ${escapeHtml(user.name)}</div>
    <div><strong>Email:</strong> ${escapeHtml(user.email)}</div>
    <div><strong>Generated:</strong> ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
    <div><strong>Records:</strong> ${rows.length}</div>
  </div>
  ${rows.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Type</th>
        <th>Date</th>
        <th>Doctor</th>
        <th>Hospital</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>
      ${recordRows}
    </tbody>
  </table>
  ` : '<div class="empty">No records to export.</div>'}
  <div class="footer">
    Generated by MediSync &mdash; ${new Date().toISOString().slice(0, 10)}
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
