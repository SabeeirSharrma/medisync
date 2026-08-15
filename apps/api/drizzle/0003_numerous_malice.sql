CREATE TYPE "public"."emergency_access_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE "emergency_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"reason_text" text NOT NULL,
	"status" "emergency_access_status" DEFAULT 'active' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"patient_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "emergency_access" ADD CONSTRAINT "emergency_access_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_access" ADD CONSTRAINT "emergency_access_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_emergency_access_doctor" ON "emergency_access" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_emergency_access_patient" ON "emergency_access" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_emergency_access_status" ON "emergency_access" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_emergency_access_expires" ON "emergency_access" USING btree ("expires_at");