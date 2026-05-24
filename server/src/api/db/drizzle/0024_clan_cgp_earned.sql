ALTER TABLE "clan_member_stats"
ADD COLUMN IF NOT EXISTS "kill_cgp_milli" integer NOT NULL DEFAULT 0;

ALTER TABLE "clan_member_stats"
ADD COLUMN IF NOT EXISTS "win_cgp_milli" integer NOT NULL DEFAULT 0;

UPDATE "clan_member_stats"
SET
    "kill_cgp_milli" = ROUND("kills" * 0.25 * 10000),
    "win_cgp_milli" = ROUND("wins" * 5 * 10000)
WHERE "kill_cgp_milli" = 0
AND "win_cgp_milli" = 0
AND ("kills" > 0 OR "wins" > 0);

CREATE TABLE IF NOT EXISTS "clan_matchup_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "clan_id" uuid NOT NULL,
    "opponent_clan_id" uuid NOT NULL,
    "game_id" uuid NOT NULL,
    "season" integer NOT NULL DEFAULT 1,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "clan_matchup_history_clan_id_clans_id_fk"
        FOREIGN KEY ("clan_id") REFERENCES "clans"("id")
        ON DELETE cascade ON UPDATE cascade,
    CONSTRAINT "clan_matchup_history_opponent_clan_id_clans_id_fk"
        FOREIGN KEY ("opponent_clan_id") REFERENCES "clans"("id")
        ON DELETE cascade ON UPDATE cascade
);

CREATE INDEX IF NOT EXISTS "idx_clan_matchup_history_clan_opponent"
ON "clan_matchup_history" ("clan_id", "opponent_clan_id", "season");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_clan_matchup_history_unique"
ON "clan_matchup_history" ("clan_id", "opponent_clan_id", "game_id", "season");
