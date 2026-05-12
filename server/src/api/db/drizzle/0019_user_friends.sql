CREATE TABLE IF NOT EXISTS "user_friends" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "requester_user_id" text NOT NULL,
    "addressee_user_id" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "user_friends_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade,
    CONSTRAINT "user_friends_addressee_user_id_users_id_fk" FOREIGN KEY ("addressee_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade,
    CONSTRAINT "user_friends_no_self" CHECK ("requester_user_id" <> "addressee_user_id"),
    CONSTRAINT "user_friends_status_check" CHECK ("status" IN ('pending', 'accepted'))
);

CREATE INDEX IF NOT EXISTS "idx_user_friends_requester" ON "user_friends" ("requester_user_id");
CREATE INDEX IF NOT EXISTS "idx_user_friends_addressee" ON "user_friends" ("addressee_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_friends_pair" ON "user_friends" ("requester_user_id", "addressee_user_id");
