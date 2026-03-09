CREATE TABLE "clan_leave_history" (
	"user_id" text NOT NULL,
	"left_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clan_member_stats" (
	"clan_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"kills" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clan_members" (
	"clan_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clans_name_unique" UNIQUE("name"),
	CONSTRAINT "clans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "loadout" SET DEFAULT '{"outfit":"outfitBase","melee":"fists","heal":"heal_basic","boost":"boost_basic","death_effect":"death_basic","player_icon":"","primary":"mosin","secondary":"mosin","perk":"","streak":"streak_rapid_fire","crosshair":{"type":"crosshair_default","color":16777215,"size":"1.00","stroke":"0.00"},"emotes":["emote_happyface","emote_thumbsup","emote_surviv","emote_sadface","",""]}'::json;--> statement-breakpoint
ALTER TABLE "clan_leave_history" ADD CONSTRAINT "clan_leave_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "clan_member_stats" ADD CONSTRAINT "clan_member_stats_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "clan_member_stats" ADD CONSTRAINT "clan_member_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "clans" ADD CONSTRAINT "clans_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_clan_leave_history_user" ON "clan_leave_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_clan_member_stats_clan" ON "clan_member_stats" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "idx_clan_member_stats_user" ON "clan_member_stats" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_clan_member_stats_unique" ON "clan_member_stats" USING btree ("clan_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_clan_members_clan" ON "clan_members" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "idx_clan_members_user" ON "clan_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_clan_members_unique" ON "clan_members" USING btree ("clan_id","user_id");