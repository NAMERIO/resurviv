ALTER TABLE "clan_messages"
ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'user';
