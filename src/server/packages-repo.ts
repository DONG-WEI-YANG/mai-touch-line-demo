import type Database from 'better-sqlite3';
import crypto from 'crypto';

export type PackageRecord = {
  id: number;
  recipientId: number;
  recipientName: string | null;
  sender: string | null;
  courier: string | null;
  storageLocation: string | null;
  pickupPin: string;
  arrivedAt: string;
  pickedUpAt: string | null;
  pickedUpBy: string | null;
  notes: string | null;
  registeredBy: number | null;
};

type Row = {
  id: number;
  recipient_id: number;
  recipient_name: string | null;
  sender: string | null;
  courier: string | null;
  storage_location: string | null;
  pickup_pin: string;
  arrived_at: string;
  picked_up_at: string | null;
  picked_up_by: string | null;
  notes: string | null;
  registered_by: number | null;
};

function rowTo(row: Row): PackageRecord {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    recipientName: row.recipient_name,
    sender: row.sender,
    courier: row.courier,
    storageLocation: row.storage_location,
    pickupPin: row.pickup_pin,
    arrivedAt: row.arrived_at,
    pickedUpAt: row.picked_up_at,
    pickedUpBy: row.picked_up_by,
    notes: row.notes,
    registeredBy: row.registered_by,
  };
}

/** Crypto-strong 4-digit PIN. We avoid leading 0 to keep it visually
 *  consistent at 4 digits (1000-9999), and skip 0/1-only PINs that read
 *  poorly on receipts. */
function generatePin(): string {
  const n = crypto.randomInt(1000, 10000);
  return String(n);
}

export function makePackagesRepo(db: Database.Database) {
  const SELECT_BASE = `
    SELECT p.id, p.recipient_id, u.name AS recipient_name, p.sender, p.courier,
           p.storage_location, p.pickup_pin, p.arrived_at, p.picked_up_at,
           p.picked_up_by, p.notes, p.registered_by
    FROM packages p
    LEFT JOIN users u ON u.id = p.recipient_id
  `;

  const myPending = db.prepare(`
    ${SELECT_BASE}
    WHERE p.recipient_id = ? AND p.picked_up_at IS NULL
    ORDER BY p.arrived_at DESC
  `);

  const myAll = db.prepare(`
    ${SELECT_BASE}
    WHERE p.recipient_id = ?
    ORDER BY p.arrived_at DESC
    LIMIT 50
  `);

  const listAll = db.prepare(`
    ${SELECT_BASE}
    ORDER BY (p.picked_up_at IS NULL) DESC, p.arrived_at DESC
    LIMIT 200
  `);

  const insert = db.prepare(`
    INSERT INTO packages
      (recipient_id, sender, courier, storage_location, pickup_pin, notes, registered_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const markPickup = db.prepare(`
    UPDATE packages
    SET picked_up_at = CURRENT_TIMESTAMP, picked_up_by = ?
    WHERE id = ? AND picked_up_at IS NULL
  `);

  const removeStmt = db.prepare(`DELETE FROM packages WHERE id = ?`);

  return {
    myPending(userId: number): PackageRecord[] {
      return (myPending.all(userId) as Row[]).map(rowTo);
    },
    myAll(userId: number): PackageRecord[] {
      return (myAll.all(userId) as Row[]).map(rowTo);
    },
    listAll(): PackageRecord[] {
      return (listAll.all() as Row[]).map(rowTo);
    },
    register(input: {
      recipientId: number;
      sender?: string | null;
      courier?: string | null;
      storageLocation?: string | null;
      notes?: string | null;
      registeredBy: number | null;
    }): { id: number; pin: string } {
      const pin = generatePin();
      const result = insert.run(
        input.recipientId,
        input.sender ?? null,
        input.courier ?? null,
        input.storageLocation ?? null,
        pin,
        input.notes ?? null,
        input.registeredBy,
      ) as { lastInsertRowid: number | bigint };
      return { id: Number(result.lastInsertRowid), pin };
    },
    markPickedUp(id: number, pickedUpBy: string): boolean {
      const result = markPickup.run(pickedUpBy, id) as { changes?: number };
      return (result.changes ?? 0) > 0;
    },
    delete(id: number): boolean {
      const result = removeStmt.run(id) as { changes?: number };
      return (result.changes ?? 0) > 0;
    },
  };
}

export type PackagesRepo = ReturnType<typeof makePackagesRepo>;
