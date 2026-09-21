CREATE TABLE "competitive_seasons" (
    "id" serial PRIMARY KEY,
    "name" text NOT NULL,
    "ratings" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz
);
INSERT INTO "competitive_seasons" ("name") VALUES ('Season 1');
CREATE TABLE "competitive_matches" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "season_id" integer NOT NULL REFERENCES "competitive_seasons"("id"),
    "reference" text NOT NULL,
    "request_id" text NOT NULL UNIQUE,
    "played_on" text NOT NULL,
    "teams" jsonb NOT NULL,
    "slugs" jsonb NOT NULL,
    "scores" jsonb,
    "note" text NOT NULL,
    "submitted_by" text NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "void_reason" text,
    "voided_by" text,
    "voided_at" timestamptz
);
CREATE UNIQUE INDEX "competitive_match_reference_idx" ON "competitive_matches" ("season_id", "reference") WHERE "voided_at" IS NULL;
CREATE INDEX "competitive_match_history_idx" ON "competitive_matches" ("season_id", "played_on", "created_at");
