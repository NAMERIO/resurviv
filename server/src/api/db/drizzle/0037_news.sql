CREATE TABLE IF NOT EXISTS "news" (
    "id" serial PRIMARY KEY,
    "title" text NOT NULL,
    "content" text NOT NULL,
    "date_text" text,
    "document" jsonb,
    "author_user_id" text,
    "published_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "is_published" boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "idx_news_published_at" ON "news" ("published_at");
