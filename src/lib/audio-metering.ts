const MIN_METERING_DB = -160;

/**
 * Convert recorder metering in decibels to the 0..1 range consumed by the UI.
 * Native recorders report silence near -160 dB and peak volume near 0 dB.
 */
export function normalizeRecordingMetering(metering?: number): number {
  if (!Number.isFinite(metering)) return 0;
  const normalized = ((metering as number) - MIN_METERING_DB) / -MIN_METERING_DB;
  return Math.max(0, Math.min(1, normalized));
}
