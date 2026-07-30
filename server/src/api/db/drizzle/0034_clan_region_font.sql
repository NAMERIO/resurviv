ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "region" text DEFAULT '' NOT NULL;
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "font" text DEFAULT 'default' NOT NULL;
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "bold" boolean DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_clans_region" ON "clans" ("region");
