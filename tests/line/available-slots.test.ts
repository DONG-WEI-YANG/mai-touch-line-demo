import { describe, expect, it, vi } from 'vitest';
const getSlots=vi.hoisted(()=>vi.fn());
vi.mock('../../src/server/routers/amenities',()=>({ amenitiesRouter:{createCaller:()=>({getSlots})} }));
import { availableSlots, slotMessage } from '../../src/server/line/record-query';
describe('LINE available slots',()=>{
  it('excludes elapsed Taipei hours and occupied slots',async()=>{
    getSlots.mockResolvedValue([
      {startTime:'08:00',endTime:'09:00',available:true,remainingCapacity:1},
      {startTime:'10:00',endTime:'11:00',available:false,remainingCapacity:0},
      {startTime:'11:00',endTime:'12:00',available:true,remainingCapacity:2},
    ]);
    const now=new Date('2026-09-08T01:00:00Z');
    expect(await availableSlots(1,'2026-09-08',now)).toEqual([{startTime:'11:00',endTime:'12:00',available:true,remainingCapacity:2}]);
    expect(await availableSlots(1,'2026-09-07',now)).toEqual([]);
    await expect(availableSlots(1,'2026-02-30',now)).rejects.toThrow();
  });
  it('paginates without exceeding LINE quick reply limits',()=>{
    const slots=Array.from({length:24},(_,i)=>({startTime:`${String(i).padStart(2,'0')}:00`,endTime:'23:59',remainingCapacity:1}));
    const msg=slotMessage(slots,'2026-09-12');
    expect(msg.quickReply.items).toHaveLength(12);
    expect(msg.quickReply.items[10].action.data).toBe('slotsOffset=10');
    expect(slotMessage(slots,'2026-09-12',20).quickReply.items).toHaveLength(5);
  });
});
