CREATE TABLE IF NOT EXISTS runtime_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,                  -- JSON-encoded
  type        TEXT NOT NULL,                  -- 'number' | 'string' | 'bool' | 'json'
  description TEXT,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by  TEXT
);

CREATE TABLE IF NOT EXISTS demo_script_config (
  id          TEXT PRIMARY KEY,               -- 'facility' | 'repair' | 'visitor' | 'complaint'
  enabled     INTEGER NOT NULL DEFAULT 1,
  steps_json  TEXT,                           -- NULL = use code default, non-NULL = override
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- NOTE: ai.openai.model / ai.openai.temperature are display-only. The live
-- classifier reads OPENAI_MODEL / OPENAI_TEMPERATURE env vars at boot, not these
-- rows (see src/server/_core/profile.ts). Kept so the admin dashboard shows a
-- plausible value -- editing them has no runtime effect.
INSERT OR IGNORE INTO runtime_config (key, value, type, description) VALUES
  ('line.rateLimit.perMinute',  '10',                   'number', 'Per-LINE-user messages allowed per minute'),
  ('line.rateLimit.perDay',     '200',                  'number', 'Per-LINE-user messages allowed per day'),
  ('ai.openai.model',           '"gemini-flash-latest"','string', 'AI model (display only — see OPENAI_MODEL env)'),
  ('ai.openai.temperature',     '0.1',                  'number', 'AI temperature (display only — see OPENAI_TEMPERATURE env)'),
  ('ai.confidenceThreshold',    '0.6',                  'number', 'Below this triggers clarification'),
  ('demo.bannerEnabled',        'true',                 'bool',   'Prefix bot replies with [DEMO] banner'),
  ('demo.adminLineUserIds',     '[]',                   'json',   'LINE userIds allowed /role admin and /demo reset');

-- Fix DBs seeded before the default was corrected (Render wipes SQLite per deploy
-- so this is mostly a no-op there, but persistent-disk / local dev DBs need it).
UPDATE runtime_config SET value = '"gemini-flash-latest"'
  WHERE key = 'ai.openai.model' AND value = '"gpt-4o-mini"';

INSERT OR IGNORE INTO demo_script_config (id, enabled) VALUES
  ('facility', 1), ('repair', 1), ('visitor', 1), ('complaint', 1);
