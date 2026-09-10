import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const { validateReleaseEnv } = createRequire(import.meta.url)('../scripts/build-firebase-release.cjs');
const publicEnv = { EXPO_PUBLIC_API_URL: 'https://mai-touch-history-20260908.web.app', EXPO_PUBLIC_DEMO_ADMIN_TOKEN:'a'.repeat(32), EXPO_PUBLIC_DEMO_LOGISTICS_TOKEN:'b'.repeat(32), EXPO_PUBLIC_DEMO_RESIDENT_TOKEN:'c'.repeat(32) };
const backendEnv = { WEB_ADMIN_TOKEN:'a'.repeat(32), WEB_LOGISTICS_TOKEN:'b'.repeat(32), WEB_RESIDENT_TOKEN:'c'.repeat(32) };
describe('release environment guard', () => {
 it('accepts matching current deployment', () => expect(() => validateReleaseEnv(publicEnv,backendEnv)).not.toThrow());
 it('rejects local origins', () => expect(() => validateReleaseEnv({...publicEnv,EXPO_PUBLIC_API_URL:'http://localhost:3000'},backendEnv)).toThrow());
 it('rejects stale or missing public credentials without exposing their values', () => {
  expect(() => validateReleaseEnv({...publicEnv,EXPO_PUBLIC_DEMO_ADMIN_TOKEN:'secret-mismatch'},backendEnv)).toThrow(/ADMIN/);
  expect(() => validateReleaseEnv({...publicEnv,EXPO_PUBLIC_DEMO_RESIDENT_TOKEN:''},backendEnv)).toThrow();
 });
});
