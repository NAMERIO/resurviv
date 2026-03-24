CREATE TABLE "reward_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"reward_key" text NOT NULL,
	"user_id" text NOT NULL,
	"encoded_ip" text NOT NULL,
	"granted_gp" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "reward_claims_reward_user_unique" ON "reward_claims" USING btree ("reward_key","user_id");
--> statement-breakpoint
CREATE INDEX "reward_claims_reward_ip_idx" ON "reward_claims" USING btree ("reward_key","encoded_ip");
