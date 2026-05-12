import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiUnavailableError } from '../../src/server/line/ai/types';
import { OpenAIIntent } from '../../src/server/line/ai/openai-intent';

const create = vi.fn();

vi.mock('openai', () => {
  class OpenAI {
    chat = { completions: { create } };
    constructor(_opts: any) {}
  }
  return { default: OpenAI };
});

beforeEach(() => create.mockReset());

const ok = (body: any) => ({ choices: [{ message: { content: JSON.stringify(body) } }] });

describe('OpenAIIntent', () => {
  it('parses facility.book intent + slots', async () => {
    create.mockResolvedValueOnce(ok({
      intent: 'facility.book', confidence: 0.92,
      slots: { facility: 'gym', date: '2026-05-09', time: '19:00' },
      language: 'zh-TW', rephrase: '我聽到您想預約週六晚上 7 點的健身房,對嗎?'
    }));
    const ai = new OpenAIIntent({ apiKey: 'k', model: 'gpt-4o-mini' });
    const r = await ai.classify('我想預約週六晚上7點的健身房', { userId: 'U1' });
    expect(r.intent).toBe('facility.book');
    expect(r.slots.facility).toBe('gym');
    expect(r.confidence).toBeCloseTo(0.92);
  });

  it('returns unknown on schema-violating output', async () => {
    create.mockResolvedValueOnce(ok({ intent: 'NOT_REAL', confidence: 1.5, slots: {}, language: 'xx' }));
    const ai = new OpenAIIntent({ apiKey: 'k', model: 'gpt-4o-mini' });
    const r = await ai.classify('???', { userId: 'U2' });
    expect(r.intent).toBe('unknown');
    expect(r.confidence).toBe(0);
  });

  it('retries then throws AiUnavailableError after exhausting attempts', async () => {
    // Use Once×N instead of persistent mockRejectedValue to avoid unhandled-rejection
    // tracking in Vitest 4 (the permanent form leaves a standing rejected-promise object
    // that the runner marks as leaked even though classify() awaits and catches both).
    create.mockRejectedValueOnce(new Error('429'));
    create.mockRejectedValueOnce(new Error('429'));
    // maxAttempts:2 + retryBaseDelayMs:0 keeps this fast and deterministic.
    const ai = new OpenAIIntent({ apiKey: 'k', model: 'gpt-4o-mini', maxAttempts: 2, retryBaseDelayMs: 0 });
    await expect(ai.classify('hi', { userId: 'U3' })).rejects.toBeInstanceOf(AiUnavailableError);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('falls back to second apiKey on first key 429', async () => {
    create.mockRejectedValueOnce(Object.assign(new Error('quota'), { status: 429 }));
    create.mockResolvedValueOnce(ok({
      intent: 'small_talk', confidence: 0.99, slots: {}, language: 'zh-TW',
    }));
    const ai = new OpenAIIntent({ apiKeys: ['k1', 'k2'], model: 'gpt-4o-mini', retryBaseDelayMs: 0 });
    const r = await ai.classify('hi', { userId: 'U4' });
    expect(r.intent).toBe('small_talk');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('strips null/empty slot values before schema parse (Gemini returns explicit null)', async () => {
    create.mockResolvedValueOnce(ok({
      intent: 'repair.report', confidence: 0.95,
      slots: { date: null, time: null, facility: null, location: '客廳', issue: '冷氣壞了', urgency: null },
      language: 'zh-TW', rephrase: '客廳冷氣維修',
    }));
    const ai = new OpenAIIntent({ apiKey: 'k', model: 'gemini-flash-latest', retryBaseDelayMs: 0 });
    const r = await ai.classify('客廳冷氣壞了', { userId: 'U5' });
    expect(r.intent).toBe('repair.report');
    expect(r.slots.location).toBe('客廳');
    expect(r.slots.issue).toBe('冷氣壞了');
    expect(r.slots.date).toBeUndefined();
  });
});
