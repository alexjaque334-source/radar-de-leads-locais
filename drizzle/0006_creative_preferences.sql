-- ALEGON Criativo: user-owned visual identity and favorites; no third-party assets.
CREATE TABLE IF NOT EXISTS alegon_creative_preferences (
  user_id TEXT PRIMARY KEY REFERENCES radar_users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#5b85ff',
  secondary_color TEXT NOT NULL DEFAULT '#ffffff',
  favorites_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
