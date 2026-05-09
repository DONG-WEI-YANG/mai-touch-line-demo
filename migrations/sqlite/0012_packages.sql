-- Front-desk package / mail handling.
-- Staff register an incoming package against a resident. The system mints
-- a 4-digit PIN that the resident shows at pickup.
-- picked_up_at = NULL means pending.
-- picked_up_by records the name on receipt (resident or proxy holder).
CREATE TABLE IF NOT EXISTS packages (
  id               INTEGER  PRIMARY KEY AUTOINCREMENT,
  recipient_id     INTEGER  NOT NULL REFERENCES users(id),
  sender           TEXT,
  courier          TEXT,
  storage_location TEXT,
  pickup_pin       TEXT     NOT NULL,
  arrived_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  picked_up_at     DATETIME,
  picked_up_by     TEXT,
  notes            TEXT,
  registered_by    INTEGER  REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_packages_recipient_pending
  ON packages(recipient_id, picked_up_at);
CREATE INDEX IF NOT EXISTS idx_packages_arrived
  ON packages(arrived_at DESC);
