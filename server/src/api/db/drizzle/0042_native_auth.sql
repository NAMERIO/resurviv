CREATE TABLE "native_auth_requests" (
    "id" text PRIMARY KEY NOT NULL,
    "provider" text NOT NULL,
    "challenge" text NOT NULL,
    "code_hash" text,
    "link_session_id" text REFERENCES "session"("id") ON DELETE CASCADE,
    "user_id" text REFERENCES "users"("id") ON DELETE CASCADE,
    "started" boolean DEFAULT false NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "error" text,
    "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "native_auth_requests_expiry_idx" ON "native_auth_requests" ("expires_at");
