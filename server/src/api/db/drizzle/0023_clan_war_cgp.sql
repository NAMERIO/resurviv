CREATE TABLE IF NOT EXISTS "clan_war_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "clan_id" uuid NOT NULL,
    "season" integer NOT NULL DEFAULT 1,
    "opponent_clan_name" text NOT NULL DEFAULT '',
    "result" text NOT NULL DEFAULT 'win',
    "cgp_awarded" integer NOT NULL,
    "added_by_discord_id" text NOT NULL DEFAULT '',
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "clan_war_history_clan_id_clans_id_fk"
        FOREIGN KEY ("clan_id") REFERENCES "clans"("id")
        ON DELETE cascade ON UPDATE cascade
);

CREATE INDEX IF NOT EXISTS "idx_clan_war_history_clan_created"
ON "clan_war_history" ("clan_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_clan_war_history_season"
ON "clan_war_history" ("season");
