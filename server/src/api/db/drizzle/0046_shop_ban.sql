ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "shop_banned" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "shop_ban_reason" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "shop_banned_by" text DEFAULT '' NOT NULL;
