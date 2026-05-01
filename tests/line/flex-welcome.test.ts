import { describe, it, expect } from 'vitest';
import { welcome } from '../../src/server/line/flex/welcome';

describe('welcome flex', () => {
  it('returns flex with localized title', () => {
    const m = welcome('zh-TW');
    expect(m.type).toBe('flex');
    expect(m.altText).toContain('歡迎');
  });
  it('localizes to en', () => {
    expect(welcome('en').altText).toContain('Welcome');
  });
});
