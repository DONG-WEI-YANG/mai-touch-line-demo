import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import { makeMessageLog } from '../../src/server/line/message-log';

const SQL = fs.readFileSync('migrations/sqlite/0006_line_integration.sql', 'utf8');

let db: Database.Database;
let log: ReturnType<typeof makeMessageLog>;

beforeEach(() => {
  db = new Database(':memory:');
  for (const stmt of SQL.split(';').map(s=>s.trim()).filter(Boolean)) db.prepare(stmt).run();
  log = makeMessageLog(db);
});

describe('message-log', () => {
  it('writes inbound text and reads back', () => {
    log.write({ lineUserId:'U1', direction:'inbound', messageType:'text',
                content:'hi', intent:'small_talk' });
    const rows = db.prepare('SELECT * FROM line_message_log').all() as any[];
    expect(rows[0].direction).toBe('inbound');
    expect(rows[0].intent).toBe('small_talk');
  });

  it('serializes object content as JSON', () => {
    log.write({ lineUserId:'U1', direction:'outbound', messageType:'flex',
                content:{ type:'flex', altText:'card' } });
    const row = db.prepare('SELECT content FROM line_message_log').get() as any;
    expect(JSON.parse(row.content).altText).toBe('card');
  });

  it('handles null content gracefully', () => {
    log.write({ lineUserId:'U1', direction:'inbound', messageType:'sticker' });
    const row = db.prepare('SELECT content FROM line_message_log').get() as any;
    expect(row.content).toBeNull();
  });
});
