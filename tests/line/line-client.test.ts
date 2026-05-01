import { describe, it, expect, vi, beforeEach } from 'vitest';

const replyMessage = vi.fn().mockResolvedValue({});
const pushMessage  = vi.fn().mockResolvedValue({});

vi.mock('@line/bot-sdk', () => {
  // Class-based mock — constructable via `new Client(opts)` in production code
  class Client {
    replyMessage = replyMessage;
    pushMessage = pushMessage;
    constructor(_opts: any) {}
  }
  return { Client };
});

beforeEach(() => { replyMessage.mockClear(); pushMessage.mockClear(); });

describe('LineClient', () => {
  it('reply calls SDK replyMessage', async () => {
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken: 't', channelSecret: 's' });
    await c.reply('rt', { type:'text', text:'hi' });
    expect(replyMessage).toHaveBeenCalledWith('rt', { type:'text', text:'hi' });
  });

  it('push calls SDK pushMessage', async () => {
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken: 't', channelSecret: 's' });
    await c.push('U1', { type:'text', text:'yo' });
    expect(pushMessage).toHaveBeenCalledWith('U1', { type:'text', text:'yo' });
  });

  it('replyOrPush falls back to push on InvalidReplyToken', async () => {
    replyMessage.mockRejectedValueOnce(Object.assign(new Error('Invalid reply token'), { statusCode: 400 }));
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken: 't', channelSecret: 's' });
    await c.replyOrPush('rt-expired', 'U1', { type:'text', text:'late' });
    expect(pushMessage).toHaveBeenCalledWith('U1', { type:'text', text:'late' });
  });

  it('replyOrPush falls back to push on any 400 from reply (not just specific wording)', async () => {
    replyMessage.mockRejectedValueOnce(Object.assign(new Error('Token has been consumed'), { statusCode: 400 }));
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken: 't', channelSecret: 's' });
    await c.replyOrPush('rt', 'U1', { type:'text', text:'late' });
    expect(pushMessage).toHaveBeenCalledWith('U1', { type:'text', text:'late' });
  });

  it('replyOrPush re-throws non-400 errors instead of falling back', async () => {
    replyMessage.mockRejectedValueOnce(Object.assign(new Error('Server down'), { statusCode: 500 }));
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken: 't', channelSecret: 's' });
    await expect(c.replyOrPush('rt', 'U1', { type:'text', text:'x' })).rejects.toMatchObject({ statusCode: 500 });
    expect(pushMessage).not.toHaveBeenCalled();
  });

  it('prefixes [DEMO] on text when banner enabled', async () => {
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken:'t', channelSecret:'s', demoBanner: true });
    await c.reply('rt', { type:'text', text:'hello' });
    expect(replyMessage).toHaveBeenCalledWith('rt',
      expect.objectContaining({ text: expect.stringContaining('[DEMO]') }));
  });

  it('prefixes [DEMO] on flex altText when banner enabled', async () => {
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken:'t', channelSecret:'s', demoBanner: true });
    await c.reply('rt', { type:'flex', altText:'card', contents:{} });
    expect(replyMessage).toHaveBeenCalledWith('rt',
      expect.objectContaining({ altText: expect.stringContaining('[DEMO]') }));
  });

  it('does not double-prefix if [DEMO] already present', async () => {
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken:'t', channelSecret:'s', demoBanner: true });
    await c.reply('rt', { type:'text', text:'🧪 [DEMO] already here' });
    const calledMsg = replyMessage.mock.calls[0][1];
    // Should NOT contain "[DEMO]" twice
    expect((calledMsg.text.match(/\[DEMO\]/g) ?? []).length).toBe(1);
  });

  it('handles array of messages', async () => {
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken:'t', channelSecret:'s', demoBanner: true });
    await c.reply('rt', [
      { type:'text', text:'hi' },
      { type:'flex', altText:'card', contents:{} },
    ]);
    const calledMsg = replyMessage.mock.calls[0][1];
    expect(calledMsg[0].text).toContain('[DEMO]');
    expect(calledMsg[1].altText).toContain('[DEMO]');
  });

  it('no-op when banner disabled (default)', async () => {
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken:'t', channelSecret:'s' });
    await c.reply('rt', { type:'text', text:'hello' });
    const calledMsg = replyMessage.mock.calls[0][1];
    expect(calledMsg.text).toBe('hello');
  });

  it('accepts demoBanner as a function evaluated per call', async () => {
    const { LineClient } = await import('../../src/server/line/line-client');
    let on = false;
    const c = new LineClient({ channelAccessToken:'t', channelSecret:'s', demoBanner: () => on });
    await c.reply('rt', { type:'text', text:'hi' });
    expect(replyMessage.mock.calls[0][1].text).toBe('hi');  // banner off
    on = true;
    await c.reply('rt', { type:'text', text:'bye' });
    expect(replyMessage.mock.calls[1][1].text).toContain('[DEMO]');  // now on
  });

  it('function form banner toggles on push too', async () => {
    const { LineClient } = await import('../../src/server/line/line-client');
    let on = true;
    const c = new LineClient({ channelAccessToken:'t', channelSecret:'s', demoBanner: () => on });
    await c.push('U1', { type:'text', text:'msg' });
    expect(pushMessage.mock.calls[0][1].text).toContain('[DEMO]');
    on = false;
    await c.push('U1', { type:'text', text:'msg2' });
    expect(pushMessage.mock.calls[1][1].text).toBe('msg2');
  });
});
