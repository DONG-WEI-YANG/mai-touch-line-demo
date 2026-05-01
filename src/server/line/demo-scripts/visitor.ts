import type { DemoScript } from './types';

const text = (s: string, delayMs = 1500) => ({
  kind: 'bot_say' as const, message: { type: 'text', text: s }, delayMs,
});

export const visitorScript: DemoScript = {
  id: 'visitor',
  title: { 'zh-TW': '訪客通知示範', en: 'Visitor walkthrough', ja: '訪問者デモ' },
  steps: [
    text('🎬 開始示範:住戶通知訪客來訪', 0),
    text('👤 住戶:「今晚 7 點朋友 John Smith 會來訪 (3 人)」'),
    text('🤖 AI: 已記錄訪客資訊,將通知大廳警衛'),
    { kind: 'side_effect', trpcCall: {
        router: 'workOrders', procedure: 'create',
        input: { type: 'visitor', visitor_name: 'John Smith', visitor_count: 3,
                 date: '2026-05-09', time: '19:00', userId: 1 },
    }},
    text('✅ 訪客通知 V-DEMO-003 已送出'),
    { kind: 'simulate_housekeeper', message: '🛎️ (2 秒) 大廳警衛已收到名單', delayMs: 2000 },
    text('✅ Demo 完成', 1000),
  ],
};
