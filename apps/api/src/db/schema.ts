import {
  pgTable,
  pgEnum,
  uuid,
  text,
  date,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["patient", "doctor", "admin"]);
export const orgTypeEnum = pgEnum("org_type", ["hospital", "org", "solo"]);
export const doctorRoleEnum = pgEnum("doctor_role", ["staff", "head"]);
export const recordTypeEnum = pgEnum("record_type", [
  "prescription",
  "lab_result",
  "checkup",
  "surgery",
  "imaging",
  "other",
]);
export const auditActionEnum = pgEnum("audit_action", [
  "record.create",
  "record.read",
  "record.update",
  "record.delete",
  "access.request",
  "access.grant",
  "access.revoke",
  "emergency.access",
  "emergency.revoke",
  "guardian.grant",
  "guardian.revoke",
  "auth.login",
  "auth.logout",
]);
export const accessRequestStatusEnum = pgEnum("access_request_status", [
  "pending",
  "approved",
  "denied",
  "revoked",
]);

// ── Tables ─────────────────────────────────────────────────────────────────

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: orgTypeEnum("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  dob: date("dob"),
  phone: text("phone"),
  orgId: uuid("org_id").references(() => orgs.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const doctorProfile = pgTable("doctor_profile", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").references(() => orgs.id),
  department: text("department"),
  role: doctorRoleEnum("role").notNull().default("staff"),
  reportsTo: uuid("reports_to").references(() => users.id),
  verified: boolean("verified").notNull().default(false),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("idx_sessions_user_id").on(t.userId),
    index("idx_sessions_expires").on(t.expiresAt),
  ],
);

export const records = pgTable(
  "records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: recordTypeEnum("type").notNull(),
    date: date("date").notNull(),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => users.id),
    doctorName: text("doctor_name"),
    hospitalName: text("hospital_name"),
    details: jsonb("details").notNull().default({}),
    attachmentKey: text("attachment_key"),
    contentType: text("content_type"),
    fileSize: integer("file_size"),
    softDeleted: boolean("soft_deleted").notNull().default(false),
    versionOf: uuid("version_of"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_records_patient_date").on(t.patientId, t.date)],
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  actorRoleAtTime: text("actor_role_at_time").notNull(),
  actionType: auditActionEnum("action_type").notNull(),
  targetPatientId: uuid("target_patient_id").references(() => users.id),
  recordId: uuid("record_id"),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
  details: jsonb("details").notNull().default({}),
});

export const accessRequests = pgTable(
  "access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => users.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id),
    scope: jsonb("scope").notNull().default({}),
    status: accessRequestStatusEnum("status").notNull().default("pending"),
    expiry: timestamp("expiry", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_access_requests_doctor").on(t.doctorId),
    index("idx_access_requests_patient").on(t.patientId),
    index("idx_access_requests_status").on(t.status),
  ],
);
