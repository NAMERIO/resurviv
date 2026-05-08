CREATE TABLE IF NOT EXISTS "clan_messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "clan_id" uuid NOT NULL,
    "user_id" text NOT NULL,
    "message" text NOT NULL,
    "reply_to_message_id" uuid,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "edited_at" timestamp with time zone,
    CONSTRAINT "clan_messages_clan_id_clans_id_fk"
        FOREIGN KEY ("clan_id") REFERENCES "clans"("id")
        ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "clan_messages_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE cascade ON UPDATE cascade
);

CREATE INDEX IF NOT EXISTS "idx_clan_messages_clan_created"
ON "clan_messages" ("clan_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_clan_messages_user"
ON "clan_messages" ("user_id");
