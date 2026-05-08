ALTER TABLE "clan_messages"
ADD COLUMN IF NOT EXISTS "reply_to_message_id" uuid;

ALTER TABLE "clan_messages"
ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;
