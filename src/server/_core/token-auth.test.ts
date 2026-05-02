import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { userFromToken } from './token-auth';

const orig = { ...process.env };
beforeEach(() => {
  process.env.WEB_ADMIN_TOKEN     = 'tok-admin';
  process.env.WEB_LOGISTICS_TOKEN = 'tok-logi';
  process.env.WEB_RESIDENT_TOKEN  = 'tok-res';
});
afterEach(() => { process.env = { ...orig }; });

describe('userFromToken', () => {
  it('returns admin synthetic user for admin token', () => {
    const u = userFromToken('tok-admin');
    expect(u?.role).toBe('admin');
    expect(u?.id).toBe(2);
    expect(u?.email).toBe('admin@demo.local');
    expect(u?.loginMethod).toBe('token');
  });
  it('returns logistics synthetic user for logistics token', () => {
    const u = userFromToken('tok-logi');
    expect(u?.role).toBe('logistics');
    expect(u?.id).toBe(3);
  });
  it('returns resident synthetic user for resident token', () => {
    const u = userFromToken('tok-res');
    expect(u?.role).toBe('resident');
    expect(u?.id).toBe(1);
  });
  it('returns null for empty token', () => {
    expect(userFromToken('')).toBeNull();
    expect(userFromToken(null)).toBeNull();
    expect(userFromToken(undefined)).toBeNull();
  });
  it('returns null for unknown token', () => {
    expect(userFromToken('not-real')).toBeNull();
  });
  it('returns null when matching env unset', () => {
    delete process.env.WEB_ADMIN_TOKEN;
    expect(userFromToken('tok-admin')).toBeNull();
  });
});
