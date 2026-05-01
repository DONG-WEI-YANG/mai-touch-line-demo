import type { Lang } from '../ai/types';

export type DemoStep =
  | { kind: 'bot_say'; message: any; delayMs?: number }
  | { kind: 'wait_user'; expect: 'any' | 'postback'; postbackData?: string }
  | { kind: 'simulate_housekeeper'; message: string; delayMs: number }
  | { kind: 'side_effect'; trpcCall: { router: string; procedure: string; input: unknown } };

export type DemoScript = {
  id: 'facility' | 'repair' | 'visitor' | 'complaint';
  title: Record<Lang, string>;
  steps: DemoStep[];
};
