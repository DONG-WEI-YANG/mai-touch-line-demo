import type { IntentResult, Lang, Slot } from './types';

// Exact phrases only: longer requests may contain dates, negation, or repairs.
const aliases: [NonNullable<Slot['facility']>, string[]][] = [
  ['gym', ['健身房', '健身室', '重訓室', '健身', '重訓', '練重訓']],
  ['pool', ['游泳池', '泳池', '游泳', '室內泳池', '游泳去']],
  ['meeting_room', ['會議室', '開會', '會議空間']],
  ['lounge', ['交誼廳', '交誼室', '休憩廳', '休息室']],
  ['bbq', ['烤肉區', '燒烤區', '烤肉', '燒烤', 'BBQ']],
  ['sauna', ['三溫暖', '桑拿', '蒸桑拿', '蒸氣室', '蒸汽室']],
];
const prefixes = ['', '我想', '我要', '想', '想要', '我想要', '我要去', '我想去', '去', '預約', '我要預約', '我想預約', '幫我預約', '請幫我預約', '使用', '我要使用'];
const phrases = new Map<string, NonNullable<Slot['facility']>>();
for (const [facility, names] of aliases) {
  for (const name of names) for (const prefix of prefixes) phrases.set(prefix + name.toLowerCase(), facility);
}
const selection = new Set(['我想運動', '我要運動', '運動', '有哪些公設', '有哪些設施', '公設', '公共設施', '公設預約', '預約公設', '預約設施', '我要預約設施', '我要預約公設']);

export function recognizeFacilityPhrase(text: string, language: Lang = 'zh-TW'): IntentResult | undefined {
  const normalized = text.trim().replace(/[。！!？?]+$/u, '').replace(/\s+/g, '').toLowerCase();
  if (selection.has(normalized)) return { intent: 'facility.list', confidence: 1, slots: {}, language };
  const facility = phrases.get(normalized);
  if (facility) return { intent: 'facility.book', confidence: 1, slots: { facility }, language };
  return undefined;
}
