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
});
