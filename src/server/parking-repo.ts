import type Database from 'better-sqlite3';

export type SpotType = 'resident' | 'guest' | 'ev';
export type AssignmentPurpose = 'resident_lease' | 'visitor' | 'ev_charge' | 'staff';

export type SpotRow = {
  id: number;
  label: string;
  type: SpotType;
  zone: string | null;
  isActive: boolean;
  notes: string | null;
  // Joined from active assignment, if any:
  activeAssignment: {
    id: number;
    userId: number | null;
    userName: string | null;
    vehiclePlate: string;
    driverName: string | null;
    purpose: AssignmentPurpose;
    startAt: string;
    endAt: string | null;
  } | null;
};

export type AssignmentRow = {
  id: number;
  spotId: number;
  spotLabel: string;
  spotType: SpotType;
  userId: number | null;
  userName: string | null;
  vehiclePlate: string;
  driverName: string | null;
  purpose: AssignmentPurpose;
  startAt: string;
  endAt: string | null;
};

export function makeParkingRepo(db: Database.Database) {
  // The "active assignment" join uses a correlated subquery because SQLite
  // doesn't have DISTINCT ON. We pick the most recent open assignment per spot.
  const spotsWithActive = db.prepare(`
    SELECT
      s.id, s.label, s.type, s.zone, s.is_active, s.notes,
      a.id           AS a_id,
      a.user_id      AS a_user_id,
      u.name         AS a_user_name,
      a.vehicle_plate AS a_plate,
      a.driver_name  AS a_driver,
      a.purpose      AS a_purpose,
      a.start_at     AS a_start,
      a.end_at       AS a_end
    FROM parking_spots s
    LEFT JOIN parking_assignments a
      ON a.id = (
        SELECT id FROM parking_assignments
        WHERE spot_id = s.id AND end_at IS NULL
        ORDER BY start_at DESC LIMIT 1
      )
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY s.zone, s.label
  `);

  const myActiveAssignments = db.prepare(`
    SELECT
      a.id, a.spot_id, s.label AS spot_label, s.type AS spot_type,
      a.user_id, u.name AS user_name,
      a.vehicle_plate, a.driver_name, a.purpose, a.start_at, a.end_at
    FROM parking_assignments a
    JOIN parking_spots s ON s.id = a.spot_id
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.user_id = ? AND a.end_at IS NULL
    ORDER BY a.start_at DESC
  `);

  const recentAssignments = db.prepare(`
    SELECT
      a.id, a.spot_id, s.label AS spot_label, s.type AS spot_type,
      a.user_id, u.name AS user_name,
      a.vehicle_plate, a.driver_name, a.purpose, a.start_at, a.end_at
    FROM parking_assignments a
    JOIN parking_spots s ON s.id = a.spot_id
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY (a.end_at IS NULL) DESC, a.start_at DESC
    LIMIT ?
  `);

  const findFreeGuestSpot = db.prepare(`
    SELECT s.id FROM parking_spots s
    WHERE s.type = 'guest' AND s.is_active = 1
      AND NOT EXISTS (
        SELECT 1 FROM parking_assignments a
        WHERE a.spot_id = s.id AND a.end_at IS NULL
      )
    ORDER BY s.label
    LIMIT 1
  `);

  const insertSpot = db.prepare(`
    INSERT INTO parking_spots (label, type, zone, is_active, notes)
    VALUES (?, ?, ?, ?, ?)
  `);
  const removeSpotStmt = db.prepare(`DELETE FROM parking_spots WHERE id = ?`);

  const insertAssignment = db.prepare(`
    INSERT INTO parking_assignments
      (spot_id, user_id, vehicle_plate, driver_name, purpose, end_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const closeAssignment = db.prepare(`
    UPDATE parking_assignments SET end_at = CURRENT_TIMESTAMP
    WHERE id = ? AND end_at IS NULL
  `);
  const getAssignment = db.prepare(`SELECT * FROM parking_assignments WHERE id = ?`);
  const isSpotOccupied = db.prepare(`
    SELECT 1 FROM parking_assignments WHERE spot_id = ? AND end_at IS NULL LIMIT 1
  `);

  function rowToSpot(row: any): SpotRow {
    return {
      id: row.id, label: row.label,
      type: (row.type as SpotType) ?? 'resident',
      zone: row.zone, isActive: row.is_active === 1, notes: row.notes,
      activeAssignment: row.a_id == null ? null : {
        id: row.a_id,
        userId: row.a_user_id,
        userName: row.a_user_name,
        vehiclePlate: row.a_plate,
        driverName: row.a_driver,
        purpose: (row.a_purpose as AssignmentPurpose) ?? 'visitor',
        startAt: row.a_start,
        endAt: row.a_end,
      },
    };
  }

  function rowToAssignment(row: any): AssignmentRow {
    return {
      id: row.id,
      spotId: row.spot_id,
      spotLabel: row.spot_label,
      spotType: (row.spot_type as SpotType) ?? 'resident',
      userId: row.user_id,
      userName: row.user_name,
      vehiclePlate: row.vehicle_plate,
      driverName: row.driver_name,
      purpose: (row.purpose as AssignmentPurpose) ?? 'visitor',
      startAt: row.start_at,
      endAt: row.end_at,
    };
  }

  return {
    spots(): SpotRow[] {
      return (spotsWithActive.all() as any[]).map(rowToSpot);
    },
    activeForUser(userId: number): AssignmentRow[] {
      return (myActiveAssignments.all(userId) as any[]).map(rowToAssignment);
    },
    recent(limit: number = 100): AssignmentRow[] {
      return (recentAssignments.all(limit) as any[]).map(rowToAssignment);
    },

    addSpot(input: {
      label: string; type: SpotType; zone?: string | null;
      isActive?: boolean; notes?: string | null;
    }): number {
      const result = insertSpot.run(
        input.label,
        input.type,
        input.zone ?? null,
        input.isActive === false ? 0 : 1,
        input.notes ?? null,
      ) as { lastInsertRowid: number | bigint };
      return Number(result.lastInsertRowid);
    },
    removeSpot(spotId: number): boolean {
      const result = removeSpotStmt.run(spotId) as { changes?: number };
      return (result.changes ?? 0) > 0;
    },

    /** Assign a vehicle to a specific spot. Throws if spot is occupied. */
    assign(input: {
      spotId: number;
      userId: number | null;
      vehiclePlate: string;
      driverName?: string | null;
      purpose: AssignmentPurpose;
      endAt?: string | null;
    }): number {
      if (isSpotOccupied.get(input.spotId)) {
        throw new Error(`Spot ${input.spotId} is currently occupied`);
      }
      const result = insertAssignment.run(
        input.spotId,
        input.userId,
        input.vehiclePlate.toUpperCase(),
        input.driverName ?? null,
        input.purpose,
        input.endAt ?? null,
      ) as { lastInsertRowid: number | bigint };
      return Number(result.lastInsertRowid);
    },

    /**
     * Resident-driven visitor request. Picks the next free guest spot. Returns
     * null when nothing is free — caller should surface a friendly "try later".
     */
    requestVisitor(input: {
      userId: number; vehiclePlate: string; driverName?: string | null;
      endAt?: string | null;
    }): { assignmentId: number; spotId: number; spotLabel: string } | null {
      const free = findFreeGuestSpot.get() as { id: number } | undefined;
      if (!free) return null;
      const id = this.assign({
        spotId: free.id,
        userId: input.userId,
        vehiclePlate: input.vehiclePlate,
        driverName: input.driverName ?? null,
        purpose: 'visitor',
        endAt: input.endAt ?? null,
      });
      const spot = (spotsWithActive.all() as any[]).find((s) => s.id === free.id);
      return { assignmentId: id, spotId: free.id, spotLabel: spot?.label ?? `#${free.id}` };
    },

    release(assignmentId: number): boolean {
      const result = closeAssignment.run(assignmentId) as { changes?: number };
      return (result.changes ?? 0) > 0;
    },

    getAssignmentRaw(id: number): any {
      return getAssignment.get(id);
    },
  };
}

export type ParkingRepo = ReturnType<typeof makeParkingRepo>;
