ALTER TABLE "review_logs" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "translation" text;--> statement-breakpoint
CREATE UNIQUE INDEX "review_logs_client_id_idx" ON "review_logs" USING btree ("client_id");