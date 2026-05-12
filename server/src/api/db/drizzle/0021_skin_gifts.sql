CREATE TABLE IF NOT EXISTS "skin_gift" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "sender_user_id" text NOT NULL,
    "recipient_user_id" text NOT NULL,
    "item_types" json NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "seen_at" timestamp with time zone,
    CONSTRAINT "skin_gift_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade,
    CONSTRAINT "skin_gift_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade,
    CONSTRAINT "skin_gift_no_self" CHECK ("sender_user_id" <> "recipient_user_id")
);

CREATE INDEX IF NOT EXISTS "idx_skin_gift_recipient_seen" ON "skin_gift" ("recipient_user_id", "seen_at");
CREATE INDEX IF NOT EXISTS "idx_skin_gift_sender" ON "skin_gift" ("sender_user_id");
