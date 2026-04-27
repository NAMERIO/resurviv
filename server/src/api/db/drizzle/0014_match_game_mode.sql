ALTER TABLE "match_data"
ADD COLUMN IF NOT EXISTS "game_mode" text NOT NULL DEFAULT 'deathmatch';

CREATE INDEX IF NOT EXISTS "idx_match_data_game_mode_query"
ON "match_data" ("game_mode", "team_mode", "map_id", "created_at");
