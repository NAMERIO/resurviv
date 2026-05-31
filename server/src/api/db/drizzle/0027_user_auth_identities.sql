CREATE TABLE IF NOT EXISTS "user_auth_identity" (
    "provider" text NOT NULL,
    "auth_id" text NOT NULL,
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_auth_identity_provider_auth"
ON "user_auth_identity" ("provider", "auth_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_auth_identity_user_provider"
ON "user_auth_identity" ("user_id", "provider");

INSERT INTO "user_auth_identity" ("provider", "auth_id", "user_id")
SELECT 'discord', "auth_id", "id"
FROM "users"
WHERE "linked_discord" = true
ON CONFLICT DO NOTHING;

INSERT INTO "user_auth_identity" ("provider", "auth_id", "user_id")
SELECT 'google', "auth_id", "id"
FROM "users"
WHERE "linked_google" = true
ON CONFLICT DO NOTHING;
