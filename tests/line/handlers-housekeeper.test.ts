import { describe, it, expect, vi } from 'vitest';
import { handleHousekeeper } from '../../src/server/line/handlers/housekeeper';

const mkClient = () => ({ replyOrPush: vi.fn().mockResolvedValue(undefined) });
const baseLineUser = { lineUserId:'H1', role:'housekeeper' as const, language:'zh-TW' as const };

describe('housekeeper handler', () => {
  it('on /accept postback, calls updateOrder + replies success', async () => {
    const updateOrder = vi.fn().mockResolvedValue(undefined);
    const client = mkClient();
    await handleHousekeeper(
      { type:'postback', replyToken:'rt', source:{userId:'H1'},
        postback:{ data:'act=accept&wo=BK-1' } } as any,
      { client: client as any, updateOrder, lineUser: baseLineUser as any });
    expect(updateOrder).toHaveBeenCalledWith('BK-1', { status:'in_progress', acceptedBy:'H1' });
    expect(client.replyOrPush).toHaveBeenCalled();
  });

  it('on /reject postback, calls updateOrder with closed status', async () => {
    const updateOrder = vi.fn().mockResolvedValue(undefined);
    const client = mkClient();
    await handleHousekeeper(
      { type:'postback', replyToken:'rt', source:{userId:'H1'},
        postback:{ data:'act=reject&wo=BK-1' } } as any,
      { client: client as any, updateOrder, lineUser: baseLineUser as any });
    expect(updateOrder).toHaveBeenCalledWith('BK-1', { status:'closed', rejectedBy:'H1' });
  });

  it('on /reassign postback, replies "coming v2" without DB update', async () => {
    const updateOrder = vi.fn();
    const client = mkClient();
    await handleHousekeeper(
      { type:'postback', replyToken:'rt', source:{userId:'H1'},
        postback:{ data:'act=reassign&wo=BK-1' } } as any,
      { client: client as any, updateOrder, lineUser: baseLineUser as any });
    expect(updateOrder).not.toHaveBeenCalled();
    expect(client.replyOrPush).toHaveBeenCalledWith(expect.anything(), 'H1',
      expect.objectContaining({ type:'text', text: expect.stringMatching(/v2|reassign/i) }));
  });

  it('ignores text messages (not in housekeeper flow yet)', async () => {
    const updateOrder = vi.fn();
    const client = mkClient();
    await handleHousekeeper(
      { type:'message', replyToken:'rt', source:{userId:'H1'}, message:{type:'text', text:'hi'} } as any,
      { client: client as any, updateOrder, lineUser: baseLineUser as any });
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('handles updateOrder error gracefully (catches + replies error)', async () => {
    const updateOrder = vi.fn().mockRejectedValue(new Error('db down'));
    const client = mkClient();
    await handleHousekeeper(
      { type:'postback', replyToken:'rt', source:{userId:'H1'},
        postback:{ data:'act=accept&wo=BK-1' } } as any,
      { client: client as any, updateOrder, lineUser: baseLineUser as any });
    // Should reply something (error message) rather than throw
    expect(client.replyOrPush).toHaveBeenCalled();
  });
});
