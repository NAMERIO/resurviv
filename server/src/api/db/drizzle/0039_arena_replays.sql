CREATE TABLE IF NOT EXISTS "arena_replays" (
    "game_id" uuid PRIMARY KEY NOT NULL,
    "lobby_code" text NOT NULL,
    "region" text NOT NULL,
    "map_name" text NOT NULL,
    "mini_game" text NOT NULL,
    "team_mode" integer NOT NULL,
    "duration_ms" integer NOT NULL,
    "player_count" integer NOT NULL,
    "spectator_count" integer NOT NULL,
    "replay_version" integer NOT NULL,
    "protocol_version" integer NOT NULL,
    "object_key" text NOT NULL,
    "size_bytes" integer NOT NULL,
    "compressed_size_bytes" integer NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "expires_at" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "arena_replays_lobby_created_idx"
    ON "arena_replays" ("lobby_code", "created_at");
CREATE INDEX IF NOT EXISTS "arena_replays_expires_idx"
    ON "arena_replays" ("expires_at");

CREATE TABLE IF NOT EXISTS "arena_replay_participants" (
    "game_id" uuid NOT NULL REFERENCES "arena_replays"("game_id") ON DELETE CASCADE,
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "player_name" text NOT NULL,
    "spectator" boolean NOT NULL,
    PRIMARY KEY ("game_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "arena_replay_participants_user_idx"
    ON "arena_replay_participants" ("user_id");
