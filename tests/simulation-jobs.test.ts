import { describe, it, expect, vi, beforeEach } from 'vitest';
const fake = vi.hoisted(() => ({ getUserById: vi.fn(), createSystemJob: vi.fn(), getDevicesByUnit: vi.fn(), updateDeviceStatus: vi.fn(), updateJobProgress: vi.fn() }));
vi.mock('../src/server/db', () => fake);
import { appRouter } from '../src/server/routers';
beforeEach(() => {
 vi.resetAllMocks(); fake.getUserById.mockResolvedValue({unitId:1}); fake.createSystemJob.mockResolvedValue(5);
 fake.getDevicesByUnit.mockResolvedValue([{id:1,type:'light'}]);
});
describe('simulation job lifecycle', () => {
 it('awaits completion and labels simulated result', async () => {
  const c=appRouter.createCaller({user:{id:1,role:'resident'}} as any);
  expect(await c.system.runJob({type:'arrival'})).toEqual({jobId:5,executionMode:'simulation',acknowledged:false});
  expect(fake.updateJobProgress).toHaveBeenCalledWith(5,100,expect.stringContaining('physical devices unconfirmed'));
 });
 it('records terminal failure without claiming hardware timeout', async () => {
  fake.updateDeviceStatus.mockRejectedValue(new Error('sqlite write failed'));
  const c=appRouter.createCaller({user:{id:1,role:'resident'}} as any);
  await expect(c.system.runJob({type:'arrival'})).rejects.toThrow('Simulation failed');
  expect(fake.updateJobProgress).toHaveBeenCalledWith(5,0,expect.stringContaining('Simulation failed'),'failed');
 });
});
