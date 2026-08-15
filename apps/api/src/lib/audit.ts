import { db } from "../db/index.js";
import { auditLog, auditActionEnum } from "../db/schema.js";

type AuditAction = (typeof auditActionEnum.enumValues)[number];

interface AuditEntry {
  actorId: string;
  actorRoleAtTime: string;
  actionType: AuditAction;
  targetPatientId?: string | null;
  recordId?: string | null;
  details?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    actorRoleAtTime: entry.actorRoleAtTime,
    actionType: entry.actionType,
    targetPatientId: entry.targetPatientId ?? null,
    recordId: entry.recordId ?? null,
    details: entry.details ?? {},
  });
}
