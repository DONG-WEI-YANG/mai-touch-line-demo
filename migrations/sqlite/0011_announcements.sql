-- Building-wide announcements / broadcasts.
-- Admins compose. Residents and staff read on a timeline.
-- audience controls who sees it: 'all' / 'resident' / 'staff'
-- is_pinned bubbles a notice to the top of the timeline regardless of date.
CREATE TABLE IF NOT EXISTS announcements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  audience    TEXT    NOT NULL DEFAULT 'all',
  is_pinned   INTEGER NOT NULL DEFAULT 0,
  posted_by   INTEGER REFERENCES users(id),
  posted_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME
);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned_posted
  ON announcements(is_pinned DESC, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_audience
  ON announcements(audience);
