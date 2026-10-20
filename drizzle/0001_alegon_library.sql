CREATE TABLE IF NOT EXISTS alegon_library_templates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('site','menu','ad')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS alegon_library_published_type_idx ON alegon_library_templates(published,type,updated_at);
CREATE TABLE IF NOT EXISTS alegon_library_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_id TEXT,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('site','menu','ad')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS alegon_library_projects_user_idx ON alegon_library_projects(user_id,updated_at);
