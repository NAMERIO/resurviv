CREATE TABLE IF NOT EXISTS "coinflip_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "challenger_user_id" text NOT NULL,
    "opponent_user_id" text NOT NULL,
    "winner_user_id" text NOT NULL,
    "loser_user_id" text NOT NULL,
    "bet" integer NOT NULL,
    "coin_result" text NOT NULL,
    "opponent_pick" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
    ALTER TABLE "coinflip_history" ADD CONSTRAINT "coinflip_history_challenger_user_id_users_id_fk" FOREIGN KEY ("challenger_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "coinflip_history" ADD CONSTRAINT "coinflip_history_opponent_user_id_users_id_fk" FOREIGN KEY ("opponent_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "coinflip_history" ADD CONSTRAINT "coinflip_history_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "coinflip_history" ADD CONSTRAINT "coinflip_history_loser_user_id_users_id_fk" FOREIGN KEY ("loser_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_coinflip_history_challenger_created" ON "coinflip_history" ("challenger_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_coinflip_history_opponent_created" ON "coinflip_history" ("opponent_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_coinflip_history_winner" ON "coinflip_history" ("winner_user_id");
CREATE INDEX IF NOT EXISTS "idx_coinflip_history_loser" ON "coinflip_history" ("loser_user_id");
