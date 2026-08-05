CREATE TABLE IF NOT EXISTS "tournament_predictions" (
    "tournament_id" integer NOT NULL DEFAULT 1,
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "match_id" integer NOT NULL CHECK ("match_id" BETWEEN 0 AND 30),
    "predicted_player" text NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("tournament_id", "user_id", "match_id")
);

CREATE TABLE IF NOT EXISTS "tournament_prediction_rewards" (
    "tournament_id" integer NOT NULL DEFAULT 1,
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "gp_awarded" integer NOT NULL DEFAULT 5000,
    "awarded_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("tournament_id", "user_id")
);
