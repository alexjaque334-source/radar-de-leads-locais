CREATE TABLE IF NOT EXISTS alegon_openrouter_monthly (
 user_id TEXT NOT NULL,
 month TEXT NOT NULL,
 menu_calls INTEGER NOT NULL DEFAULT 0,
 image_calls INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,month)
);