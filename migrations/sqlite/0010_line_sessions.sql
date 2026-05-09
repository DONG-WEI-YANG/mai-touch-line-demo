-- LINE conversation sessions, persisted across deploys/restarts.
-- Replaces the in-memory Map in src/server/line/session-store.ts so that
-- Render Free's SQLite-disk-survives-but-process-restarts model preserves
-- mid-conversation state instead of dropping it on every redeploy.
--
-- Schema notes:
--   - state is the JSON-serialized SessionState (slots/missingSlots/history/etc).
--     Storing as TEXT keeps the migration simple and avoids per-field churn
--     when the SessionState shape evolves.
--   - updated_at is denormalized (NOT redundant with state.updatedAt) so the
--     TTL eviction sweep can use a covered index without parsing JSON.
CREATE TABLE IF NOT EXISTS line_sessions (
  user_id     TEXT    PRIMARY KEY,
  state       TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_line_sessions_updated_at
  ON line_sessions(updated_at);
