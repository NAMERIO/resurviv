CREATE TABLE "weekly_melee_purchases" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "rotation_id" text NOT NULL,
    "user_id" text NOT NULL,
    "item_type" text NOT NULL,
    "price" integer NOT NULL,
    "slot" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "weekly_melee_slot_check"
        CHECK ("slot" BETWEEN 1 AND 7)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_melee_rotation_user_unique"
    ON "weekly_melee_purchases" USING btree ("rotation_id", "user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_melee_rotation_slot_unique"
    ON "weekly_melee_purchases" USING btree ("rotation_id", "slot");