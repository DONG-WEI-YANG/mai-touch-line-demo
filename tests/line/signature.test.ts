import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifySignature } from '../../src/server/line/signature';

const SECRET = 'test-channel-secret';
const BODY = JSON.stringify({ events: [] });
const VALID_SIG = crypto.createHmac('sha256', SECRET).update(BODY).digest('base64');

describe('verifySignature', () => {
  it('accepts a valid signature', () => {
    expect(verifySignature(BODY, VALID_SIG, SECRET)).toBe(true);
  });
  it('rejects a tampered body', () => {
    expect(verifySignature(BODY + 'x', VALID_SIG, SECRET)).toBe(false);
  });
  it('rejects an empty signature', () => {
    expect(verifySignature(BODY, '', SECRET)).toBe(false);
  });
  it('rejects a wrong-length signature without throwing', () => {
    expect(verifySignature(BODY, 'AAAA', SECRET)).toBe(false);
  });
});
