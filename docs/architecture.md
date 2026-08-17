# Architecture

## Overview

MediSync is a monorepo with three applications sharing a PostgreSQL database and MinIO object storage.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Next.js   │────▶│   Fastify   │────▶│ PostgreSQL  │
│   (Web)     │     │   (API)     │     │             │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                     ┌─────▼─────┐
                     │   MinIO   │
                     │  (S3)     │
                     └───────────┘
```

## Data Model

### Users & Organizations

```
orgs
├── id (uuid, PK)
├── name (text)
├── type (hospital | org | solo)
└── created_at

users
├── id (uuid, PK)
├── name, email (unique), password_hash
├── role (patient | doctor | admin)
├── dob, phone (nullable)
├── org_id (FK → orgs, nullable for solo/personal)
└── created_at, updated_at

doctor_profile (1:1 with users where role=doctor)
├── user_id (FK → users, PK)
├── org_id (FK → orgs)
├── department, role (staff | head)
├── reports_to (FK → users, nullable)
└── verified (bool)
```

### Medical Records

Binary attachments (images, X-rays, PDFs) live in MinIO, not the database. The `records` table stores metadata only.

```
records
├── id (uuid, PK)
├── patient_id (FK → users)
├── type (prescription | lab_result | checkup | surgery | imaging | other)
├── date (date)
├── uploader_id (FK → users)
├── doctor_name, hospital_name (text, nullable)
├── details (JSONB — type-specific fields)
├── attachment_key (text — S3 object key, nullable)
├── content_type, file_size (nullable)
├── soft_deleted (bool)
├── version_of (uuid — FK to prior version, nullable)
└── created_at, updated_at
```

All edits create new versions. Originals are never overwritten.

### Access Control

```
access_requests
├── id, doctor_id, patient_id
├── scope (JSONB: { categories, date_from, date_to })
├── status (pending | approved | denied | revoked)
└── expiry (timestamp, nullable)
```

Doctors request access. Patients approve with scope (full, category, date range, or both). Either party can revoke.

### Emergency Access (Break-Glass)

```
emergency_access
├── id, doctor_id, patient_id
├── reason_code, reason_text
├── status (active | revoked | expired)
├── granted_at, expires_at (24–72h window)
└── patient_notified_at
```

No pre-approval required. Rate-limited per doctor (max 3 per 24h).

### Guardian / Proxy Control

```
guardian_link
├── id, patient_id, guardian_id
├── trigger_type (minor | advance_directive | emergency_incapacity)
├── status (pending_guardian → pending_senior → active_shared_control → sole_active)
├── authority_document_ref (required for non-minor triggers)
├── age_majority_date (auto-calculated for minors)
└── activated_at, revoked_at
```

- **Minors**: guardian has access from creation. Auto-expires at age 18.
- **Advance directive**: patient pre-authorizes a guardian for future incapacity.
- **Emergency incapacity**: reactive, requires approval chain (see below).

### Incapacity Requests

```
incapacity_request
├── id, patient_id, initiating_doctor_id
├── practice_type (hospital | org | solo)
├── proposed_guardian_id
├── guardian_approved, senior_approved (bool + timestamp)
├── legal_document_image_ref, legal_document_transcript
├── legal_document_verified (bool, nullable)
├── status (pending_guardian → pending_senior → pending_legal_review → active_shared_control)
├── reason, supporting_note
└── created_at, activated_at
```

Approval chain by context:

| Context | Required Approvals |
|---------|-------------------|
| Hospital | Doctor → Guardian → Department head |
| Org | Doctor → Guardian → Senior reviewer |
| Solo | Doctor → Guardian only |

### Deceased Patient Transfer

```
legacy_contact (patient sets in advance)
├── id, patient_id, contact_id
├── designated_at, status (active | transferred | revoked)
└── transferred_at

estate_claim (fallback, requires admin review)
├── id, patient_id, claimant_id
├── legal_document_image_ref, legal_document_transcript
├── status (pending_review | approved | denied)
└── reviewed_at, reviewer_id
```

### Audit Log

```
audit_log
├── id, actor_id, actor_role_at_time
├── action_type (record.create/read/update/delete, access.*, emergency.*, guardian.*, auth.*)
├── target_patient_id, record_id (nullable)
├── details (JSONB)
└── timestamp
```

Every access, grant, revoke, and override is logged.

## Session Auth

- Server creates a random 32-byte token, stores SHA-256 hash in `sessions` table
- Token set as httpOnly cookie (`session`), 30-day expiry
- Middleware validates cookie → hash lookup → attaches user to request

## File Storage

Binary attachments use MinIO (S3-compatible). Objects stored by UUID-prefixed filename. Presigned URLs generated for downloads (1-hour expiry).

## Notifications

Pluggable provider abstraction:
- Primary: Push (Flutter app)
- Fallback: Email (SMTP/Resend), then SMS (Twilio/MSG91)
- Push failure or unacknowledged within window triggers automatic fallback

## Frontend

Next.js App Router with client-side rendering. Pages:
- `/dashboard` — patient/doctor home
- `/records` — paginated record list
- `/records/[id]` — record detail with attachment download
- `/records/new` — add record form
- `/access-requests` — view/approve/deny/revoke
- `/access-requests/new` — request access form
- `/emergency-access` — break-glass management
- `/guardian` — guardian link management
- `/login`, `/register` — authentication

Flutter app mirrors the same features for mobile/desktop with push notification support.
