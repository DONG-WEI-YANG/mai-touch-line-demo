CREATE TABLE IF NOT EXISTS line_record_links (
  source_ref TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_ref, target_ref)
);
CREATE INDEX IF NOT EXISTS idx_line_record_links_target ON line_record_links(target_ref);
