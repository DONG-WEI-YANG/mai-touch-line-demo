import type Database from 'better-sqlite3';

export type LineUserRow = {
  id: number; channelId: string; lineUserId: string; appUserId: number | null;
  role: 'resident'|'housekeeper'|'admin'; displayName: string | null;
  pictureUrl: string | null; language: 'zh-TW'|'en'|'ja' | null; isDemo: number;
};

export function makeLineUserRepo(db: Database.Database) {
  const upsertStmt = db.prepare(`
    INSERT INTO line_user (channel_id, line_user_id, display_name, picture_url, role, language, is_demo)
    VALUES (@channelId, @lineUserId, @displayName, @pictureUrl, @role, @language, @isDemo)
    ON CONFLICT(channel_id, line_user_id) DO UPDATE SET
      display_name=COALESCE(excluded.display_name, line_user.display_name),
      picture_url =COALESCE(excluded.picture_url,  line_user.picture_url),
      updated_at=CURRENT_TIMESTAMP
  `);
  const byLineStmt = db.prepare(`SELECT id, channel_id as channelId, line_user_id as lineUserId,
      app_user_id as appUserId, role, display_name as displayName, picture_url as pictureUrl,
      language, is_demo as isDemo FROM line_user WHERE channel_id=? AND line_user_id=?`);
  const setRoleStmt = db.prepare(`UPDATE line_user SET role=?, updated_at=CURRENT_TIMESTAMP
                                  WHERE channel_id=? AND line_user_id=?`);
  const setLangStmt = db.prepare(`UPDATE line_user SET language=?, updated_at=CURRENT_TIMESTAMP
                                  WHERE channel_id=? AND line_user_id=?`);
  const listByRoleStmt = db.prepare(`SELECT id, channel_id as channelId, line_user_id as lineUserId,
      app_user_id as appUserId, role, display_name as displayName, picture_url as pictureUrl,
      language, is_demo as isDemo FROM line_user WHERE channel_id=? AND role=?`);

  return {
    upsert(input: { channelId: string; lineUserId: string; displayName?: string|null;
                    pictureUrl?: string|null; role?: 'resident'|'housekeeper'|'admin';
                    language?: 'zh-TW'|'en'|'ja'; isDemo?: 0|1 }) {
      upsertStmt.run({
        channelId: input.channelId, lineUserId: input.lineUserId,
        displayName: input.displayName ?? null, pictureUrl: input.pictureUrl ?? null,
        role: input.role ?? 'resident', language: input.language ?? 'zh-TW',
        isDemo: input.isDemo ?? 0,
      });
    },
    byLineId(channelId: string, lineUserId: string): LineUserRow | undefined {
      return byLineStmt.get(channelId, lineUserId) as LineUserRow | undefined;
    },
    setRole(channelId: string, lineUserId: string, role: 'resident'|'housekeeper'|'admin') {
      setRoleStmt.run(role, channelId, lineUserId);
    },
    setLanguage(channelId: string, lineUserId: string, language: 'zh-TW'|'en'|'ja') {
      setLangStmt.run(language, channelId, lineUserId);
    },
    listByRole(channelId: string, role: 'resident'|'housekeeper'|'admin'): LineUserRow[] {
      return listByRoleStmt.all(channelId, role) as LineUserRow[];
    },
  };
}
