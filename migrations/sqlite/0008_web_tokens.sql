-- Personal web tokens issued to LINE users on `follow`. Each LINE friend gets a
-- unique token that auths their private resident view in the web app. Demo
-- shared tokens (WEB_RESIDENT_TOKEN/WEB_LOGISTICS_TOKEN/WEB_ADMIN_TOKEN) still
-- work via env mapping in token-auth.ts — this table only handles per-user.
CREATE TABLE IF NOT EXISTS web_tokens (
  token       TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_web_tokens_user ON web_tokens(user_id);
