import type Database from 'better-sqlite3';

export type PaidMethod = 'cash' | 'transfer' | 'autodebit' | 'manual' | 'card';

export type Invoice = {
  id: number;
  userId: number;
  userName: string | null;
  description: string;
  amountCents: number;
  currency: string;
  dueDate: string | null;
  issuedAt: string;
  paidAt: string | null;
  paidMethod: PaidMethod | null;
  notes: string | null;
  issuedBy: number | null;
};

type Row = {
  id: number;
  user_id: number;
  user_name: string | null;
  description: string;
  amount_cents: number;
  currency: string;
  due_date: string | null;
  issued_at: string;
  paid_at: string | null;
  paid_method: string | null;
  notes: string | null;
  issued_by: number | null;
};

function toInvoice(row: Row): Invoice {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    description: row.description,
    amountCents: row.amount_cents,
    currency: row.currency,
    dueDate: row.due_date,
    issuedAt: row.issued_at,
    paidAt: row.paid_at,
    paidMethod: (row.paid_method as PaidMethod | null) ?? null,
    notes: row.notes,
    issuedBy: row.issued_by,
  };
}

export function makeInvoicesRepo(db: Database.Database) {
  const SELECT_BASE = `
    SELECT i.id, i.user_id, u.name AS user_name, i.description, i.amount_cents,
           i.currency, i.due_date, i.issued_at, i.paid_at, i.paid_method,
           i.notes, i.issued_by
    FROM invoices i
    LEFT JOIN users u ON u.id = i.user_id
  `;

  const myAll = db.prepare(`
    ${SELECT_BASE}
    WHERE i.user_id = ?
    ORDER BY (i.paid_at IS NULL) DESC, i.issued_at DESC
    LIMIT 50
  `);
  const myUnpaid = db.prepare(`
    ${SELECT_BASE}
    WHERE i.user_id = ? AND i.paid_at IS NULL
    ORDER BY i.due_date ASC, i.issued_at DESC
  `);
  const listAll = db.prepare(`
    ${SELECT_BASE}
    ORDER BY (i.paid_at IS NULL) DESC, i.issued_at DESC
    LIMIT 200
  `);
  const insert = db.prepare(`
    INSERT INTO invoices
      (user_id, description, amount_cents, currency, due_date, notes, issued_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const markPaid = db.prepare(`
    UPDATE invoices
    SET paid_at = CURRENT_TIMESTAMP, paid_method = ?
    WHERE id = ? AND paid_at IS NULL
  `);
  const removeStmt = db.prepare(`DELETE FROM invoices WHERE id = ?`);
  const totalsForUser = db.prepare(`
    SELECT
      COUNT(*)       AS open_count,
      COALESCE(SUM(amount_cents), 0) AS open_cents
    FROM invoices
    WHERE user_id = ? AND paid_at IS NULL
  `);

  return {
    myAll(userId: number): Invoice[] {
      return (myAll.all(userId) as Row[]).map(toInvoice);
    },
    myUnpaid(userId: number): Invoice[] {
      return (myUnpaid.all(userId) as Row[]).map(toInvoice);
    },
    listAll(): Invoice[] {
      return (listAll.all() as Row[]).map(toInvoice);
    },
    issue(input: {
      userId: number; description: string; amountCents: number;
      currency?: string; dueDate?: string | null; notes?: string | null;
      issuedBy: number | null;
    }): number {
      const result = insert.run(
        input.userId,
        input.description,
        input.amountCents,
        input.currency ?? 'TWD',
        input.dueDate ?? null,
        input.notes ?? null,
        input.issuedBy,
      ) as { lastInsertRowid: number | bigint };
      return Number(result.lastInsertRowid);
    },
    markPaid(id: number, method: PaidMethod): boolean {
      const result = markPaid.run(method, id) as { changes?: number };
      return (result.changes ?? 0) > 0;
    },
    delete(id: number): boolean {
      const result = removeStmt.run(id) as { changes?: number };
      return (result.changes ?? 0) > 0;
    },
    summaryFor(userId: number): { openCount: number; openCents: number } {
      const row = totalsForUser.get(userId) as { open_count: number; open_cents: number };
      return { openCount: row.open_count, openCents: row.open_cents };
    },
  };
}

export type InvoicesRepo = ReturnType<typeof makeInvoicesRepo>;
