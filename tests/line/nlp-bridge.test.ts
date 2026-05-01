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

  it('adapts all 9 slot entity types', async () => {
    nock(BASE).post('/api/intent/classify').reply(200, {
      intent_class: 'visitor_notify', score: 0.8,
      entities: [
        { type:'facility',      value:'lounge' },
        { type:'date',          value:'2026-05-09' },
        { type:'time',          value:'19:00' },
        { type:'location',      value:'12F-A' },
        { type:'issue',         value:'guest arriving' },
        { type:'visitor_name',  value:'John Smith' },
        { type:'visitor_count', value:'3' },
        { type:'urgency',       value:'low' },
        { type:'duration_min',  value:'60' },
      ],
      detected_lang: 'en',
    });
    const ai = new NlpBridge({ baseUrl: BASE, timeoutMs: 2000 });
    const r = await ai.classify('hi', { userId: 'U' });
    expect(r.slots.facility).toBe('lounge');
    expect(r.slots.date).toBe('2026-05-09');
    expect(r.slots.time).toBe('19:00');
    expect(r.slots.location).toBe('12F-A');
    expect(r.slots.issue).toBe('guest arriving');
    expect(r.slots.visitor_name).toBe('John Smith');
    expect(r.slots.visitor_count).toBe(3);   // number
    expect(r.slots.urgency).toBe('low');
    expect(r.slots.duration_min).toBe(60);   // number
    expect(r.intent).toBe('visitor.notify');
    expect(r.language).toBe('en');
  });

  it('throws AiUnavailableError on 5xx', async () => {
    nock(BASE).post('/api/intent/classify').reply(503, 'down');
    const ai = new NlpBridge({ baseUrl: BASE, timeoutMs: 2000 });
    await expect(ai.classify('x', { userId: 'U' })).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
