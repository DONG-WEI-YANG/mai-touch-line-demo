import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAi, resetAiCache, resetProfileCache } from '../../src/server/_core/profile';
import { OpenAIIntent } from '../../src/server/line/ai/openai-intent';
import { NlpBridge } from '../../src/server/line/ai/nlp-bridge';

const orig = { ...process.env };
beforeEach(() => { resetProfileCache(); resetAiCache(); });
afterEach(() => { process.env = { ...orig }; resetProfileCache(); resetAiCache(); });

describe('getAi factory', () => {
  it('returns OpenAIIntent for demo profile', () => {
    process.env.DEPLOY_PROFILE = 'demo';
    process.env.OPENAI_API_KEY = 'k';
    expect(getAi()).toBeInstanceOf(OpenAIIntent);
  });
  it('returns NlpBridge for prod profile', () => {
    process.env.DEPLOY_PROFILE = 'prod';
    process.env.NLP_SERVICE_URL = 'http://x';
    expect(getAi()).toBeInstanceOf(NlpBridge);
  });
});
