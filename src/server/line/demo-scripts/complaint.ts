import type { DemoScript } from './types';

const text = (s: string, delayMs = 1500) => ({
  kind: 'bot_say' as const, message: { type: 'text', text: s }, delayMs,
});

export const complaintScript: DemoScript = {
  id: 'complaint',
  title: { 'zh-TW': '投訴示範', en: 'Complaint walkthrough', ja: '苦情デモ' },
  steps: [
    text('🎬 開始示範:住戶投訴噪音', 0),
    text('👤 住戶:「樓上半夜還在裝修,影響睡眠」'),
    text('🤖 AI: 已記錄投訴,將由管理委員會處理'),
    { kind: 'side_effect', trpcCall: {
        router: 'workOrders', procedure: 'create',
        input: { type: 'complaint', issue: 'late-night construction noise',
                 location: 'upstairs', urgency: 'high', userId: 1 },
    }},
    text('✅ 投訴單 C-DEMO-004 已建立 (24 小時內回覆)'),
    text('✅ Demo 完成', 1000),
  ],
};
