import { describe, it, expect, vi } from 'vitest';
import { makePushHousekeepers } from '../../src/server/line/push-housekeepers';

describe('pushHousekeepers', () => {
  it('pushes workOrderCard to each housekeeper, in their language', async () => {
    const lineUserRepo = { listByRole: vi.fn().mockReturnValue([
      { lineUserId:'H1', language:'zh-TW' },
      { lineUserId:'H2', language:'en' }
    ]) } as any;
    const client = { push: vi.fn().mockResolvedValue(undefined) } as any;
    const fn = makePushHousekeepers({ lineUserRepo, client, channelId:'C' });
    await fn({ orderId:'BK-1', from:'U1', intent:'facility.book', summary:'gym 19:00' });
    expect(lineUserRepo.listByRole).toHaveBeenCalledWith('C', 'housekeeper');
    expect(client.push).toHaveBeenCalledTimes(2);
  });

  it('survives push failure to one housekeeper (continues to others)', async () => {
    const lineUserRepo = { listByRole: vi.fn().mockReturnValue([
      { lineUserId:'H1', language:'zh-TW' },
      { lineUserId:'H2', language:'en' }
    ]) } as any;
    const client = {
      push: vi.fn()
        .mockRejectedValueOnce(new Error('user blocked'))
        .mockResolvedValueOnce(undefined),
    } as any;
    const fn = makePushHousekeepers({ lineUserRepo, client, channelId:'C' });
    await expect(fn({ orderId:'BK-1', from:'U1', intent:'facility.book', summary:'gym' }))
      .resolves.toBeUndefined();
    expect(client.push).toHaveBeenCalledTimes(2);
  });

  it('no housekeepers → no-op (no push call)', async () => {
    const lineUserRepo = { listByRole: vi.fn().mockReturnValue([]) } as any;
    const client = { push: vi.fn() } as any;
    const fn = makePushHousekeepers({ lineUserRepo, client, channelId:'C' });
    await fn({ orderId:'BK-1', from:'U1', intent:'facility.book', summary:'x' });
    expect(client.push).not.toHaveBeenCalled();
  });
});
