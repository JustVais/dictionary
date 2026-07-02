CREATE TYPE "public"."review_grade" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
ALTER TABLE "review_logs" ADD COLUMN "grade" "review_grade";--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "fsrs_stability" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "fsrs_difficulty" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "fsrs_state" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "fsrs_learning_steps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "last_reviewed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "words" SET
  "fsrs_state" = 2,
  "fsrs_stability" = GREATEST("srs_interval", 0.1),
  "fsrs_difficulty" = 5,
  "last_reviewed_at" = (
    SELECT MAX("reviewed_at") FROM "review_logs" WHERE "review_logs"."word_id" = "words"."id"
  )
WHERE "remembered_count" + "not_remembered_count" > 0;