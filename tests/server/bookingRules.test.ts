import { expect, it } from 'vitest';
import { validateBookingWindow } from '../../src/server/services/bookingRules';
const schedule={openTime:'08:00',closeTime:'22:00',slotDurationMinutes:60};
const input={date:'2099-12-31',startTime:'09:00',endTime:'11:00',guestCount:1};
it.each([{date:'2099-02-29'},{date:'2000-01-01'},{startTime:'25:00',endTime:'26:00'},{startTime:'10:99',endTime:'12:00'},{startTime:'07:00'},{endTime:'23:00'},{startTime:'09:30'},{endTime:'10:30'},{guestCount:0}])('rejects invalid request %j',patch=>{
  expect(()=>validateBookingWindow({...input,...patch},schedule)).toThrow();
});
it('accepts adjacent aligned slots and compares current time in Taipei',()=>{
  expect(()=>validateBookingWindow(input,schedule)).not.toThrow();
  expect(()=>validateBookingWindow({...input,date:'2026-09-10',startTime:'09:00',endTime:'10:00'},schedule,new Date('2026-09-10T02:00:00Z'))).toThrow();
});
