import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getProfile, resetProfileCache } from '../../src/server/_core/profile';

describe('profile', () => {
  const original = process.env.DEPLOY_PROFILE;
  beforeEach(() => resetProfileCache());
  afterEach(() => { process.env.DEPLOY_PROFILE = original; resetProfileCache(); });

  it('defaults to "prod" when DEPLOY_PROFILE unset', () => {
    delete process.env.DEPLOY_PROFILE;
    expect(getProfile()).toBe('prod');
  });
  it('returns "demo" when DEPLOY_PROFILE=demo', () => {
    process.env.DEPLOY_PROFILE = 'demo';
    expect(getProfile()).toBe('demo');
  });
  it('throws on unknown profile', () => {
    process.env.DEPLOY_PROFILE = 'staging';
    expect(() => getProfile()).toThrow(/DEPLOY_PROFILE/);
  });
});
