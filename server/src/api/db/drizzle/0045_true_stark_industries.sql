CREATE TABLE "weekly_wheel_spins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rotation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"item_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weekly_wheel_spins" ADD CONSTRAINT "weekly_wheel_spins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_wheel_rotation_user_unique" ON "weekly_wheel_spins" USING btree ("rotation_id","user_id");