-- Plans are granted ONLY by the superadmin. Existing accounts default to Essential.
CREATE TABLE IF NOT EXISTS alegon_user_plans(
 user_id TEXT PRIMARY KEY REFERENCES radar_users(id) ON DELETE CASCADE,
 requested_plan TEXT NOT NULL DEFAULT 'essential' CHECK(requested_plan IN ('essential','pro','premium')),
 active_plan TEXT NOT NULL DEFAULT 'essential' CHECK(active_plan IN ('essential','pro','premium')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS alegon_user_plans_active_idx ON alegon_user_plans(active_plan);
