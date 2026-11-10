CREATE TABLE IF NOT EXISTS "free_fall_tickets" (
    "user_id" text PRIMARY KEY NOT NULL,
    "finder_user_id" text NOT NULL,
    "game_id" text NOT NULL,
    "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "free_fall_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "free_fall_ticket_redemptions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text NOT NULL,
    "kind" text NOT NULL,
    "seller_user_id" text,
    "reference_id" text NOT NULL,
    "gp_paid_to_seller" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "free_fall_ticket_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade,
    CONSTRAINT "free_fall_ticket_redemptions_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_free_fall_redemptions_user_created" ON "free_fall_ticket_redemptions" ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_free_fall_redemptions_user_seller" ON "free_fall_ticket_redemptions" ("user_id", "seller_user_id");
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "ticket_locked" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "market_listing" ADD COLUMN IF NOT EXISTS "seller_ip_hash" text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ip_logs_user_id" ON "ip_logs" ("user_id");
