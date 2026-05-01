export type Lang = 'zh-TW' | 'en' | 'ja';

export type IntentName =
  | 'facility.book' | 'facility.cancel' | 'facility.list'
  | 'repair.report'
  | 'visitor.notify'
  | 'complaint.file'
  | 'workorder.status'
  | 'small_talk' | 'unknown';

export type Slot = {
  date?: string; time?: string;
  facility?: 'gym' | 'pool' | 'meeting_room' | 'lounge' | 'bbq' | 'sauna';
  duration_min?: number; location?: string; issue?: string;
  visitor_name?: string; visitor_count?: number;
  urgency?: 'low' | 'med' | 'high';
  language_detected?: Lang;
};

export type IntentResult = {
  intent: IntentName;
  confidence: number;
  slots: Slot;
  language: Lang;
  rephrase?: string;
};

export interface IntentClassifier {
  classify(text: string, ctx: { userId: string; history?: string[] }): Promise<IntentResult>;
}

export class AiUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message); this.name = 'AiUnavailableError';
  }
}
