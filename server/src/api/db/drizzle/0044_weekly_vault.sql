CREATE TABLE IF NOT EXISTS "weekly_wheel_spins" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "rotation_id" text NOT NULL,
    "user_id" text NOT NULL,
    "item_type" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "weekly_wheel_spins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_wheel_rotation_user_unique" ON "weekly_wheel_spins" USING btree ("rotation_id","user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_melee_purchases" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "rotation_id" text NOT NULL,
    "user_id" text NOT NULL,
    "item_type" text NOT NULL,
    "price" integer NOT NULL,
    "slot" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "weekly_melee_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade,
    CONSTRAINT "weekly_melee_slot_check" CHECK ("slot" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_melee_rotation_user_unique" ON "weekly_melee_purchases" USING btree ("rotation_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_melee_rotation_slot_unique" ON "weekly_melee_purchases" USING btree ("rotation_id","slot");
