// ===== AI Diagnostic Types =====

export interface PatientInfo {
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  weight?: number;
  height?: number;
  allergies: string[];
  currentMedications: string[];
}

export interface DiagnosticInput {
  patientInfo: PatientInfo;
  symptoms: string[];
  existingConditions: string[];
  symptomDuration: string;
  severity: 'mild' | 'moderate' | 'severe';
}

export interface Diagnosis {
  id: string;
  user_id: string;
  patient_name: string;
  age: number;
  gender: string;
  weight?: number;
  height?: number;
  allergies: string[];
  current_medications: string[];
  symptoms: string[];
  existing_conditions: string[];
  symptom_duration: string;
  severity: string;
  ai_response: string | null;
  created_at: string;
}

// ===== MediSync Types =====

export type UserRole = 'patient' | 'doctor' | 'admin';

export type RecordType =
  | 'prescription'
  | 'lab_result'
  | 'checkup'
  | 'surgery'
  | 'imaging'
  | 'other';

export type AccessRequestStatus = 'pending' | 'approved' | 'denied' | 'revoked';

export type EmergencyAccessStatus = 'active' | 'revoked' | 'expired';

export type EmergencyAccessReasonCode =
  | 'cardiac_arrest'
  | 'stroke'
  | 'trauma'
  | 'unconscious'
  | 'severe_bleeding'
  | 'respiratory_failure'
  | 'sepsis'
  | 'other';

export type GuardianTriggerType = 'minor' | 'advance_directive' | 'emergency_incapacity';

export type GuardianStatus =
  | 'pending_guardian'
  | 'pending_senior'
  | 'active_shared_control'
  | 'sole_active'
  | 'denied'
  | 'revoked'
  | 'expired';

export interface MedicalRecord {
  id: string;
  patient_id: string;
  type: RecordType;
  date: string;
  doctor_name: string | null;
  hospital_name: string | null;
  details: Record<string, unknown>;
  attachment_url: string | null;
  content_type: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
}

export interface AccessRequestScope {
  categories?: string[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface AccessRequest {
  id: string;
  doctor_id: string;
  patient_id: string;
  scope: AccessRequestScope;
  status: AccessRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface AccessRequestWithUser extends AccessRequest {
  doctor_name?: string;
  doctor_email?: string;
  patient_name?: string;
  patient_email?: string;
}

export interface EmergencyAccess {
  id: string;
  doctor_id: string;
  patient_id: string;
  reason_code: EmergencyAccessReasonCode;
  reason_text: string;
  status: EmergencyAccessStatus;
  granted_at: string;
  expires_at: string;
  created_at: string;
}

export interface EmergencyAccessWithUser extends EmergencyAccess {
  doctor_name?: string;
  doctor_email?: string;
  patient_name?: string;
  patient_email?: string;
}

export interface GuardianLink {
  id: string;
  patient_id: string;
  guardian_id: string;
  trigger_type: GuardianTriggerType;
  status: GuardianStatus;
  authority_document_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuardianLinkWithUser extends GuardianLink {
  patient_name?: string;
  patient_email?: string;
  guardian_name?: string;
  guardian_email?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: UserRole;
}

export interface AuthError {
  message: string;
}
