ALTER TABLE "items" ADD COLUMN "id" uuid;
--> statement-breakpoint
UPDATE "items" SET "id" = gen_random_uuid() WHERE "id" IS NULL;
--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_id_pk" PRIMARY KEY ("id");
--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "market_listing" ADD COLUMN "item_id" uuid;
--> statement-breakpoint
UPDATE "market_listing" SET "item_id" = gen_random_uuid() WHERE "item_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "market_listing" ALTER COLUMN "item_id" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "uq_market_listing_active_item_per_seller";
--> statement-breakpoint
CREATE INDEX "idx_market_listing_item_status" ON "market_listing" USING btree ("item_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_market_listing_active_item" ON "market_listing" USING btree ("item_id") WHERE "status" = 'active';
