CREATE TABLE IF NOT EXISTS line_user (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id      TEXT    NOT NULL,
  line_user_id    TEXT    NOT NULL,
  app_user_id     INTEGER REFERENCES users(id),
  role            TEXT    NOT NULL DEFAULT 'resident',
  display_name    TEXT,
  picture_url     TEXT,
  language        TEXT    DEFAULT 'zh-TW',
  is_demo         INTEGER NOT NULL DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel_id, line_user_id)
);
CREATE INDEX IF NOT EXISTS idx_line_user_role ON line_user(role);

CREATE TABLE IF NOT EXISTS line_message_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id    TEXT    NOT NULL,
  direction       TEXT    NOT NULL,
  message_type    TEXT    NOT NULL,
  content         TEXT,
  intent          TEXT,
  session_id      TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_line_message_log_user_time
  ON line_message_log(line_user_id, created_at);
