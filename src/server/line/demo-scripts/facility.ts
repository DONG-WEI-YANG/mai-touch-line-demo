import type { DemoScript } from './types';
import { facilityCarousel } from '../flex/facilityCarousel';
import { dateTimePicker } from '../flex/dateTimePicker';
import { bookingConfirm } from '../flex/bookingConfirm';
import { bookingDone } from '../flex/bookingDone';
import { workOrderCard } from '../flex/workOrderCard';

const text = (s: string, delayMs = 1500) => ({
  kind: 'bot_say' as const, message: { type: 'text', text: s }, delayMs,
});

export const facilityScript: DemoScript = {
  id: 'facility',
  title: { 'zh-TW': '預約健身房 walkthrough', en: 'Book a facility', ja: '施設予約デモ' },
  steps: [
    text('🎬 開始示範:住戶想預約健身房', 0),
    text('👤 住戶:「想訂禮拜六晚上的健身房」'),
    { kind: 'bot_say', message: facilityCarousel('zh-TW'), delayMs: 1000 },
    { kind: 'wait_user', expect: 'postback', postbackData: 'act=book&fac=gym' },
    { kind: 'bot_say', message: dateTimePicker('time', 'zh-TW'), delayMs: 500 },
    { kind: 'wait_user', expect: 'postback' },
    { kind: 'bot_say', message: bookingConfirm({ facility: 'gym', date: '2026-05-09', time: '19:00' }, 'zh-TW'), delayMs: 500 },
    { kind: 'wait_user', expect: 'postback', postbackData: 'act=confirm' },
    { kind: 'side_effect', trpcCall: {
        router: 'amenities', procedure: 'book',
        input: { facility: 'gym', date: '2026-05-09', time: '19:00', userId: 1 },
    }},
    { kind: 'bot_say', message: bookingDone({ orderId: 'BK-DEMO-001' }, 'zh-TW'), delayMs: 500 },
    { kind: 'simulate_housekeeper', message: '🛎️ 管家端收到通知…', delayMs: 3000 },
    { kind: 'bot_say', message: workOrderCard({
        orderId: 'BK-DEMO-001', from: '住戶 A', intent: 'facility.book',
        summary: '健身房 2026-05-09 19:00',
    }, 'zh-TW'), delayMs: 500 },
    text('✅ Demo 完成!輸入 /demo list 查看其他腳本', 1000),
  ],
};
