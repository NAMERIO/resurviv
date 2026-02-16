-- 20260202_create_clans.sql

-- Table for clans
CREATE TABLE IF NOT EXISTS clans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    icon text NOT NULL,
    owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table for clan members
CREATE TABLE IF NOT EXISTS clan_members (
    clan_id uuid NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at timestamptz NOT NULL DEFAULT now()
);

-- Table for clan member stats
CREATE TABLE IF NOT EXISTS clan_member_stats (
    clan_id uuid NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kills integer NOT NULL DEFAULT 0,
    wins integer NOT NULL DEFAULT 0
);

-- Table for tracking when users leave clans
CREATE TABLE IF NOT EXISTS clan_leave_history (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    left_at timestamptz NOT NULL DEFAULT now()
);
