import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleResident } from '../../src/server/line/handlers/resident';
import { SessionStore } from '../../src/server/line/session-store';

const mkAi = (intent: any) => ({ classify: vi.fn().mockResolvedValue(intent) });
const mkClient = () => ({
  reply: vi.fn().mockResolvedValue(undefined),
  push: vi.fn().mockResolvedValue(undefined),
  replyOrPush: vi.fn().mockResolvedValue(undefined),
});
const baseEv = (text: string, replyToken = 'rt') => ({
  type: 'message', replyToken, source: { userId: 'U1' }, message: { type: 'text', text }
});

describe('resident handler — facility.book happy path', () => {
  let store: SessionStore;
  beforeEach(() => { store = new SessionStore({ ttlMs: 60_000 }); });

  it('asks for missing slot when facility known, time missing', async () => {
    const ai = mkAi({ intent: 'facility.book', confidence: 0.9, slots: { facility: 'gym' }, language: 'zh-TW' });
    const client = mkClient();
    await handleResident(baseEv('預約健身房'), {
      ai, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn: vi.fn(), pushHousekeepers: vi.fn(),
    });
    expect(client.replyOrPush).toHaveBeenCalled();
    const session = store.get('U1');
    expect(session?.step).toBe('SLOT_FILLING');
    expect(session?.slots.facility).toBe('gym');
  });

  it('moves to CONFIRMING when all slots filled', async () => {
    const ai = mkAi({ intent: 'facility.book', confidence: 0.95,
      slots: { facility: 'gym', date: '2026-05-09', time: '19:00' }, language: 'zh-TW' });
    const client = mkClient();
    await handleResident(baseEv('預約週六晚上7點健身房'), {
      ai, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn: vi.fn(), pushHousekeepers: vi.fn(),
    });
    expect(store.get('U1')?.step).toBe('CONFIRMING');
  });

  it('on /confirm postback, calls bookFn, pushes housekeepers, returns to IDLE', async () => {
    const ai = mkAi({ intent: 'facility.book', confidence: 0.95,
      slots: { facility: 'gym', date: '2026-05-09', time: '19:00' }, language: 'zh-TW' });
    const client = mkClient();
    const bookFn = vi.fn().mockResolvedValue({ id: 'WO-42' });
    const pushHousekeepers = vi.fn();

    // round 1: classify, fill slots, end at CONFIRMING
    await handleResident(baseEv('預約週六晚上7點健身房'), {
      ai, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn, pushHousekeepers,
    });
    // round 2: postback confirm
    await handleResident({ type: 'postback', replyToken: 'rt2', source: { userId: 'U1' },
      postback: { data: 'act=confirm&intent=facility.book' } } as any, {
      ai, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn, pushHousekeepers,
    });

    expect(bookFn).toHaveBeenCalledWith({ facility: 'gym', date: '2026-05-09', time: '19:00' });
    expect(pushHousekeepers).toHaveBeenCalled();
    expect(store.get('U1')?.step).toBe('IDLE');
  });

  it('cancel postback clears session and replies cancel', async () => {
    const client = mkClient();
    store.set('U1', { userId: 'U1', role: 'resident', step: 'SLOT_FILLING', slots: { facility: 'gym' },
      missingSlots: ['date'], language: 'zh-TW', updatedAt: Date.now() });
    await handleResident({ type: 'postback', replyToken: 'rt', source: { userId: 'U1' },
      postback: { data: 'act=cancel' } } as any, {
      ai: mkAi({}), client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn: vi.fn(), pushHousekeepers: vi.fn(),
    });
    expect(store.get('U1')).toBeUndefined();
    expect(client.replyOrPush).toHaveBeenCalled();
  });

  it('low confidence intent triggers clarification message', async () => {
    const ai = mkAi({ intent: 'facility.book', confidence: 0.4, slots: {}, language: 'zh-TW' });
    const client = mkClient();
    await handleResident(baseEv('呃'), {
      ai, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn: vi.fn(), pushHousekeepers: vi.fn(),
    });
    expect(client.replyOrPush).toHaveBeenCalledWith(expect.anything(), 'U1',
      expect.objectContaining({ type: 'text' }));
  });

  it('small_talk replies with greeting, no slot filling', async () => {
    const ai = mkAi({ intent: 'small_talk', confidence: 0.99, slots: {}, language: 'zh-TW' });
    const client = mkClient();
    await handleResident(baseEv('你好'), {
      ai, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn: vi.fn(), pushHousekeepers: vi.fn(),
    });
    expect(client.replyOrPush).toHaveBeenCalled();
    // session should be cleared (small_talk is terminal)
    expect(store.get('U1')?.step).toBe('IDLE');
  });

  it('captures free-text reply as visitor_name slot during SLOT_FILLING', async () => {
    // Round 1: classify "我明天有訪客" → visitor.notify, ask visitor_name
    const ai1 = mkAi({ intent: 'visitor.notify', confidence: 0.9, slots: {}, language: 'zh-TW' });
    const client = mkClient();
    const reportFn = vi.fn().mockResolvedValue({ id: 'WO-99' });
    await handleResident(baseEv('我明天有訪客要來'), {
      ai: ai1, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn: vi.fn(), reportFn, pushHousekeepers: vi.fn(),
    } as any);
    expect(store.get('U1')?.intent).toBe('visitor.notify');
    expect(store.get('U1')?.step).toBe('SLOT_FILLING');
    expect(store.get('U1')?.slots.visitor_name).toBeUndefined();

    // Round 2: user replies "andy" — should land in visitor_name slot
    // (NOT re-classify, NOT loop the same prompt forever)
    const ai2 = mkAi({ intent: 'should_not_be_called', confidence: 0, slots: {}, language: 'zh-TW' });
    await handleResident(baseEv('andy', 'rt2'), {
      ai: ai2, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn: vi.fn(), reportFn, pushHousekeepers: vi.fn(),
    } as any);
    expect(ai2.classify).not.toHaveBeenCalled();
    expect(store.get('U1')?.slots.visitor_name).toBe('andy');
  });

  it('captures free-text reply as issue slot for complaint.file (only required slot)', async () => {
    // complaint.file requires only ['issue']. After classify, intent set but issue empty,
    // so first turn asks for issue. Second turn user types description → captured + executed.
    const ai1 = mkAi({ intent: 'complaint.file', confidence: 0.9, slots: {}, language: 'zh-TW' });
    const client = mkClient();
    const reportFn = vi.fn().mockResolvedValue({ id: 'WO-101' });
    await handleResident(baseEv('我有事情要反映'), {
      ai: ai1, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn: vi.fn(), reportFn, pushHousekeepers: vi.fn(),
    } as any);
    expect(store.get('U1')?.step).toBe('SLOT_FILLING');

    const ai2 = mkAi({ intent: 'unused', confidence: 0, slots: {}, language: 'zh-TW' });
    await handleResident(baseEv('隔壁鄰居半夜大聲講電話', 'rt2'), {
      ai: ai2, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn: vi.fn(), reportFn, pushHousekeepers: vi.fn(),
    } as any);
    expect(reportFn).toHaveBeenCalledWith({
      intent: 'complaint.file',
      slots: { issue: '隔壁鄰居半夜大聲講電話' },
    });
  });

  it('on bookFn error, rolls back to CONFIRMING and replies busy', async () => {
    const ai = mkAi({ intent: 'facility.book', confidence: 0.95,
      slots: { facility: 'gym', date: '2026-05-09', time: '19:00' }, language: 'zh-TW' });
    const client = mkClient();
    const bookFn = vi.fn().mockRejectedValueOnce(new Error('amenity API down'));
    const pushHousekeepers = vi.fn();

    // Round 1: get to CONFIRMING
    await handleResident(baseEv('預約週六晚上7點健身房'), {
      ai, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn, pushHousekeepers,
    });
    expect(store.get('U1')?.step).toBe('CONFIRMING');

    // Round 2: confirm postback — bookFn throws
    await handleResident({ type: 'postback', replyToken: 'rt2', source: { userId: 'U1' },
      postback: { data: 'act=confirm&intent=facility.book' } } as any, {
      ai, client: client as any, store, channelId: 'C',
      lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' } as any,
      bookFn, pushHousekeepers,
    });

    expect(bookFn).toHaveBeenCalled();
    expect(pushHousekeepers).not.toHaveBeenCalled();
    // Must roll back to CONFIRMING — not stuck in EXECUTING
    expect(store.get('U1')?.step).toBe('CONFIRMING');
  });
});
