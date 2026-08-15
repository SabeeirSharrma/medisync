CREATE TYPE "public"."incapacity_request_status" AS ENUM('pending_guardian', 'pending_senior', 'pending_legal_review', 'active_shared_control', 'denied', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."legal_doc_verified" AS ENUM('true', 'false', 'pending');--> statement-breakpoint
CREATE TYPE "public"."practice_type" AS ENUM('hospital', 'org', 'solo');--> statement-breakpoint
CREATE TABLE "incapacity_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"initiating_doctor_id" uuid NOT NULL,
	"practice_type" "practice_type" NOT NULL,
	"proposed_guardian_id" uuid NOT NULL,
	"guardian_approved" boolean DEFAULT false NOT NULL,
	"guardian_approved_at" timestamp with time zone,
	"senior_reviewer_id" uuid,
	"senior_approved" boolean DEFAULT false NOT NULL,
	"senior_approved_at" timestamp with time zone,
	"legal_document_image_ref" text NOT NULL,
	"legal_document_transcript" text NOT NULL,
	"legal_document_verified" "legal_doc_verified" DEFAULT 'pending' NOT NULL,
	"legal_document_reviewer_id" uuid,
	"status" "incapacity_request_status" DEFAULT 'pending_guardian' NOT NULL,
	"reason" text NOT NULL,
	"supporting_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "incapacity_request" ADD CONSTRAINT "incapacity_request_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incapacity_request" ADD CONSTRAINT "incapacity_request_initiating_doctor_id_users_id_fk" FOREIGN KEY ("initiating_doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incapacity_request" ADD CONSTRAINT "incapacity_request_proposed_guardian_id_users_id_fk" FOREIGN KEY ("proposed_guardian_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incapacity_request" ADD CONSTRAINT "incapacity_request_senior_reviewer_id_users_id_fk" FOREIGN KEY ("senior_reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incapacity_request" ADD CONSTRAINT "incapacity_request_legal_document_reviewer_id_users_id_fk" FOREIGN KEY ("legal_document_reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_incapacity_request_patient" ON "incapacity_request" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_incapacity_request_doctor" ON "incapacity_request" USING btree ("initiating_doctor_id");--> statement-breakpoint
CREATE INDEX "idx_incapacity_request_status" ON "incapacity_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_incapacity_request_guardian" ON "incapacity_request" USING btree ("proposed_guardian_id");