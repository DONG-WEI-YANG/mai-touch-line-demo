import crypto from 'crypto';

export function verifySignature(rawBody: string, signature: string, channelSecret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', channelSecret).update(rawBody, 'utf8').digest();
  let got: Buffer;
  try { got = Buffer.from(signature, 'base64'); } catch { return false; }
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(got, expected);
}
