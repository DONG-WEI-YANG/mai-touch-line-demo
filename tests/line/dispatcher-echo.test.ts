import { describe, it, expect, vi } from 'vitest';
import { dispatch } from '../../src/server/line/dispatcher';
import { SessionStore } from '../../src/server/line/session-store';

/**
 * Integration smoke test for dispatch() — verifies that events are routed
 * through to the resident handler without crashing, using fully-injected deps.
 */

const mkDeps = (overrides: Partial<Parameters<typeof dispatch>[1]> = {}) => {
  const replyOrPush = vi.fn().mockResolvedValue(undefined);
  const lineClient = { reply: vi.fn(), push: vi.fn(), replyOrPush } as any;
  const store = new SessionStore({ ttlMs: 60_000 });
  const lineUserRow = {
    id: 1, channelId: 'C', lineUserId: 'U1', appUserId: null,
    role: 'resident' as const, displayName: null, pictureUrl: null,
    language: 'zh-TW' as const, isDemo: 1,
  };
  const lineUserRepo = {
    upsert: vi.fn(),
    byLineId: vi.fn().mockReturnValue(lineUserRow),
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
    ...overrides,
  };
};

describe('dispatch() integration smoke', () => {
  it('routes text message to resident handler and calls replyOrPush', async () => {
    const deps = mkDeps();
    await dispatch([
      { type: 'message', replyToken: 'rt-1', source: { userId: 'U1' }, message: { type: 'text', text: '你好' } }
    ], deps);
    expect(deps.lineClient.replyOrPush).toHaveBeenCalled();
  });

  it('skips events with no userId', async () => {
    const deps = mkDeps();
    await dispatch([{ type: 'message', replyToken: 'rt', source: {}, message: { type: 'text', text: 'x' } }], deps);
    expect(deps.lineClient.replyOrPush).not.toHaveBeenCalled();
  });

  it('upserts unknown user then routes them', async () => {
    const deps = mkDeps();
    // First call returns undefined (user not found), second returns the row
    const row = deps.lineUserRepo.byLineId();
    deps.lineUserRepo.byLineId
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(row);
    await dispatch([
      { type: 'message', replyToken: 'rt', source: { userId: 'U1' }, message: { type: 'text', text: '你好' } }
    ], deps);
    expect(deps.lineUserRepo.upsert).toHaveBeenCalled();
  });

  it('calls messageLog.write for every event', async () => {
    const deps = mkDeps();
    await dispatch([
      { type: 'message', replyToken: 'rt', source: { userId: 'U1' }, message: { type: 'text', text: 'test' } }
    ], deps);
    expect(deps.messageLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ lineUserId: 'U1', direction: 'inbound' })
    );
  });
});
