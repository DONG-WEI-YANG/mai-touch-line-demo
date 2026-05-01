import type Database from 'better-sqlite3';

export function makeMessageLog(db: Database.Database) {
  const ins = db.prepare(`INSERT INTO line_message_log
    (line_user_id, direction, message_type, content, intent, session_id)
    VALUES (?, ?, ?, ?, ?, ?)`);
  return {
    write(e: { lineUserId: string; direction: 'inbound'|'outbound'|'outbound:debug';
               messageType: string; content?: unknown; intent?: string; sessionId?: string }) {
      const c = e.content == null ? null : (typeof e.content === 'string' ? e.content : JSON.stringify(e.content));
      ins.run(e.lineUserId, e.direction, e.messageType, c, e.intent ?? null, e.sessionId ?? null);
    },
  };
}
