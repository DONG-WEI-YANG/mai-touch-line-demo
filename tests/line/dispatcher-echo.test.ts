import { describe, it, expect, vi } from 'vitest';
import { dispatch } from '../../src/server/line/dispatcher';

describe('dispatcher echo (stub)', () => {
  it('replies with echoed text via injected lineClient', async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    await dispatch([
      { type:'message', replyToken:'rt-1', source:{userId:'U1'}, message:{type:'text', text:'hello'} }
    ], { lineClient: { reply, push: vi.fn() } as any });
    expect(reply).toHaveBeenCalledWith('rt-1', expect.objectContaining({ type:'text', text: expect.stringContaining('hello') }));
  });

  it('ignores non-text messages in stub', async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    await dispatch([{ type:'message', replyToken:'rt', source:{userId:'U2'}, message:{type:'sticker'} }],
      { lineClient: { reply, push: vi.fn() } as any });
    expect(reply).not.toHaveBeenCalled();
  });
});
