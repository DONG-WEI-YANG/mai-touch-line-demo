-- Existing logs have no authenticated device provenance. Do not infer trust.
ALTER TABLE access_logs ADD COLUMN source TEXT NOT NULL DEFAULT 'unverified';
