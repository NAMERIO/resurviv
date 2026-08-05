CREATE TABLE IF NOT EXISTS "tournament_bracket_state" (
    "id" integer PRIMARY KEY,
    "state" jsonb NOT NULL,
    "updated_at" timestamptz NOT NULL DEFAULT now()
);
