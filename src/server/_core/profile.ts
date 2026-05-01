export type Profile = 'demo' | 'prod';

let cached: Profile | null = null;

export function getProfile(): Profile {
  if (cached) return cached;
  const raw = process.env.DEPLOY_PROFILE ?? 'prod';
  if (raw !== 'demo' && raw !== 'prod') {
    throw new Error(`DEPLOY_PROFILE must be 'demo' or 'prod', got: ${raw}`);
  }
  cached = raw;
  return cached;
}

export function resetProfileCache(): void { cached = null; }

// Static imports are used here instead of require() / dynamic import() because:
// - require() is not available in Vitest's ESM transform environment (Node 22 ESM)
// - dynamic import() would make getAi() async, requiring callers to await it
// - In a production Vite/Expo bundle, tree-shaking eliminates the unused branch
// - The singleton aiCache ensures only the selected implementation is instantiated
import type { IntentClassifier } from '../line/ai/types';
import { OpenAIIntent } from '../line/ai/openai-intent';
import { NlpBridge } from '../line/ai/nlp-bridge';

let aiCache: IntentClassifier | null = null;

export function getAi(): IntentClassifier {
  if (aiCache) return aiCache;
  const profile = getProfile();
  if (profile === 'demo') {
    aiCache = new OpenAIIntent({
      apiKey:      required('OPENAI_API_KEY'),
      model:       process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      temperature: Number(process.env.OPENAI_TEMPERATURE ?? '0.1'),
    });
  } else {
    aiCache = new NlpBridge({
      baseUrl:   required('NLP_SERVICE_URL'),
      timeoutMs: Number(process.env.NLP_TIMEOUT_MS ?? '8000'),
    });
  }
  return aiCache;
}

export function resetAiCache(): void { aiCache = null; }

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
