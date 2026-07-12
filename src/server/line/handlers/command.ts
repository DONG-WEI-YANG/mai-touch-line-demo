import type { LineClient } from '../line-client';
import type { Lang } from '../ai/types';
import type { SessionStore } from '../session-store';
import type { makeLineUserRepo } from '../line-user-repo';
import { getLineAdminContext } from '../../_core/context';

export function isCommand(text: string): boolean {
  if (!text) return false;
  return /^\/[a-z]/i.test(text.trim());
}

export type CommandDeps = {
  client: LineClient;
  lineUserRepo: ReturnType<typeof makeLineUserRepo>;
  channelId: string;
  lineUser: { lineUserId: string; role: 'resident' | 'housekeeper' | 'admin'; language: Lang };
  sessionStore: SessionStore;
  adminWhitelist: string[];
  startDemo: (id: string) => Promise<void>;
  stopDemo: () => Promise<void>;
  listScripts: () => Array<{ id: string }>;
};

/**
 * Returns true if the input was a recognized command (handled), false otherwise.
 * Caller should fall through to other handlers if false.
 */
export async function handleCommand(rawText: string, ev: any, d: CommandDeps): Promise<boolean> {
  const text = rawText.trim().toLowerCase();
  const userId = d.lineUser.lineUserId;
  const lang = d.lineUser.language;
  const reply = (msg: any) => d.client.replyOrPush(ev.replyToken, userId, msg);

  if (text === '/help') {
    await reply({ type: 'text', text: helpText(d) });
    return true;
  }

  if (text === '/whoami') {
    await reply({ type: 'text', text:
      `id=${userId.slice(0, 8)} role=${d.lineUser.role} lang=${lang}` });
    return true;
  }

  if (text === '/reset') {
    d.sessionStore.clear(userId);
    await reply({ type: 'text', text: 'session reset' });
    return true;
  }

  const roleMatch = text.match(/^\/role\s+(resident|housekeeper|admin)$/);
  if (roleMatch) {
    const newRole = roleMatch[1] as 'resident' | 'housekeeper' | 'admin';
    // Audit finding D: housekeeper is a privileged role (receives all residents'
    // work-order PII + can accept/close any order), so it must NOT be self-
    // selectable. Gate both admin AND housekeeper behind the operator whitelist;
    // only self-demotion to resident is unrestricted.
    if ((newRole === 'admin' || newRole === 'housekeeper') && !d.adminWhitelist.includes(userId)) {
      await reply({ type: 'text', text: `forbidden: ${newRole} role requires whitelist` });
      return true;
    }
    d.lineUserRepo.setRole(d.channelId, userId, newRole);
    await reply({ type: 'text', text: `role => ${newRole}` });
    return true;
  }

  const langMatch = text.match(/^\/lang\s+(zh|en|ja)$/);
  if (langMatch) {
    const map: Record<'zh' | 'en' | 'ja', Lang> = { zh: 'zh-TW', en: 'en', ja: 'ja' };
    const newLang = map[langMatch[1] as 'zh' | 'en' | 'ja'];
    d.lineUserRepo.setLanguage(d.channelId, userId, newLang);
    await reply({ type: 'text', text: `lang => ${newLang}` });
    return true;
  }

  if (text === '/demo list') {
    await reply({ type: 'text', text: 'available: ' + d.listScripts().map(s => s.id).join(', ') });
    return true;
  }

  if (text === '/demo stop') {
    await d.stopDemo();
    await reply({ type: 'text', text: 'demo stopped' });
    return true;
  }

  const scriptMatch = text.match(/^\/demo\s+(\w+)$/);
  if (scriptMatch) {
    await d.startDemo(scriptMatch[1]);
    return true;
  }

  // /bind <code> — links this LINE user to the web account that issued
  // the code. Looks up bind_codes (created by auth.startLineBind on the web
  // side), validates not-expired, sets line_user.app_user_id = web user id,
  // then deletes the code (single-use).
  const bindMatch = rawText.trim().match(/^\/bind\s+([A-Za-z0-9]{4,12})$/);
  if (bindMatch) {
    const code = bindMatch[1].toUpperCase();
    const adminCtx = getLineAdminContext();
    if (!adminCtx?.db) {
      await reply({ type: 'text', text: 'Bind unavailable (server misconfigured)' });
      return true;
    }
    const row = adminCtx.db.prepare(`
      SELECT user_id, expires_at FROM bind_codes WHERE code = ?
    `).get(code) as { user_id: number; expires_at: string } | undefined;
    if (!row) {
      await reply({ type: 'text', text: lang === 'en'
        ? 'Invalid bind code. Open the web app and tap "Bind LINE" to get a fresh code.'
        : '綁定碼無效或已使用。請至網頁版重新產生綁定碼。' });
      return true;
    }
    if (new Date(row.expires_at) < new Date()) {
      adminCtx.db.prepare(`DELETE FROM bind_codes WHERE code = ?`).run(code);
      await reply({ type: 'text', text: lang === 'en'
        ? 'Bind code expired. Generate a new one in the web app.'
        : '綁定碼已過期。請至網頁版重新產生。' });
      return true;
    }
    adminCtx.db.prepare(`
      UPDATE line_user SET app_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE channel_id = ? AND line_user_id = ?
    `).run(row.user_id, d.channelId, userId);
    adminCtx.db.prepare(`DELETE FROM bind_codes WHERE code = ?`).run(code);
    const userRow = adminCtx.db.prepare(
      `SELECT name FROM users WHERE id = ?`
    ).get(row.user_id) as { name: string | null } | undefined;
    const name = userRow?.name ?? 'your account';
    await reply({ type: 'text', text: lang === 'en'
      ? `✓ LINE successfully linked to ${name}. Status updates will now arrive here.`
      : `✓ 已成功綁定到「${name}」。日後派工狀態變更將推送到此 LINE。` });
    return true;
  }

  // Unknown /command — return false so caller can fall through to AI handler
  return false;
}

function helpText(d: CommandDeps): string {
  return [
    '/help            this menu',
    '/role <r>        switch role: resident | housekeeper | admin',
    '/lang <l>        zh | en | ja',
    '/demo <id>       run demo script (list: /demo list)',
    '/demo stop       stop running demo',
    '/reset           clear your conversation state',
    '/whoami          show your id/role/lang',
    `your role=${d.lineUser.role} lang=${d.lineUser.language}`,
  ].join('\n');
}
