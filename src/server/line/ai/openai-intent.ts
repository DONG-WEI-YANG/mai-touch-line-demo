import OpenAI from 'openai';
import { z } from 'zod';
import type { IntentClassifier, IntentResult } from './types';
import { AiUnavailableError } from './types';

const SYSTEM_PROMPT = `
You are the intent classifier for "m'AI Touch", a luxury residential building's housekeeper bot.
Output ONLY a single JSON object matching this exact shape (no markdown, no code fences):
{
  "intent": "<one of: facility.book | facility.cancel | facility.list | repair.report | visitor.notify | complaint.file | workorder.status | small_talk | unknown>",
  "confidence": <number 0..1>,
  "slots": {
    "date": "YYYY-MM-DD",          // optional, only if user stated it
    "time": "HH:mm",                // optional, 24-hour
    "facility": "<one of: gym | pool | meeting_room | lounge | bbq | sauna>",  // optional
    "duration_min": <number>,
    "location": "<string>",         // e.g. "12F-A"
    "issue": "<string>",            // for repair/complaint
    "visitor_name": "<string>",
    "visitor_count": <number>,
    "urgency": "<one of: low | med | high>"
  },
  "language": "<one of: zh-TW | en | ja>",
  "rephrase": "<one-sentence echo in detected language>"
}

Rules:
- "intent" MUST use the dotted format above (facility.book NOT book_facility).
- Extract slots ONLY if user clearly stated them. NEVER invent dates/times.
- "small_talk" for greetings/chitchat; "unknown" if you genuinely cannot tell.
- "rephrase" confirms what you understood ("您要週六晚上 7 點預約健身房,對嗎?").
- "confidence" < 0.6 means you are guessing.

Examples:
- "我想預約週六晚上 7 點的健身房" → {"intent":"facility.book","confidence":0.95,"slots":{"facility":"gym","time":"19:00"},"language":"zh-TW","rephrase":"您要週六晚上 7 點預約健身房,對嗎?"}
- "12 樓水龍頭壞了" → {"intent":"repair.report","confidence":0.9,"slots":{"issue":"faucet broken","location":"12F","urgency":"med"},"language":"zh-TW","rephrase":"12 樓水龍頭故障,我幫您建立工單。"}
- "你好" → {"intent":"small_talk","confidence":0.99,"slots":{},"language":"zh-TW","rephrase":"您好!"}
`.trim();

// Normalize common alternative formats (snake_case, hyphen, etc.) to our canonical
// dotted intent enum. Models occasionally drift even with explicit prompt.
const INTENT_ALIASES: Record<string, string> = {
  'book_facility':    'facility.book',
  'facility_book':    'facility.book',
  'book-facility':    'facility.book',
  'cancel_facility':  'facility.cancel',
  'facility_cancel':  'facility.cancel',
  'list_facility':    'facility.list',
  'facility_list':    'facility.list',
  'report_repair':    'repair.report',
  'repair_report':    'repair.report',
  'notify_visitor':   'visitor.notify',
  'visitor_notify':   'visitor.notify',
  'file_complaint':   'complaint.file',
  'complaint_file':   'complaint.file',
  'status_workorder': 'workorder.status',
  'workorder_status': 'workorder.status',
  'smalltalk':        'small_talk',
  'small-talk':       'small_talk',
};

function normalizeIntent(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  return INTENT_ALIASES[raw] ?? raw;
}

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
        // Strip markdown code fences if model wrapped JSON in them (Gemini does this sometimes)
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        const obj = JSON.parse(cleaned);
        // Normalize intent aliases (snake_case, hyphen) to canonical dotted form
        if (obj && typeof obj === 'object') {
          (obj as { intent?: unknown }).intent = normalizeIntent((obj as { intent?: unknown }).intent);
        }
        const parsed = Schema.safeParse(obj);
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
