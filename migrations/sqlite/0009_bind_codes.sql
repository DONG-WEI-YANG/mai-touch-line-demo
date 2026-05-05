-- One-time codes used to link a web user to a LINE user. Web shows a QR/code,
-- LINE bot consumes it via /bind <code>. Codes are short-lived (30 min) and
-- single-use (deleted on consume).
CREATE TABLE IF NOT EXISTS bind_codes (
  code        TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bind_codes_expires ON bind_codes(expires_at);
