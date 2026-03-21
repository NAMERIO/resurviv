ALTER TABLE "users" ADD COLUMN "gp_balance" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "market_listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_user_id" text NOT NULL,
	"buyer_user_id" text,
	"item_type" text NOT NULL,
	"price" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sold_at" timestamp with time zone,
	"canceled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "market_listing" ADD CONSTRAINT "market_listing_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "market_listing" ADD CONSTRAINT "market_listing_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "idx_market_listing_status_created" ON "market_listing" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX "idx_market_listing_seller_status" ON "market_listing" USING btree ("seller_user_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_market_listing_active_item_per_seller" ON "market_listing" USING btree ("seller_user_id","item_type","status");
