import { describe, it, expect } from 'vitest';
import { parsePostback } from '../../src/server/line/postback';

describe('parsePostback', () => {
  it('parses act+slot+val', () => {
    expect(parsePostback('act=book&fac=gym')).toEqual({ act:'book', fac:'gym' });
  });
  it('returns empty object on empty data', () => {
    expect(parsePostback('')).toEqual({});
  });
  it('decodes URL-encoded values', () => {
    expect(parsePostback('issue=' + encodeURIComponent('水龍頭壞了'))).toEqual({ issue: '水龍頭壞了' });
  });
  it('rejects oversized data (>300 chars)', () => {
    expect(parsePostback('k=' + 'x'.repeat(2000))).toEqual({});
  });
});
