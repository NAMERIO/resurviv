CREATE TABLE IF NOT EXISTS "tournament_bets" (
    "id" serial PRIMARY KEY NOT NULL,
    "tournament_id" integer DEFAULT 1 NOT NULL,
    "user_id" text NOT NULL,
    "match_id" integer NOT NULL,
    "market" text NOT NULL,
    "selection" text NOT NULL,
    "odds_hundredths" integer NOT NULL,
    "amount" integer NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "payout" integer DEFAULT 0 NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "settled_at" timestamptz,
    CONSTRAINT "tournament_bets_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "tournament_bets_amount_check" CHECK ("amount" BETWEEN 250 AND 2500),
    CONSTRAINT "tournament_bets_odds_check" CHECK ("odds_hundredths" BETWEEN 100 AND 500),
    CONSTRAINT "tournament_bets_status_check" CHECK ("status" IN ('pending', 'won', 'lost'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "tournament_bets_user_match_market_key"
    ON "tournament_bets" ("tournament_id", "user_id", "match_id", "market");

CREATE TABLE IF NOT EXISTS "tournament_bet_settlements" (
    "tournament_id" integer DEFAULT 1 NOT NULL,
    "match_id" integer NOT NULL,
    "grenade_kills" integer NOT NULL,
    "heal_off" boolean NOT NULL,
    "settled_by" text NOT NULL,
    "settled_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "tournament_bet_settlements_pkey"
        PRIMARY KEY ("tournament_id", "match_id"),
    CONSTRAINT "tournament_bet_settlements_settled_by_fkey"
        FOREIGN KEY ("settled_by") REFERENCES "users"("id"),
    CONSTRAINT "tournament_bet_settlements_grenade_kills_check" CHECK ("grenade_kills" >= 0)
);
