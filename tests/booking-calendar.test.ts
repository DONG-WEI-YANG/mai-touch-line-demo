import { expect,it } from 'vitest';
import { monthDays,shiftMonth,taipeiToday } from '../src/lib/booking-calendar';
it('handles leap years and year boundaries without timezone drift',()=>{
  expect(monthDays('2024-02').filter(Boolean)).toHaveLength(29);
  expect(monthDays('2026-02').filter(Boolean)).toHaveLength(28);
  expect(monthDays('2026-09')[2]).toBe('2026-09-01');
  expect(shiftMonth('2026-01',-1)).toBe('2025-12');
  expect(shiftMonth('2026-12',1)).toBe('2027-01');
  expect(taipeiToday(new Date('2026-09-08T17:00:00Z'))).toBe('2026-09-09');
});
