-- Parking inventory and assignments.
-- parking_spots: physical inventory (label like "B2-15"). type = resident /
-- guest / ev. is_active=0 means spot temporarily closed (maintenance).
CREATE TABLE IF NOT EXISTS parking_spots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT    NOT NULL UNIQUE,
  type       TEXT    NOT NULL DEFAULT 'resident',
  zone       TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  notes      TEXT
);
CREATE INDEX IF NOT EXISTS idx_parking_spots_type ON parking_spots(type);

-- parking_assignments: a vehicle holds a spot from start_at to end_at.
-- end_at NULL = currently parked. purpose narrates intent (lease / visitor / ev).
-- user_id is nullable so walk-in visitors can be tracked even before resident hosts them.
CREATE TABLE IF NOT EXISTS parking_assignments (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  spot_id       INTEGER  NOT NULL REFERENCES parking_spots(id),
  user_id       INTEGER  REFERENCES users(id),
  vehicle_plate TEXT     NOT NULL,
  driver_name   TEXT,
  purpose       TEXT     NOT NULL DEFAULT 'visitor',
  start_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_at        DATETIME,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_parking_assign_spot_active ON parking_assignments(spot_id, end_at);
CREATE INDEX IF NOT EXISTS idx_parking_assign_user_active ON parking_assignments(user_id, end_at);
