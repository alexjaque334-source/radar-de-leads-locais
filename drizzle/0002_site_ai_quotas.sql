-- Per-account and per-establishment DeepSeek site budget. Must be installed before enabling feature.
CREATE TABLE IF NOT EXISTS alegon_site_ai_usage (
 user_id TEXT NOT NULL,
 lead_key TEXT NOT NULL,
 project_id TEXT NOT NULL UNIQUE,
 generations INTEGER NOT NULL DEFAULT 0 CHECK(generations BETWEEN 0 AND 1),
 refinements INTEGER NOT NULL DEFAULT 0 CHECK(refinements BETWEEN 0 AND 3),
 consumed_tokens INTEGER NOT NULL DEFAULT 0,
 input_tokens INTEGER NOT NULL DEFAULT 0,
 output_tokens INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id, lead_key)
);
CREATE INDEX IF NOT EXISTS alegon_site_ai_project ON alegon_site_ai_usage(user_id,project_id);
CREATE TABLE IF NOT EXISTS alegon_site_ai_monthly (
 user_id TEXT NOT NULL,
 month TEXT NOT NULL,
 requests INTEGER NOT NULL DEFAULT 0,
 generations INTEGER NOT NULL DEFAULT 0,
 tokens INTEGER NOT NULL DEFAULT 0,
 input_tokens INTEGER NOT NULL DEFAULT 0,
 output_tokens INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,month)
);