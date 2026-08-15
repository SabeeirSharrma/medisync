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
export const emergencyAccessStatusEnum = pgEnum("emergency_access_status", [
  "active",
  "revoked",
  "expired",
]);
export const guardianTriggerEnum = pgEnum("guardian_trigger", [
  "minor",
  "advance_directive",
  "emergency_incapacity",
]);
export const guardianStatusEnum = pgEnum("guardian_status", [
  "pending_guardian",
  "pending_senior",
  "active_shared_control",
  "sole_active",
  "denied",
  "revoked",
  "expired",
]);
export const incapacityRequestStatusEnum = pgEnum("incapacity_request_status", [
  "pending_guardian",
  "pending_senior",
  "pending_legal_review",
  "active_shared_control",
  "denied",
  "revoked",
]);
export const practiceTypeEnum = pgEnum("practice_type", ["hospital", "org", "solo"]);
export const legalDocVerifiedEnum = pgEnum("legal_doc_verified", ["true", "false", "pending"]);
export const legacyContactStatusEnum = pgEnum("legacy_contact_status", [
  "active",
  "transferred",
  "revoked",
]);
export const estateClaimStatusEnum = pgEnum("estate_claim_status", [
  "pending_review",
  "approved",
  "denied",
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

export const emergencyAccess = pgTable(
  "emergency_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => users.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id),
    reasonCode: text("reason_code").notNull(),
    reasonText: text("reason_text").notNull(),
    status: emergencyAccessStatusEnum("status").notNull().default("active"),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    patientNotifiedAt: timestamp("patient_notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_emergency_access_doctor").on(t.doctorId),
    index("idx_emergency_access_patient").on(t.patientId),
    index("idx_emergency_access_status").on(t.status),
    index("idx_emergency_access_expires").on(t.expiresAt),
  ],
);

export const guardianLink = pgTable(
  "guardian_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id),
    guardianId: uuid("guardian_id")
      .notNull()
      .references(() => users.id),
    triggerType: guardianTriggerEnum("trigger_type").notNull(),
    status: guardianStatusEnum("status").notNull().default("pending_guardian"),
    authorityDocumentRef: text("authority_document_ref"),
    ageMajorityDate: date("age_majority_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_guardian_link_patient").on(t.patientId),
    index("idx_guardian_link_guardian").on(t.guardianId),
    index("idx_guardian_link_status").on(t.status),
    index("idx_guardian_link_trigger").on(t.triggerType),
  ],
);

export const incapacityRequest = pgTable(
  "incapacity_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id),
    initiatingDoctorId: uuid("initiating_doctor_id")
      .notNull()
      .references(() => users.id),
    practiceType: practiceTypeEnum("practice_type").notNull(),
    proposedGuardianId: uuid("proposed_guardian_id")
      .notNull()
      .references(() => users.id),
    guardianApproved: boolean("guardian_approved").notNull().default(false),
    guardianApprovedAt: timestamp("guardian_approved_at", { withTimezone: true }),
    seniorReviewerId: uuid("senior_reviewer_id").references(() => users.id),
    seniorApproved: boolean("senior_approved").notNull().default(false),
    seniorApprovedAt: timestamp("senior_approved_at", { withTimezone: true }),
    legalDocumentImageRef: text("legal_document_image_ref").notNull(),
    legalDocumentTranscript: text("legal_document_transcript").notNull(),
    legalDocumentVerified: legalDocVerifiedEnum("legal_document_verified").notNull().default("pending"),
    legalDocumentReviewerId: uuid("legal_document_reviewer_id").references(() => users.id),
    status: incapacityRequestStatusEnum("status").notNull().default("pending_guardian"),
    reason: text("reason").notNull(),
    supportingNote: text("supporting_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_incapacity_request_patient").on(t.patientId),
    index("idx_incapacity_request_doctor").on(t.initiatingDoctorId),
    index("idx_incapacity_request_status").on(t.status),
    index("idx_incapacity_request_guardian").on(t.proposedGuardianId),
  ],
);

export const legacyContact = pgTable(
  "legacy_contact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => users.id),
    designatedAt: timestamp("designated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: legacyContactStatusEnum("status").notNull().default("active"),
    transferredAt: timestamp("transferred_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_legacy_contact_patient").on(t.patientId),
    index("idx_legacy_contact_contact").on(t.contactId),
    index("idx_legacy_contact_status").on(t.status),
  ],
);

export const estateClaim = pgTable(
  "estate_claim",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id),
    claimantId: uuid("claimant_id")
      .notNull()
      .references(() => users.id),
    legalDocumentImageRef: text("legal_document_image_ref").notNull(),
    legalDocumentTranscript: text("legal_document_transcript").notNull(),
    status: estateClaimStatusEnum("status").notNull().default("pending_review"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewerId: uuid("reviewer_id").references(() => users.id),
  },
  (t) => [
    index("idx_estate_claim_patient").on(t.patientId),
    index("idx_estate_claim_claimant").on(t.claimantId),
    index("idx_estate_claim_status").on(t.status),
  ],
);
