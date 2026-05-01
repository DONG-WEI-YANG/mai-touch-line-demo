import type { IntentClassifier, IntentResult, IntentName, Lang } from './types';
import { AiUnavailableError } from './types';

const INTENT_MAP: Record<string, IntentName> = {
  facility_book:    'facility.book',
  facility_cancel:  'facility.cancel',
  facility_list:    'facility.list',
  repair_report:    'repair.report',
  visitor_notify:   'visitor.notify',
  complaint_file:   'complaint.file',
  workorder_status: 'workorder.status',
  small_talk:       'small_talk',
  unknown:          'unknown',
};

export class NlpBridge implements IntentClassifier {
  constructor(private opts: { baseUrl: string; timeoutMs: number }) {}

  async classify(text: string, ctx: { userId: string; history?: string[] }): Promise<IntentResult> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    try {
      const r = await fetch(`${this.opts.baseUrl}/api/intent/classify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, user_id: ctx.userId, history: ctx.history ?? [] }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new AiUnavailableError(`NLP ${r.status}`);
      const raw = await r.json() as any;
      return adapt(raw);
    } catch (err) {
      if (err instanceof AiUnavailableError) throw err;
      throw new AiUnavailableError('NLP service request failed', err);
    } finally { clearTimeout(t); }
  }
}

function adapt(raw: any): IntentResult {
  const slots: IntentResult['slots'] = {};
  for (const e of (raw.entities ?? []) as Array<{type:string;value:string|number}>) {
    switch (e.type) {
      case 'facility':      slots.facility = e.value as IntentResult['slots']['facility']; break;
      case 'date':          slots.date = String(e.value); break;
      case 'time':          slots.time = String(e.value); break;
      case 'location':      slots.location = String(e.value); break;
      case 'issue':         slots.issue = String(e.value); break;
      case 'visitor_name':  slots.visitor_name = String(e.value); break;
      case 'visitor_count': slots.visitor_count = Number(e.value); break;
      case 'urgency':       slots.urgency = e.value as IntentResult['slots']['urgency']; break;
      case 'duration_min':  slots.duration_min = Number(e.value); break;
    }
  }
  return {
    intent: INTENT_MAP[raw.intent_class] ?? 'unknown',
    confidence: typeof raw.score === 'number' ? raw.score : 0,
    slots,
    language: ((raw.detected_lang as Lang) ?? 'zh-TW'),
  };
}
