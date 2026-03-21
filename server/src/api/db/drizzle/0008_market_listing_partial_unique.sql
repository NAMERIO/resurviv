DROP INDEX IF EXISTS "uq_market_listing_active_item_per_seller";
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_market_listing_active_item_per_seller" ON "market_listing" USING btree ("seller_user_id","item_type") WHERE "status" = 'active';
