DROP INDEX IF EXISTS "uq_items_user_type";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_items_user_type" ON "items" USING btree ("user_id","type");
