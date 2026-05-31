ALTER TABLE "match_data"
ADD COLUMN IF NOT EXISTS "weapon_kills" json NOT NULL DEFAULT '{}';
