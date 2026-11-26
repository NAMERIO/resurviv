CREATE INDEX IF NOT EXISTS "idx_ip_logs_encoded_ip" ON "ip_logs" USING btree ("encoded_ip");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ip_logs_find_game_encoded_ip" ON "ip_logs" USING btree ("find_game_encoded_ip");
