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

  it('retries once then throws AiUnavailableError', async () => {
    // Use Once×2 instead of persistent mockRejectedValue to avoid unhandled-rejection
    // tracking in Vitest 4 (the permanent form leaves a standing rejected-promise object
    // that the runner marks as leaked even though classify() awaits and catches both).
    create.mockRejectedValueOnce(new Error('429'));
    create.mockRejectedValueOnce(new Error('429'));
    const ai = new OpenAIIntent({ apiKey: 'k', model: 'gpt-4o-mini' });
    await expect(ai.classify('hi', { userId: 'U3' })).rejects.toBeInstanceOf(AiUnavailableError);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
