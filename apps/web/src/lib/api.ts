const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

async function uploadFile(path: string, formData: FormData) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  register: (email: string, password: string, username?: string, role?: string) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, username, role }) }),

  logout: () => request("/api/auth/logout", { method: "POST" }),

  getMe: () => request("/api/auth/me"),

  // Records
  getRecords: () => request("/api/records").then((d) => d.records),

  getRecord: (id: string) => request(`/api/records/${id}`).then((d) => d.record),

  createRecord: (data: Record<string, unknown>) =>
    request("/api/records", { method: "POST", body: JSON.stringify(data) }).then((d) => d.record),

  deleteRecord: (id: string) => request(`/api/records/${id}`, { method: "DELETE" }),

  uploadRecordFile: (recordId: string, formData: FormData) =>
    uploadFile(`/api/records/${recordId}/upload`, formData),

  // Diagnoses
  getDiagnoses: () => request("/api/diagnoses").then((d) => d.diagnoses),

  getDiagnosis: (id: string) => request(`/api/diagnoses/${id}`).then((d) => d.diagnosis),

  createDiagnosis: (data: unknown) =>
    request("/api/diagnoses", { method: "POST", body: JSON.stringify(data) }).then((d) => d.diagnosis),

  deleteDiagnosis: (id: string) => request(`/api/diagnoses/${id}`, { method: "DELETE" }),

  // Access Requests
  getAccessRequests: () => request("/api/access-requests").then((d) => d.accessRequests),

  createAccessRequest: (data: Record<string, unknown>) =>
    request("/api/access-requests", { method: "POST", body: JSON.stringify(data) }).then((d) => d.accessRequest),

  updateAccessRequest: (id: string, status: string) =>
    request(`/api/access-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).then((d) => d.accessRequest),

  // Emergency Access
  getEmergencyAccess: () => request("/api/emergency-access").then((d) => d.emergencyAccess),

  createEmergencyAccess: (data: Record<string, unknown>) =>
    request("/api/emergency-access", { method: "POST", body: JSON.stringify(data) }).then((d) => d.emergencyAccess),

  updateEmergencyAccess: (id: string, status: string) =>
    request(`/api/emergency-access/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).then((d) => d.emergencyAccess),

  // Guardian Links
  getGuardianLinks: () => request("/api/guardian-links").then((d) => d.guardianLinks),

  createGuardianLink: (data: Record<string, unknown>) =>
    request("/api/guardian-links", { method: "POST", body: JSON.stringify(data) }).then((d) => d.guardianLink),

  updateGuardianLink: (id: string, status: string) =>
    request(`/api/guardian-links/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).then((d) => d.guardianLink),

  // Email Verification
  sendVerification: () =>
    request("/api/auth/verify/send", { method: "POST" }),

  confirmVerification: (token: string) =>
    request("/api/auth/verify/confirm", { method: "POST", body: JSON.stringify({ token }) }),

  getVerificationStatus: () =>
    request("/api/auth/verify/status"),

  // Password Reset
  requestPasswordReset: (email: string) =>
    request("/api/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }),

  confirmPasswordReset: (token: string, password: string) =>
    request("/api/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password }) }),
};
