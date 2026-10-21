-- Monthly, server-enforced internal usage credits shared by TomTom and DeepSeek.
CREATE TABLE IF NOT EXISTS alegon_usage_credits (
 user_id TEXT NOT NULL,
 month TEXT NOT NULL,
 used INTEGER NOT NULL DEFAULT 0 CHECK(used>=0),
 discover INTEGER NOT NULL DEFAULT 0,
 details INTEGER NOT NULL DEFAULT 0,
 geocode INTEGER NOT NULL DEFAULT 0,
 generate INTEGER NOT NULL DEFAULT 0,
 refine INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,month)
);
