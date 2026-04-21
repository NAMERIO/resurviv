CREATE TABLE "auction_listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_user_id" text NOT NULL,
	"highest_bid_user_id" text,
	"item_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"start_price" integer NOT NULL,
	"highest_bid" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sold_at" timestamp with time zone,
	"canceled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auction_bid" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"bidder_user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auction_listing" ADD CONSTRAINT "auction_listing_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "auction_listing" ADD CONSTRAINT "auction_listing_highest_bid_user_id_users_id_fk" FOREIGN KEY ("highest_bid_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "auction_bid" ADD CONSTRAINT "auction_bid_auction_id_auction_listing_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auction_listing"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "auction_bid" ADD CONSTRAINT "auction_bid_bidder_user_id_users_id_fk" FOREIGN KEY ("bidder_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "idx_auction_listing_status_created" ON "auction_listing" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX "idx_auction_listing_seller_status" ON "auction_listing" USING btree ("seller_user_id","status");
--> statement-breakpoint
CREATE INDEX "idx_auction_listing_item_status" ON "auction_listing" USING btree ("item_id","status");
--> statement-breakpoint
CREATE INDEX "idx_auction_bid_auction_created" ON "auction_bid" USING btree ("auction_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_auction_bid_bidder_created" ON "auction_bid" USING btree ("bidder_user_id","created_at");
