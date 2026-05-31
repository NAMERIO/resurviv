ALTER TABLE "match_data"
ADD COLUMN IF NOT EXISTS "weapon_deaths" json NOT NULL DEFAULT '{}';

ALTER TABLE "match_data"
ADD COLUMN IF NOT EXISTS "weapon_damage_dealt" json NOT NULL DEFAULT '{}';

ALTER TABLE "match_data"
ADD COLUMN IF NOT EXISTS "weapon_damage_taken" json NOT NULL DEFAULT '{}';
