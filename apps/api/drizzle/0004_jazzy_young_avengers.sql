CREATE TYPE "public"."guardian_status" AS ENUM('pending_guardian', 'pending_senior', 'active_shared_control', 'sole_active', 'denied', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."guardian_trigger" AS ENUM('minor', 'advance_directive', 'emergency_incapacity');--> statement-breakpoint
CREATE TABLE "guardian_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"trigger_type" "guardian_trigger" NOT NULL,
	"status" "guardian_status" DEFAULT 'pending_guardian' NOT NULL,
	"authority_document_ref" text,
	"age_majority_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "guardian_link" ADD CONSTRAINT "guardian_link_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_link" ADD CONSTRAINT "guardian_link_guardian_id_users_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_guardian_link_patient" ON "guardian_link" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_guardian_link_guardian" ON "guardian_link" USING btree ("guardian_id");--> statement-breakpoint
CREATE INDEX "idx_guardian_link_status" ON "guardian_link" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_guardian_link_trigger" ON "guardian_link" USING btree ("trigger_type");