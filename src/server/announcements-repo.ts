import type Database from 'better-sqlite3';

export type Audience = 'all' | 'resident' | 'staff';

export type Announcement = {
  id: number;
  title: string;
  body: string;
  audience: Audience;
  isPinned: boolean;
  postedBy: number | null;
  postedAt: string;
  expiresAt: string | null;
};

type Row = {
  id: number;
  title: string;
  body: string;
  audience: string;
  is_pinned: number;
  posted_by: number | null;
  posted_at: string;
  expires_at: string | null;
};

function rowToAnnouncement(row: Row): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: (row.audience as Audience) ?? 'all',
    isPinned: row.is_pinned === 1,
    postedBy: row.posted_by,
    postedAt: row.posted_at,
    expiresAt: row.expires_at,
  };
}

export function makeAnnouncementsRepo(db: Database.Database) {
  // Pinned first (DESC), then by posted_at DESC. Expired rows excluded by
  // `expires_at IS NULL OR expires_at > now`. The posted_at filter normalises
  // SQLite's CURRENT_TIMESTAMP (UTC) — we compare using the same SQL function.
  const listForAudience = db.prepare(`
    SELECT id, title, body, audience, is_pinned, posted_by, posted_at, expires_at
    FROM announcements
    WHERE (audience = 'all' OR audience = ?)
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY is_pinned DESC, posted_at DESC
    LIMIT 200
  `);

  const listAll = db.prepare(`
    SELECT id, title, body, audience, is_pinned, posted_by, posted_at, expires_at
    FROM announcements
    ORDER BY is_pinned DESC, posted_at DESC
    LIMIT 500
  `);

  const insert = db.prepare(`
    INSERT INTO announcements (title, body, audience, is_pinned, posted_by, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const update = db.prepare(`
    UPDATE announcements
    SET title      = COALESCE(?, title),
        body       = COALESCE(?, body),
        audience   = COALESCE(?, audience),
        is_pinned  = COALESCE(?, is_pinned),
        expires_at = COALESCE(?, expires_at)
    WHERE id = ?
  `);

  const removeStmt = db.prepare(`DELETE FROM announcements WHERE id = ?`);

  return {
    list(audience: Audience): Announcement[] {
      const target = audience === 'all' ? 'resident' : audience;
      const rows = listForAudience.all(target) as Row[];
      return rows.map(rowToAnnouncement);
    },

    listAll(): Announcement[] {
      const rows = listAll.all() as Row[];
      return rows.map(rowToAnnouncement);
    },

    create(input: {
      title: string;
      body: string;
      audience: Audience;
      isPinned?: boolean;
      postedBy: number | null;
      expiresAt?: string | null;
    }): number {
      const result = insert.run(
        input.title,
        input.body,
        input.audience,
        input.isPinned ? 1 : 0,
        input.postedBy,
        input.expiresAt ?? null,
      ) as { lastInsertRowid: number | bigint };
      return Number(result.lastInsertRowid);
    },

    update(input: {
      id: number;
      title?: string;
      body?: string;
      audience?: Audience;
      isPinned?: boolean;
      expiresAt?: string | null;
    }): boolean {
      const result = update.run(
        input.title ?? null,
        input.body ?? null,
        input.audience ?? null,
        input.isPinned === undefined ? null : (input.isPinned ? 1 : 0),
        input.expiresAt === undefined ? null : input.expiresAt,
        input.id,
      ) as { changes?: number };
      return (result.changes ?? 0) > 0;
    },

    delete(id: number): boolean {
      const result = removeStmt.run(id) as { changes?: number };
      return (result.changes ?? 0) > 0;
    },
  };
}

export type AnnouncementsRepo = ReturnType<typeof makeAnnouncementsRepo>;
