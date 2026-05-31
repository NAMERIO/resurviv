ALTER TABLE "items"
ADD COLUMN IF NOT EXISTS "maker" text NOT NULL DEFAULT 'Unknown',
ADD COLUMN IF NOT EXISTS "kills" integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "wins" integer NOT NULL DEFAULT 0;

ALTER TABLE "market_listing"
ADD COLUMN IF NOT EXISTS "item_maker" text NOT NULL DEFAULT 'Unknown',
ADD COLUMN IF NOT EXISTS "item_kills" integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "item_wins" integer NOT NULL DEFAULT 0;

ALTER TABLE "auction_listing"
ADD COLUMN IF NOT EXISTS "item_maker" text NOT NULL DEFAULT 'Unknown',
ADD COLUMN IF NOT EXISTS "item_kills" integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "item_wins" integer NOT NULL DEFAULT 0;

UPDATE "items"
SET "maker" = COALESCE("users"."username", 'Unknown')
FROM "users"
WHERE "items"."user_id" = "users"."id"
AND "items"."maker" = 'Unknown';

CREATE OR REPLACE FUNCTION set_item_maker()
RETURNS trigger AS $$
BEGIN
    IF NEW.maker IS NULL OR NEW.maker = 'Unknown' THEN
        SELECT COALESCE(username, 'Unknown')
        INTO NEW.maker
        FROM users
        WHERE id = NEW.user_id;

        NEW.maker := COALESCE(NEW.maker, 'Unknown');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_item_maker_on_insert ON "items";

CREATE TRIGGER set_item_maker_on_insert
BEFORE INSERT ON "items"
FOR EACH ROW
EXECUTE FUNCTION set_item_maker();
