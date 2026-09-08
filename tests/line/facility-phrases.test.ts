import { describe, expect, it } from 'vitest';
import { recognizeFacilityPhrase } from '../../src/server/line/ai/facility-phrases';

describe('common facility phrases', () => {
  it.each([
    ['我想游泳', 'pool'], ['我要健身', 'gym'], ['預約重訓室', 'gym'],
    ['我要使用會議室', 'meeting_room'], ['預約交誼廳', 'lounge'],
    ['我想烤肉', 'bbq'], ['我要蒸桑拿', 'sauna'], ['游泳池', 'pool'],
  ])('%s selects %s', (text, facility) => {
    expect(recognizeFacilityPhrase(text)?.slots.facility).toBe(facility);
  });
  it.each(['我想運動', '有哪些公設', '我要預約設施'])('%s offers selection', text => {
    expect(recognizeFacilityPhrase(text)?.intent).toBe('facility.list');
  });
  it.each(['泳池壞了', '取消健身房預約', '明天七點游泳', '不要游泳', '游泳或健身', '泳池幾點關門'])('%s remains with AI', text => {
    expect(recognizeFacilityPhrase(text)).toBeUndefined();
  });
});
