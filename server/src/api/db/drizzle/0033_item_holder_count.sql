ALTER TABLE "items"
ADD COLUMN IF NOT EXISTS "holders" integer NOT NULL DEFAULT 1;

ALTER TABLE "market_listing"
ADD COLUMN IF NOT EXISTS "item_holders" integer NOT NULL DEFAULT 1;

ALTER TABLE "auction_listing"
ADD COLUMN IF NOT EXISTS "item_holders" integer NOT NULL DEFAULT 1;
