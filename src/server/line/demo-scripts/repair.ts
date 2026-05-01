import type { DemoScript } from './types';

const text = (s: string, delayMs = 1500) => ({
  kind: 'bot_say' as const, message: { type: 'text', text: s }, delayMs,
});

export const repairScript: DemoScript = {
  id: 'repair',
  title: { 'zh-TW': '報修示範', en: 'Repair walkthrough', ja: '修理依頼デモ' },
  steps: [
    text('🎬 開始示範:住戶報修水龍頭', 0),
    text('👤 住戶:「12 樓 A 戶水龍頭一直滴水」'),
    text('🤖 AI: 收到!正在為您建立工單,請稍候…'),
    { kind: 'side_effect', trpcCall: {
        router: 'workOrders', procedure: 'create',
        input: { type: 'repair', issue: 'faucet drip', location: '12F-A', urgency: 'med', userId: 1 },
    }},
    text('✅ 工單 WO-DEMO-002 已建立,管家將在 1 小時內到場'),
    { kind: 'simulate_housekeeper', message: '🛎️ (3 秒後) 管家收到通知…', delayMs: 3000 },
    text('🛎️ 管家 王小明:「收到,正在前往」'),
    text('✅ Demo 完成', 1000),
  ],
};
