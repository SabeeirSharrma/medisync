CREATE TYPE "public"."estate_claim_status" AS ENUM('pending_review', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."legacy_contact_status" AS ENUM('active', 'transferred', 'revoked');--> statement-breakpoint
CREATE TABLE "estate_claim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"claimant_id" uuid NOT NULL,
	"legal_document_image_ref" text NOT NULL,
	"legal_document_transcript" text NOT NULL,
	"status" "estate_claim_status" DEFAULT 'pending_review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewer_id" uuid
);
--> statement-breakpoint
CREATE TABLE "legacy_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"designated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "legacy_contact_status" DEFAULT 'active' NOT NULL,
	"transferred_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "estate_claim" ADD CONSTRAINT "estate_claim_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_claim" ADD CONSTRAINT "estate_claim_claimant_id_users_id_fk" FOREIGN KEY ("claimant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_claim" ADD CONSTRAINT "estate_claim_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_contact" ADD CONSTRAINT "legacy_contact_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_contact" ADD CONSTRAINT "legacy_contact_contact_id_users_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_estate_claim_patient" ON "estate_claim" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_estate_claim_claimant" ON "estate_claim" USING btree ("claimant_id");--> statement-breakpoint
CREATE INDEX "idx_estate_claim_status" ON "estate_claim" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_legacy_contact_patient" ON "legacy_contact" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_legacy_contact_contact" ON "legacy_contact" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_legacy_contact_status" ON "legacy_contact" USING btree ("status");