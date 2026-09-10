import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
/** Authenticated LINE portal renewal preserves the existing account and role. */
export function tokenForBoundUser(db: Database.Database, userId: number): string {
  return db.transaction(() => {
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) throw new Error('Bound account no longer exists; re-link required');
    const existing = db.prepare(`SELECT token FROM web_tokens WHERE user_id = ?
      AND julianday(created_at)>julianday('now','-30 days') AND julianday(created_at)<=julianday('now')
      ORDER BY created_at DESC LIMIT 1`).get(userId) as { token: string } | undefined;
    if (existing) return existing.token;
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO web_tokens (token, user_id) VALUES (?, ?)').run(token, userId);
    return token;
  }).immediate();
}
