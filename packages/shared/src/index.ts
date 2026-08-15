export type UserRole = "patient" | "doctor" | "admin";
export type OrgType = "hospital" | "org" | "solo";
export type DoctorRole = "staff" | "head";
export type RecordType =
  | "prescription"
  | "lab_result"
  | "checkup"
  | "surgery"
  | "imaging"
  | "other";
export type AccessRequestStatus =
  | "pending"
  | "approved"
  | "denied"
  | "revoked";
export type AuditAction =
  | "record.create"
  | "record.read"
  | "record.update"
  | "record.delete"
  | "access.request"
  | "access.grant"
  | "access.revoke"
  | "emergency.access"
  | "emergency.revoke"
  | "guardian.grant"
  | "guardian.revoke"
  | "auth.login"
  | "auth.logout";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  dob: string | null;
  phone: string | null;
  orgId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Org {
  id: string;
  name: string;
  type: OrgType;
  createdAt: Date;
}

export interface DoctorProfile {
  userId: string;
  orgId: string | null;
  department: string | null;
  role: DoctorRole;
  reportsTo: string | null;
  verified: boolean;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  type: RecordType;
  date: string;
  uploaderId: string;
  doctorName: string | null;
  hospitalName: string | null;
  details: Record<string, unknown>;
  attachmentKey: string | null;
  contentType: string | null;
  fileSize: number | null;
  softDeleted: boolean;
  versionOf: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRoleAtTime: string;
  actionType: AuditAction;
  targetPatientId: string | null;
  recordId: string | null;
  timestamp: Date;
  details: Record<string, unknown>;
}

export interface ApiError {
  error: string;
  statusCode: number;
}

// Auth contract
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  dob?: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    dob: string | null;
  };
}

// Records contract
export interface CreateRecordRequest {
  type: RecordType;
  date: string;
  doctorName?: string;
  hospitalName?: string;
  details?: Record<string, unknown>;
}

export interface ListRecordsQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedRecords {
  records: MedicalRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AccessRequestScope {
  categories?: string[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface AccessRequest {
  id: string;
  doctorId: string;
  patientId: string;
  scope: AccessRequestScope;
  status: AccessRequestStatus;
  expiry: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessRequestWithUser extends AccessRequest {
  doctorName?: string;
  doctorEmail?: string;
  patientName?: string;
  patientEmail?: string;
}

export interface CreateAccessRequestRequest {
  patientEmail: string;
  scope?: AccessRequestScope;
}

export interface ApproveAccessRequestRequest {
  scope: AccessRequestScope;
}
