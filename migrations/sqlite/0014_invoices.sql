-- Monthly invoices for residents (HOA fees, utility charges, parking, etc).
-- amount stored as integer cents to avoid floating-point drift.
-- paid_at NULL means open. paid_method records how it was settled
-- (manual/cash/transfer/autodebit) — actual payment-gateway integration is v2.
CREATE TABLE IF NOT EXISTS invoices (
  id           INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER  NOT NULL REFERENCES users(id),
  description  TEXT     NOT NULL,
  amount_cents INTEGER  NOT NULL,
  currency     TEXT     NOT NULL DEFAULT 'TWD',
  due_date     DATE,
  issued_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at      DATETIME,
  paid_method  TEXT,
  notes        TEXT,
  issued_by    INTEGER  REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_invoices_user_unpaid ON invoices(user_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);
