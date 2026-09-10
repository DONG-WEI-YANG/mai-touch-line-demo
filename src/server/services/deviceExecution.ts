import { TRPCError } from '@trpc/server';
/** These routes only mutate demo state; no hardware adapter or device ACK exists. */
export function requireSimulationMode(): void {
  const mode = process.env.IOT_EXECUTION_MODE ?? (process.env.APP_PROFILE === 'production' ? 'physical' : 'simulation');
  if (mode !== 'simulation') throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Physical device control requires a configured gateway and device ACK; unavailable on this route.' });
}
export const simulationResult = { success: true, executionMode: 'simulation', acknowledged: false } as const;
