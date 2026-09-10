import { makeRateLimiter } from '../../src/server/line/rate-limit';
import { readFileSync } from 'node:fs';
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
      expect.objectContaining({ type: 'text', text: expect.stringMatching(/requests|上限/i) }),
    );
    // messageLog.write IS called (audit guarantee) but AI/role handler is not
    expect(deps.messageLog.write).toHaveBeenCalled();
    expect(deps.ai.classify).not.toHaveBeenCalled();
  });

  it('logs inbound message even when rate-limited', async () => {
    // Arrange: rateLimiter blocks the message
    const rateLimiter = { check: vi.fn().mockReturnValue(false) };
    const deps = mkDeps({ rateLimiter });
    await dispatch([mkTextEv('spam')], deps);
    // messageLog.write is called before the rate-limit continue (audit guarantee)
    expect(deps.messageLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ lineUserId: 'U1', direction: 'inbound' }),
    );
    // Rate limiter was checked
    expect(rateLimiter.check).toHaveBeenCalledWith('U1');
    // But AI/role processing was skipped
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


describe('visible service entry points', () => {
  it.each(['text','postback'])('opens terminal record details through %s without AI or writes',async kind=>{
    const deps=mkDeps({queryRecords:vi.fn().mockResolvedValue('紀錄與關聯：\nBK-1｜泳池')});
    const event=kind==='text'?mkTextEv('查詢 BK-1'):{type:'postback',replyToken:'rt',source:{userId:'U1'},postback:{data:`query=${encodeURIComponent('查詢 BK-1')}`}};
    await dispatch([event],deps);
    expect(deps.queryRecords).toHaveBeenCalledWith('查詢 BK-1','U1');
    const message=JSON.stringify(deps.lineClient.replyOrPush.mock.calls[0][2]);
    expect(message).toContain('尚無關聯紀錄');
    expect(message).toContain('nav=bookings');
    expect(message).not.toContain('query=');
    expect(deps.ai.classify).not.toHaveBeenCalled();
    expect(deps.bookFn).not.toHaveBeenCalled();
    expect(deps.updateOrder).not.toHaveBeenCalled();
  });
  it.each(['預約公設','查空時段','我的預約','報修服務'])('routes desktop label %s without AI', async text => {
    const deps=mkDeps({lineUserRepo:{byLineId:vi.fn().mockReturnValue(mkLineUserRow({appUserId:1})),upsert:vi.fn()},queryRecords:vi.fn(async (text:string)=>text==='查詢空間預約單'?'查無紀錄':undefined)});
    await dispatch([mkTextEv(text)],deps);
    expect(deps.lineClient.replyOrPush).toHaveBeenCalled();
    expect(deps.ai.classify).not.toHaveBeenCalled();
  });
  it('opens visitor registration without consuming the entry label as a visitor name', async()=>{
    const deps=mkDeps({lineUserRepo:{byLineId:vi.fn().mockReturnValue(mkLineUserRow({appUserId:1})),upsert:vi.fn()}});
    await dispatch([mkTextEv('訪客登記')],deps);
    expect(deps.store.get('U1')?.intent).toBe('visitor.notify');
    expect(deps.store.get('U1')?.slots.visitor_name).toBeUndefined();
    expect(deps.ai.classify).not.toHaveBeenCalled();
  });
  it('sends staff visitor entry to records without starting a resident write flow',async()=>{
    const deps=mkDeps({lineUserRepo:{byLineId:vi.fn().mockReturnValue(mkLineUserRow({appUserId:1,role:'housekeeper'})),upsert:vi.fn()}});
    await dispatch([{type:'postback',replyToken:'rt',source:{userId:'U1'},postback:{data:'nav=visitorRegister'}}],deps);
    expect(deps.lineClient.replyOrPush).toHaveBeenCalled();
    expect(deps.store.get('U1')?.intent).not.toBe('visitor.notify');
    expect(deps.ai.classify).not.toHaveBeenCalled();
  });
});


describe('published rich menu actions',()=>{
  const menu=JSON.parse(readFileSync('public/line-menu/community.json','utf8'));
  it.each(['resident','housekeeper'])('routes every published touch area for %s without AI or writes',async role=>{
    for (const area of menu.areas) {
      const deps=mkDeps({lineUserRepo:{byLineId:vi.fn().mockReturnValue(mkLineUserRow({appUserId:1,role})),upsert:vi.fn()},queryRecords:vi.fn().mockResolvedValue('查無紀錄')});
      await dispatch([{type:'postback',replyToken:'rt',source:{userId:'U1'},postback:{data:area.action.data}}],deps);
      expect(deps.lineClient.replyOrPush,area.action.label).toHaveBeenCalledTimes(1);
      expect(deps.ai.classify,area.action.label).not.toHaveBeenCalled();
      expect(deps.bookFn).not.toHaveBeenCalled();
      if(area.action.data==='nav=visitorRegister' && role==='resident') expect(deps.store.get('U1')?.intent).toBe('visitor.notify');
      if(area.action.data==='nav=facilities' && role==='housekeeper') expect(JSON.stringify(deps.lineClient.replyOrPush.mock.calls)).not.toContain('act=book&');
    }
  });
});


it('lets repeated menu taps pass while text remains limited, then sends only one limit notice',async()=>{
  const rateLimiter=makeRateLimiter({getLimits:()=>({perMinute:1,perDay:200}),getInteractionLimits:()=>({perMinute:20,perDay:2000}),now:()=>0});
  const deps=mkDeps({rateLimiter,lineUserRepo:{byLineId:vi.fn().mockReturnValue(mkLineUserRow({appUserId:1})),upsert:vi.fn()}});
  for(let i=0;i<20;i++) await dispatch([{type:'postback',replyToken:'rt',source:{userId:'U1'},postback:{data:'nav=home'}}],deps);
  expect(deps.lineClient.replyOrPush).toHaveBeenCalledTimes(20);
  expect(deps.lineClient.replyOrPush.mock.calls.every((call:any[])=>call[2].type==='flex')).toBe(true);
  for(let i=0;i<3;i++) await dispatch([{type:'postback',replyToken:'rt',source:{userId:'U1'},postback:{data:'nav=home'}}],deps);
  expect(deps.lineClient.replyOrPush).toHaveBeenCalledTimes(21);
  expect(deps.ai.classify).not.toHaveBeenCalled();
  expect(rateLimiter.check('U1')).toBe(true);
  expect(rateLimiter.check('U1')).toBe(false);
});


it('keeps a repair draft on repeated entry and gives an explicit input instruction',async()=>{
  const deps=mkDeps({lineUserRepo:{byLineId:vi.fn().mockReturnValue(mkLineUserRow({appUserId:1})),upsert:vi.fn()}});
  await dispatch([mkTextEv('我要報修')],deps);
  expect(JSON.stringify(deps.lineClient.replyOrPush.mock.calls.at(-1)?.[2])).toContain('訊息欄');
  deps.store.set('U1',{userId:'U1',role:'resident',language:'zh-TW',updatedAt:Date.now(),intent:'repair.report',step:'SLOT_FILLING',slots:{issue:'冷氣不冷'},missingSlots:['location','urgency']});
  await dispatch([mkTextEv('我要報修')],deps);
  expect(deps.store.get('U1')?.slots.issue).toBe('冷氣不冷');
  expect(JSON.stringify(deps.lineClient.replyOrPush.mock.calls.at(-1)?.[2])).toContain('2 / 3');
  expect(deps.ai.classify).not.toHaveBeenCalled();
});

it('keeps repair menu and form shortcuts relevant to work orders', async () => {
  const deps=mkDeps({lineUserRepo:{byLineId:vi.fn().mockReturnValue(mkLineUserRow({appUserId:1})),upsert:vi.fn()}});
  for (const text of ['報修服務', '我要報修']) {
    await dispatch([mkTextEv(text)], deps);
    const actions = deps.lineClient.replyOrPush.mock.calls.at(-1)?.[2].quickReply.items.map((item:any)=>item.action);
    expect(actions.map((action:any)=>action.label)).toContain('工單進度');
    expect(actions.some((action:any)=>action.data==='nav=availability' || action.data==='nav=bookings')).toBe(false);
  }
});
