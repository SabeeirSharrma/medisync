# API Reference

Base URL: `http://localhost:3001` (development)

All endpoints except `/api/health` require session cookie authentication.

## Auth

### POST /api/auth/register

Create a new account.

**Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string (min 8 chars)",
  "role": "patient | doctor | admin",
  "dob": "string (optional)",
  "phone": "string (optional)"
}
```

**Response:** `201`
```json
{
  "user": { "id", "name", "email", "role", "dob" }
}
```

### POST /api/auth/login

Sign in. Sets `session` cookie.

**Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** `200`
```json
{
  "user": { "id", "name", "email", "role", "dob" }
}
```

### POST /api/auth/logout

Clear session. Requires auth.

**Response:** `200` `{ "message": "Logged out" }`

### GET /api/auth/me

Get current user. Requires auth.

**Response:** `200`
```json
{
  "user": { "id", "name", "email", "role", "dob", "phone", "orgId" },
  "doctorProfile": { ... } | null
}
```

---

## Records

### POST /api/records

Create a record. Supports JSON body or `multipart/form-data` with file upload.

**JSON Body:**
```json
{
  "type": "prescription | lab_result | checkup | surgery | imaging | other",
  "date": "YYYY-MM-DD",
  "doctorName": "string (optional)",
  "hospitalName": "string (optional)",
  "details": { ... }
}
```

**Response:** `201` `{ "record": { ... } }`

### GET /api/records

List records (paginated). Patients see their own. Doctors see records for patients who granted access.

**Query:** `page=1&limit=10`

**Response:** `200`
```json
{
  "records": [...],
  "total": 42,
  "page": 1,
  "totalPages": 5
}
```

### GET /api/records/:id

Get a single record. Checks access permissions.

**Response:** `200` `{ "record": { ... } }`

### PATCH /api/records/:id

Edit a record (creates new version). Patients can edit their own.

**Body:** Same as POST, all fields optional.

**Response:** `200` `{ "record": { ... } }` (new version)

### DELETE /api/records/:id

Soft-delete a record. Sets `soft_deleted = true`.

**Response:** `200` `{ "message": "Record deleted" }`

### GET /api/records/:id/attachment

Get presigned download URL for attachment.

**Response:** `200` `{ "url": "...", "contentType": "...", "fileSize": 123 }`

### GET /api/records/:id/versions

Get version history for a record.

**Response:** `200` `{ "versions": [...] }`

### GET /api/records/export/csv

Export records as CSV. Requires auth. Opens in new browser tab.

**Query:** `type=...&dateFrom=...&dateTo=...` (optional filters)

**Response:** `200` CSV file

### GET /api/records/export/pdf

Export records as styled PDF. Requires Puppeteer + Chromium.

**Response:** `200` PDF file

---

## Access Requests

### POST /api/access-requests

Doctor requests access to a patient's records. Requires `role=doctor`.

**Body:**
```json
{
  "patientEmail": "string",
  "scope": {
    "categories": ["prescription", "lab_result"] | null,
    "dateFrom": "YYYY-MM-DD" | null,
    "dateTo": "YYYY-MM-DD" | null
  }
}
```

**Response:** `201` `{ "accessRequest": { ... } }`

### GET /api/access-requests

List access requests. Doctors see requests they sent. Patients see requests they received.

**Response:** `200` `{ "accessRequests": [...] }`

### PATCH /api/access-requests/:id/approve

Patient approves a request with scope.

**Body:**
```json
{
  "scope": {
    "categories": [...] | null,
    "dateFrom": "..." | null,
    "dateTo": "..." | null
  }
}
```

**Response:** `200` `{ "accessRequest": { ... } }`

### PATCH /api/access-requests/:id/deny

Patient denies a request.

**Response:** `200` `{ "accessRequest": { ... } }`

### PATCH /api/access-requests/:id/revoke

Patient or doctor revokes an approved request.

**Response:** `200` `{ "accessRequest": { ... } }`

---

## Emergency Access

### POST /api/emergency-access

Doctor invokes break-glass access. Requires `role=doctor`. Rate-limited (3 per 24h).

**Body:**
```json
{
  "patientEmail": "string",
  "reasonCode": "cardiac_arrest | stroke | trauma | unconscious | severe_bleeding | respiratory_failure | sepsis | other",
  "reasonText": "string (min 10 chars)"
}
```

**Response:** `201` `{ "emergencyAccess": { ... } }`

### GET /api/emergency-access

List emergency accesses. Doctors see theirs. Patients see ones on them.

**Response:** `200` `{ "emergencyAccesses": [...] }`

### PATCH /api/emergency-access/:id/revoke

Patient or admin revokes emergency access.

**Response:** `200` `{ "emergencyAccess": { ... } }`

### GET /api/emergency-access/active/:patientId

Check if a patient has active emergency access.

**Response:** `200` `{ "active": true, "emergencyAccess": { ... } }`

---

## Guardian Links

### POST /api/guardian-links

Create a guardian link. Anyone authenticated can create.

**Body:**
```json
{
  "patientEmail": "string",
  "guardianEmail": "string",
  "triggerType": "minor | advance_directive | emergency_incapacity",
  "authorityDocumentRef": "string (optional, required for non-minor)"
}
```

**Response:** `201` `{ "guardianLink": { ... } }`

### GET /api/guardian-links

List guardian links. Patients see their links. Others see links where they are the guardian.

**Response:** `200` `{ "guardianLinks": [...] }`

### PATCH /api/guardian-links/:id/status

Update guardian link status (approve, deny, revoke).

**Body:**
```json
{
  "status": "pending_senior | active_shared_control | sole_active | denied | revoked"
}
```

**Response:** `200` `{ "guardianLink": { ... } }`

### GET /api/guardian-links/active/:patientId

Check active guardian links for a patient.

**Response:** `200` `{ "guardianLinks": [...] }`

---

## Incapacity Requests

### POST /api/incapacity-requests

Doctor initiates incapacity request. Requires `role=doctor` and approved access to patient.

**Body:**
```json
{
  "patientEmail": "string",
  "proposedGuardianEmail": "string",
  "practiceType": "hospital | org | solo",
  "reason": "string (min 20 chars)",
  "supportingNote": "string (optional)",
  "legalDocumentImageRef": "string",
  "legalDocumentTranscript": "string"
}
```

**Response:** `201` `{ "incapacityRequest": { ... } }`

### GET /api/incapacity-requests

List incapacity requests. Doctors see initiated. Patients see on them. Admins see all.

**Response:** `200` `{ "incapacityRequests": [...] }`

### PATCH /api/incapacity-requests/:id/status

Update status (guardian approval, senior approval, legal review).

**Body:**
```json
{
  "status": "pending_senior | pending_legal_review | active_shared_control | denied | revoked",
  "guardianApproved": true,
  "seniorApproved": true,
  "legalDocumentVerified": "true | false"
}
```

**Response:** `200` `{ "incapacityRequest": { ... } }`

### GET /api/incapacity-requests/:id

Get single incapacity request details.

**Response:** `200` `{ "incapacityRequest": { ... } }`

---

## Deceased Patient Transfer

### POST /api/legacy-contact

Patient designates a legacy contact. Requires `role=patient`.

**Body:** `{ "contactEmail": "string" }`

**Response:** `201` `{ "legacyContact": { ... } }`

### GET /api/legacy-contact

List legacy contacts. Patients see their designations. Others see where they are the contact.

**Response:** `200` `{ "legacyContacts": [...] }`

### PATCH /api/legacy-contact/:id/status

Update status (revoke or transfer).

**Body:** `{ "status": "revoked | transferred" }`

**Response:** `200` `{ "legacyContact": { ... } }`

### POST /api/estate-claim

Claimant files an estate claim.

**Body:**
```json
{
  "patientEmail": "string",
  "legalDocumentImageRef": "string",
  "legalDocumentTranscript": "string"
}
```

**Response:** `201` `{ "estateClaim": { ... } }`

### GET /api/estate-claim

List estate claims. Admins see all. Others see their claims.

**Response:** `200` `{ "estateClaims": [...] }`

### PATCH /api/estate-claim/:id/status

Admin reviews estate claim.

**Body:** `{ "status": "approved | denied" }`

**Response:** `200` `{ "estateClaim": { ... } }`

### GET /api/deceased/:patientId

Check deceased status and transfer info.

**Response:** `200`
```json
{
  "isDeceased": true,
  "legacyContact": { ... },
  "estateClaim": { ... },
  "ownership": "legacy_contact | estate_claimant | null",
  "ownerId": "..."
}
```

---

## AI Summaries (Stub)

### POST /api/patients/:patientId/summarize

Full-history patient summary. Currently a stub returning placeholder data.

### POST /api/records/:recordId/summarize

Single-record summary. Currently a stub.

---

## Health

### GET /api/health

**Response:** `200` `{ "status": "ok" }`

---

## Error Responses

All errors follow:
```json
{
  "error": "Description of what went wrong",
  "statusCode": 400
}
```

Common status codes: 400 (validation), 401 (unauthenticated), 403 (forbidden), 404 (not found), 409 (conflict), 429 (rate limited), 500 (server error).
