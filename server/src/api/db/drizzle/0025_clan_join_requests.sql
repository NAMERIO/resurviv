ALTER TABLE "clans" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;

CREATE TABLE "clan_join_requests" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "clan_id" uuid NOT NULL,
    "user_id" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "clan_join_requests" ADD CONSTRAINT "clan_join_requests_clan_id_clans_id_fk"
    FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE cascade;

ALTER TABLE "clan_join_requests" ADD CONSTRAINT "clan_join_requests_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;

CREATE INDEX "idx_clan_join_requests_clan" ON "clan_join_requests" USING btree ("clan_id");
CREATE INDEX "idx_clan_join_requests_user" ON "clan_join_requests" USING btree ("user_id");
CREATE UNIQUE INDEX "idx_clan_join_requests_unique" ON "clan_join_requests" USING btree ("clan_id","user_id");
