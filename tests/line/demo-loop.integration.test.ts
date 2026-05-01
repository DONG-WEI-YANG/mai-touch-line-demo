import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startDemo, continueDemo } from '../../src/server/line/handlers/demo';
import { SessionStore } from '../../src/server/line/session-store';

describe('demo facility — full loop integration', () => {
  let store: SessionStore;
  let client: any;
  let runSideEffect: any;
  let deps: any;

  beforeEach(() => {
    store = new SessionStore({ ttlMs: 60_000 });
    client = { push: vi.fn().mockResolvedValue(undefined) };
    runSideEffect = vi.fn().mockResolvedValue(undefined);
    deps = { store, client, runSideEffect, lineUser: { lineUserId: 'U1', language: 'zh-TW' } };
    // Override delays to 0 to keep test fast
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays facility script through 3 wait_user gates and triggers side_effect', async () => {
    await startDemo('facility', deps);
    // Should suspend at first wait_user (after 3 bot_say). Step >= 3.
    expect(store.get('U1')?.demoStep).toBeGreaterThanOrEqual(3);

    // Round 1: tap "book gym"
    await continueDemo({ type:'postback', source:{userId:'U1'},
      postback:{ data:'act=book&fac=gym' } } as any, deps);

    // Round 2: tap a time
    await continueDemo({ type:'postback', source:{userId:'U1'},
      postback:{ data:'slot=time&val=19:00' } } as any, deps);

    // Round 3: tap confirm (must match postbackData: 'act=confirm' in facility script step 7)
    await continueDemo({ type:'postback', source:{userId:'U1'},
      postback:{ data:'act=confirm' } } as any, deps);

    // Side effect should have fired
    expect(runSideEffect).toHaveBeenCalledWith(expect.objectContaining({
      router: 'amenities', procedure: 'book',
    }));

    // Demo state should be cleared at end
    const final = store.get('U1');
    expect(final?.demoScriptId).toBeUndefined();
    expect(final?.demoStep).toBeUndefined();
  });
});
