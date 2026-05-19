ALTER TABLE "clan_member_stats"
ADD COLUMN IF NOT EXISTS "season" integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "idx_clan_member_stats_season"
ON "clan_member_stats" ("season");

DROP INDEX IF EXISTS "idx_clan_member_stats_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_clan_member_stats_unique"
ON "clan_member_stats" ("clan_id", "user_id", "game_mode", "season");

CREATE TABLE IF NOT EXISTS "clan_season_members" (
    "clan_id" uuid NOT NULL,
    "user_id" text NOT NULL,
    "season" integer NOT NULL,
    "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
    "left_at" timestamp with time zone,
    CONSTRAINT "clan_season_members_clan_id_clans_id_fk"
        FOREIGN KEY ("clan_id") REFERENCES "clans"("id")
        ON DELETE cascade ON UPDATE cascade,
    CONSTRAINT "clan_season_members_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE cascade ON UPDATE cascade
);

CREATE INDEX IF NOT EXISTS "idx_clan_season_members_clan"
ON "clan_season_members" ("clan_id");

CREATE INDEX IF NOT EXISTS "idx_clan_season_members_user"
ON "clan_season_members" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_clan_season_members_season"
ON "clan_season_members" ("season");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_clan_season_members_unique"
ON "clan_season_members" ("clan_id", "user_id", "season");

INSERT INTO "clan_season_members" ("clan_id", "user_id", "season", "joined_at")
SELECT "clan_id", "user_id", 1, "joined_at"
FROM "clan_members"
ON CONFLICT DO NOTHING;
