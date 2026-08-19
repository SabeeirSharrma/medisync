import { pgTable, text, uuid, timestamp, jsonb, integer, date, numeric } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  username: text("username"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("patient"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  username: text("username"),
  role: text("role").default("patient"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const diagnoses = pgTable("diagnoses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  patientName: text("patient_name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  weight: numeric("weight"),
  height: numeric("height"),
  allergies: jsonb("allergies").default([]),
  currentMedications: jsonb("current_medications").default([]),
  symptoms: jsonb("symptoms").notNull().default([]),
  existingConditions: jsonb("existing_conditions").default([]),
  symptomDuration: text("symptom_duration"),
  severity: text("severity").notNull().default("mild"),
  aiResponse: text("ai_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const records = pgTable("records", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  date: date("date").notNull(),
  doctorName: text("doctor_name"),
  hospitalName: text("hospital_name"),
  details: jsonb("details").default({}),
  attachmentUrl: text("attachment_url"),
  contentType: text("content_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const accessRequests = pgTable("access_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scope: jsonb("scope").default({}),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const emergencyAccess = pgTable("emergency_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reasonCode: text("reason_code").notNull(),
  reasonText: text("reason_text").notNull(),
  status: text("status").notNull().default("active"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const guardianLinks = pgTable("guardian_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  guardianId: uuid("guardian_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  triggerType: text("trigger_type").notNull(),
  status: text("status").notNull().default("pending_guardian"),
  authorityDocumentRef: text("authority_document_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").notNull(),
  actorRoleAtTime: text("actor_role_at_time"),
  actionType: text("action_type").notNull(),
  targetPatientId: uuid("target_patient_id"),
  recordId: uuid("record_id"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  details: jsonb("details"),
});
