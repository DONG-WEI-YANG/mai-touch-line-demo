import { describe, it, expect, vi } from 'vitest';
import { isCommand, handleCommand } from '../../src/server/line/handlers/command';

describe('isCommand', () => {
  it('detects /help', () => expect(isCommand('/help')).toBe(true));
  it('detects /role resident', () => expect(isCommand('/role resident')).toBe(true));
  it('case-insensitive', () => expect(isCommand('/HELP')).toBe(true));
  it('rejects non-command', () => expect(isCommand('hello')).toBe(false));
  it('rejects empty', () => expect(isCommand('')).toBe(false));
  it('rejects "/"-only', () => expect(isCommand('/')).toBe(false));
});

const mkClient = () => ({ replyOrPush: vi.fn().mockResolvedValue(undefined) });
const mkRepo = () => ({
  setRole: vi.fn(),
  setLanguage: vi.fn(),
  byLineId: vi.fn().mockReturnValue({ lineUserId: 'U1', role: 'resident', language: 'zh-TW' }),
});
const mkStore = () => ({ clear: vi.fn() });
const baseLineUser = { lineUserId: 'U1', role: 'resident' as const, language: 'zh-TW' as const };

const mkDeps = (overrides: any = {}) => ({
  client: mkClient(),
  lineUserRepo: mkRepo(),
  channelId: 'C',
  lineUser: baseLineUser as any,
  sessionStore: mkStore(),
  adminWhitelist: [] as string[],
  startDemo: vi.fn().mockResolvedValue(undefined),
  stopDemo: vi.fn().mockResolvedValue(undefined),
  listScripts: vi.fn().mockReturnValue([{ id: 'facility' }, { id: 'repair' }]),
  ...overrides,
});

const mkEv = (text: string) => ({ type: 'message', replyToken: 'rt',
  source: { userId: 'U1' }, message: { type: 'text', text } });

describe('handleCommand', () => {
  it('/help replies with command list', async () => {
    const deps = mkDeps();
    await handleCommand('/help', mkEv('/help') as any, deps);
    expect(deps.client.replyOrPush).toHaveBeenCalled();
    const msg = deps.client.replyOrPush.mock.calls[0][2];
    expect(msg.text).toMatch(/help|role|lang|demo/i);
  });

  it('/role housekeeper denied for non-whitelisted user (audit finding D)', async () => {
    const deps = mkDeps(); // adminWhitelist: []
    await handleCommand('/role housekeeper', mkEv('/role housekeeper') as any, deps);
    expect(deps.lineUserRepo.setRole).not.toHaveBeenCalled();
    expect(deps.client.replyOrPush).toHaveBeenCalledWith(expect.anything(), 'U1',
      expect.objectContaining({ text: expect.stringMatching(/forbidden|housekeeper/i) }));
  });

  it('/role housekeeper allowed for whitelisted user', async () => {
    const deps = mkDeps({ adminWhitelist: ['U1'] });
    await handleCommand('/role housekeeper', mkEv('/role housekeeper') as any, deps);
    expect(deps.lineUserRepo.setRole).toHaveBeenCalledWith('C', 'U1', 'housekeeper');
  });

  it('/role admin denied for non-whitelisted user', async () => {
    const deps = mkDeps({ adminWhitelist: ['Uadmin'] });
    await handleCommand('/role admin', mkEv('/role admin') as any, deps);
    expect(deps.lineUserRepo.setRole).not.toHaveBeenCalled();
    expect(deps.client.replyOrPush).toHaveBeenCalledWith(expect.anything(), 'U1',
      expect.objectContaining({ text: expect.stringMatching(/forbidden|admin/i) }));
  });

  it('/role admin allowed for whitelisted user', async () => {
    const deps = mkDeps({ adminWhitelist: ['U1'] });
    await handleCommand('/role admin', mkEv('/role admin') as any, deps);
    expect(deps.lineUserRepo.setRole).toHaveBeenCalledWith('C', 'U1', 'admin');
  });

  it('/lang en updates language', async () => {
    const deps = mkDeps();
    await handleCommand('/lang en', mkEv('/lang en') as any, deps);
    expect(deps.lineUserRepo.setLanguage).toHaveBeenCalledWith('C', 'U1', 'en');
  });

  it('/lang zh maps to zh-TW', async () => {
    const deps = mkDeps();
    await handleCommand('/lang zh', mkEv('/lang zh') as any, deps);
    expect(deps.lineUserRepo.setLanguage).toHaveBeenCalledWith('C', 'U1', 'zh-TW');
  });

  it('/reset clears session', async () => {
    const deps = mkDeps();
    await handleCommand('/reset', mkEv('/reset') as any, deps);
    expect(deps.sessionStore.clear).toHaveBeenCalledWith('U1');
  });

  it('/whoami replies with id+role+lang', async () => {
    const deps = mkDeps();
    await handleCommand('/whoami', mkEv('/whoami') as any, deps);
    expect(deps.client.replyOrPush).toHaveBeenCalledWith(expect.anything(), 'U1',
      expect.objectContaining({ text: expect.stringContaining('resident') }));
  });

  it('/demo facility calls startDemo', async () => {
    const deps = mkDeps();
    await handleCommand('/demo facility', mkEv('/demo facility') as any, deps);
    expect(deps.startDemo).toHaveBeenCalledWith('facility');
  });

  it('/demo stop calls stopDemo', async () => {
    const deps = mkDeps();
    await handleCommand('/demo stop', mkEv('/demo stop') as any, deps);
    expect(deps.stopDemo).toHaveBeenCalled();
  });

  it('/demo list replies with script ids', async () => {
    const deps = mkDeps();
    await handleCommand('/demo list', mkEv('/demo list') as any, deps);
    expect(deps.client.replyOrPush).toHaveBeenCalledWith(expect.anything(), 'U1',
      expect.objectContaining({ text: expect.stringMatching(/facility/) }));
  });

  it('unknown command falls through (no reply, returns false)', async () => {
    const deps = mkDeps();
    const handled = await handleCommand('/nonexistent', mkEv('/nonexistent') as any, deps);
    expect(handled).toBe(false);
    expect(deps.client.replyOrPush).not.toHaveBeenCalled();
  });
});
