import { describe, it, expect } from 'vitest';
import { t } from '../../src/server/line/flex/i18n';

describe('i18n t()', () => {
  it('returns zh-TW by default', () => {
    expect(t('booking.confirm.title', 'zh-TW')).toBe('預約確認');
  });
  it('returns english', () => {
    expect(t('booking.confirm.title', 'en')).toBe('Booking confirmation');
  });
  it('returns japanese', () => {
    expect(t('booking.confirm.title', 'ja')).toBe('予約確認');
  });
  it('returns key itself if completely missing', () => {
    expect(t('totally.unknown.key' as any, 'zh-TW')).toBe('totally.unknown.key');
  });
});
