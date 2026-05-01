import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultDispatchDeps, resetDefaultDeps } from '../../src/server/line/dispatcher';

describe('getDefaultDispatchDeps env capture', () => {
  beforeEach(() => resetDefaultDeps());

  it('captures env at first call', () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token-a';
    process.env.LINE_CHANNEL_SECRET = 'secret-a';
    const d1 = getDefaultDispatchDeps();
    expect(d1.lineClient).toBeDefined();
  });

  it('reset allows re-capture with new env', () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token-a';
    process.env.LINE_CHANNEL_SECRET = 'secret-a';
    const d1 = getDefaultDispatchDeps();
    resetDefaultDeps();
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token-b';
    const d2 = getDefaultDispatchDeps();
    expect(d2).not.toBe(d1);  // new instance after reset
  });
});
