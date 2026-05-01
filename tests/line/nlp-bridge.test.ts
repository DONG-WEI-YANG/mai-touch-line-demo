import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { NlpBridge } from '../../src/server/line/ai/nlp-bridge';
import { AiUnavailableError } from '../../src/server/line/ai/types';

const BASE = 'http://nlp.local';
beforeEach(() => nock.cleanAll());
afterEach(() => nock.cleanAll());

describe('NlpBridge', () => {
  it('adapts NLP service shape to IntentResult', async () => {
    nock(BASE).post('/api/intent/classify').reply(200, {
      intent_class: 'facility_book', score: 0.87,
      entities: [{ type: 'facility', value: 'gym' }, { type: 'date', value: '2026-05-09' }],
      detected_lang: 'zh-TW',
    });
    const ai = new NlpBridge({ baseUrl: BASE, timeoutMs: 2000 });
    const r = await ai.classify('hi', { userId: 'U1' });
    expect(r.intent).toBe('facility.book');
    expect(r.slots.facility).toBe('gym');
    expect(r.slots.date).toBe('2026-05-09');
    expect(r.language).toBe('zh-TW');
  });

  it('throws AiUnavailableError on 5xx', async () => {
    nock(BASE).post('/api/intent/classify').reply(503, 'down');
    const ai = new NlpBridge({ baseUrl: BASE, timeoutMs: 2000 });
    await expect(ai.classify('x', { userId: 'U' })).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
