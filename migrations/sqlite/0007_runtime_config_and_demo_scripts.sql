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
  steps_json  TEXT,                           -- NULL = use code default; non-NULL = override
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO runtime_config (key, value, type, description) VALUES
  ('line.rateLimit.perMinute',  '10',            'number', 'Per-LINE-user messages allowed per minute'),
  ('line.rateLimit.perDay',     '200',           'number', 'Per-LINE-user messages allowed per day'),
  ('ai.openai.model',           '"gpt-4o-mini"', 'string', 'OpenAI model for intent classification'),
  ('ai.openai.temperature',     '0.1',           'number', 'OpenAI temperature'),
  ('ai.confidenceThreshold',    '0.6',           'number', 'Below this triggers clarification'),
  ('demo.bannerEnabled',        'true',          'bool',   'Prefix bot replies with [DEMO] banner'),
  ('demo.adminLineUserIds',     '[]',            'json',   'LINE userIds allowed /role admin and /demo reset');

INSERT OR IGNORE INTO demo_script_config (id, enabled) VALUES
  ('facility', 1), ('repair', 1), ('visitor', 1), ('complaint', 1);
