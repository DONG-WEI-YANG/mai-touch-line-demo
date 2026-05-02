import OpenAI from 'openai';
import { z } from 'zod';
import type { IntentClassifier, IntentResult } from './types';
import { AiUnavailableError } from './types';

const SYSTEM_PROMPT = `
You are the intent classifier for "m'AI Touch", a luxury residential building's housekeeper bot.
Output ONLY JSON matching the provided schema.
- Detect language: "zh-TW" | "en" | "ja".
- Extract slots ONLY if user clearly stated them. NEVER invent dates/times.
- "intent"="small_talk" for greetings; "unknown" if you genuinely cannot tell.
- "rephrase" is a one-sentence echo in detected language confirming what you understood.
- "confidence" < 0.6 means you are guessing.
`.trim();

const Schema = z.object({
  intent: z.enum(['facility.book', 'facility.cancel', 'facility.list', 'repair.report',
    'visitor.notify', 'complaint.file', 'workorder.status', 'small_talk', 'unknown']),
  confidence: z.number().min(0).max(1),
  slots: z.object({
    date: z.string().optional(),
    time: z.string().optional(),
    facility: z.enum(['gym', 'pool', 'meeting_room', 'lounge', 'bbq', 'sauna']).optional(),
    duration_min: z.number().optional(),
    location: z.string().optional(),
    issue: z.string().optional(),
    visitor_name: z.string().optional(),
    visitor_count: z.number().optional(),
    urgency: z.enum(['low', 'med', 'high']).optional(),
    language_detected: z.enum(['zh-TW', 'en', 'ja']).optional(),
  }).default({}),
  language: z.enum(['zh-TW', 'en', 'ja']),
  rephrase: z.string().optional(),
});

export class OpenAIIntent implements IntentClassifier {
  private client: OpenAI;
  constructor(private opts: { apiKey: string; model: string; temperature?: number; baseURL?: string }) {
    // baseURL allows pointing at OpenAI-compatible endpoints (e.g. Gemini at
    // https://generativelanguage.googleapis.com/v1beta/openai/). When unset,
    // SDK defaults to the official OpenAI endpoint.
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
  }

  async classify(text: string, ctx: { userId: string; history?: string[] }): Promise<IntentResult> {
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...((ctx.history ?? []).slice(-4).map(h => ({ role: 'user' as const, content: h }))),
      { role: 'user' as const, content: text },
    ];

    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await this.client.chat.completions.create({
          model: this.opts.model,
          messages,
          response_format: { type: 'json_object' },
          temperature: this.opts.temperature ?? 0.1,
        });
        const raw = resp.choices[0]?.message?.content ?? '{}';
        const parsed = Schema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          console.warn('[AI] schema parse fail, raw=', raw);
          return { intent: 'unknown', confidence: 0, slots: {}, language: 'zh-TW' };
        }
        return parsed.data as IntentResult;
      } catch (err) {
        lastErr = err;
        console.warn(`[AI] attempt ${attempt + 1} failed:`, err);
      }
    }
    throw new AiUnavailableError('OpenAI classify failed after retry', lastErr);
  }
}
