import type { LineClient } from '../line-client';
import type { Lang } from '../ai/types';
import type { SessionStore } from '../session-store';
import type { makeLineUserRepo } from '../line-user-repo';

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
    if (newRole === 'admin' && !d.adminWhitelist.includes(userId)) {
      await reply({ type: 'text', text: 'forbidden: admin role requires whitelist' });
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
