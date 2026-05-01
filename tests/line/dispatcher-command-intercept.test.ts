import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatch, setDispatchDeps, resetDispatchDeps } from '../../src/server/line/dispatcher';
import { SessionStore } from '../../src/server/line/session-store';

const mkLineUserRow = (overrides: any = {}) => ({
  id: 1, channelId: 'C', lineUserId: 'U1', appUserId: null,
  role: 'resident' as const, displayName: null, pictureUrl: null,
  language: 'zh-TW' as const, isDemo: 1,
  ...overrides,
});

const mkDeps = (overrides: any = {}) => {
  const replyOrPush = vi.fn().mockResolvedValue(undefined);
  const lineClient = { reply: vi.fn(), push: vi.fn(), replyOrPush } as any;
  const store = new SessionStore({ ttlMs: 60_000 });
  const lineUserRepo = {
    upsert: vi.fn(),
    byLineId: vi.fn().mockReturnValue(mkLineUserRow()),
    setRole: vi.fn(),
    setLanguage: vi.fn(),
    listByRole: vi.fn().mockReturnValue([]),
  } as any;
  const messageLog = { write: vi.fn() } as any;
  const ai = {
    classify: vi.fn().mockResolvedValue({
      intent: 'small_talk', confidence: 0.99, slots: {}, language: 'zh-TW',
    }),
  } as any;
  return {
    lineClient, store, lineUserRepo, messageLog, ai,
    channelId: 'C',
    bookFn: vi.fn().mockResolvedValue({ id: 'WO-1' }),
    pushHousekeepers: vi.fn().mockResolvedValue(undefined),
    updateOrder: vi.fn().mockResolvedValue(undefined),
    runSideEffect: vi.fn().mockResolvedValue(undefined),
    commandHandler: vi.fn().mockResolvedValue(false),
    rateLimiter: { check: vi.fn().mockReturnValue(true) },
    eventDedupe: { seen: vi.fn().mockReturnValue(false) },
    ...overrides,
  };
};

const mkTextEv = (text: string, userId = 'U1', replyToken = 'rt') => ({
  type: 'message', replyToken, webhookEventId: `eid-${text}`,
  source: { userId },
  message: { type: 'text', text },
});

describe('dispatcher command intercept', () => {
  beforeEach(() => resetDispatchDeps());

  it('skips role handler when commandHandler returns true', async () => {
    const commandHandler = vi.fn().mockResolvedValue(true);
    const deps = mkDeps({ commandHandler });
    await dispatch([mkTextEv('/help')], deps);
    // commandHandler was called
    expect(commandHandler).toHaveBeenCalledWith(
      '/help',
      expect.anything(),
      expect.objectContaining({ lineUserId: 'U1' }),
    );
    // AI classifier (used by resident handler) was NOT called — handler was short-circuited
    expect(deps.ai.classify).not.toHaveBeenCalled();
  });

  it('falls through to role handler when commandHandler returns false', async () => {
    const commandHandler = vi.fn().mockResolvedValue(false);
    const deps = mkDeps({ commandHandler });
    await dispatch([mkTextEv('/unknown')], deps);
    // commandHandler tried but returned false
    expect(commandHandler).toHaveBeenCalled();
    // Resident handler ran (AI classify called)
    expect(deps.ai.classify).toHaveBeenCalled();
  });

  it('skips event entirely when eventDedupe.seen returns true', async () => {
    const eventDedupe = { seen: vi.fn().mockReturnValue(true) };
    const deps = mkDeps({ eventDedupe });
    await dispatch([mkTextEv('hello')], deps);
    // No processing at all — even messageLog should not be called
    expect(deps.messageLog.write).not.toHaveBeenCalled();
    expect(deps.lineClient.replyOrPush).not.toHaveBeenCalled();
  });

  it('replies rate-limit message when rateLimiter.check returns false', async () => {
    const rateLimiter = { check: vi.fn().mockReturnValue(false) };
    const deps = mkDeps({ rateLimiter });
    await dispatch([mkTextEv('hello')], deps);
    // Rate-limit reply sent
    expect(deps.lineClient.replyOrPush).toHaveBeenCalledWith(
      'rt', 'U1',
      expect.objectContaining({ type: 'text', text: expect.stringMatching(/fast|速|速すぎ/i) }),
    );
    // No further processing
    expect(deps.messageLog.write).not.toHaveBeenCalled();
    expect(deps.ai.classify).not.toHaveBeenCalled();
  });

  it('command intercept fires BEFORE demo intercept (Concern A)', async () => {
    // Set a demo session active for U1
    const store = new SessionStore({ ttlMs: 60_000 });
    store.set('U1', {
      userId: 'U1', role: 'resident', step: 'IDLE', slots: {}, missingSlots: [],
      language: 'zh-TW', updatedAt: Date.now(),
      demoScriptId: 'facility', demoStep: 1,
    });
    const commandHandler = vi.fn().mockResolvedValue(true);
    const deps = mkDeps({ store, commandHandler });
    // Even with an active demo session, /demo stop must be handled by commandHandler
    await dispatch([mkTextEv('/demo stop')], deps);
    expect(commandHandler).toHaveBeenCalledWith(
      '/demo stop',
      expect.anything(),
      expect.objectContaining({ lineUserId: 'U1' }),
    );
    // replyOrPush was NOT called via the demo continueDemo path (commandHandler handled it)
    // commandHandler returned true so demo path skipped
    expect(deps.runSideEffect).not.toHaveBeenCalled();
  });

  it('non-command text is not passed to commandHandler', async () => {
    const commandHandler = vi.fn().mockResolvedValue(false);
    const deps = mkDeps({ commandHandler });
    await dispatch([mkTextEv('hello world')], deps);
    // 'hello world' does not start with /, so commandHandler should not be called
    expect(commandHandler).not.toHaveBeenCalled();
    // Resident handler ran instead
    expect(deps.ai.classify).toHaveBeenCalled();
  });
});
