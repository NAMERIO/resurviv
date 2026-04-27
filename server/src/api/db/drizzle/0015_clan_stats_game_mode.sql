ALTER TABLE "clan_member_stats"
ADD COLUMN IF NOT EXISTS "game_mode" text NOT NULL DEFAULT 'deathmatch';

DROP INDEX IF EXISTS "idx_clan_member_stats_unique";

CREATE INDEX IF NOT EXISTS "idx_clan_member_stats_game_mode"
ON "clan_member_stats" ("game_mode");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_clan_member_stats_unique"
ON "clan_member_stats" ("clan_id", "user_id", "game_mode");
