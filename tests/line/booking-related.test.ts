import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({ getBookingById:vi.fn(), related:vi.fn(), raw:vi.fn() }));
vi.mock('../../src/server/db',()=>({getBookingById:mocks.getBookingById}));
vi.mock('../../src/server/database/adapter',()=>({dbManager:{getRawSqlite:mocks.raw}}));
vi.mock('../../src/server/line/record-links',()=>({makeRecordLinks:()=>({related:mocks.related})}));
import { bookingsRouter } from '../../src/server/routers/bookings';
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.getBookingById.mockResolvedValue({id:1,userId:1});
  mocks.related.mockReturnValue([{ref:'BK-1'},{ref:'V-1',detail:'訪客'}]);
});
it('rejects unrelated residents before reading linked records',async()=>{
  const caller=bookingsRouter.createCaller({user:{id:2,role:'resident'}} as any);
  await expect(caller.relatedRecords({id:1})).rejects.toMatchObject({code:'NOT_FOUND'});
  expect(mocks.raw).not.toHaveBeenCalled();
});
it.each(['resident','admin','logistics'])('permits authorized %s to view linked records',async(role)=>{
  const caller=bookingsRouter.createCaller({user:{id:1,role}} as any);
  expect(await caller.relatedRecords({id:1})).toEqual([{ref:'V-1',detail:'訪客'}]);
  expect(mocks.related).toHaveBeenCalledWith('BK-1',expect.objectContaining({userId:1,staff:role!=='resident'}));
});
