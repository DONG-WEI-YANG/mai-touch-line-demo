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
    // OPENAI_API_KEY accepts a comma-separated list for round-robin failover
    // (useful when one Gemini free-tier key hits 429 quota — fall through to next).
    const apiKeys = required('OPENAI_API_KEY')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Auto-detect: if any key is a Gemini key (AIzaSy…), or baseURL points at
    // Google's OpenAI-compatible endpoint, AND OPENAI_MODEL still names an
    // OpenAI model (gpt-…), swap to a Gemini model name. Gemini's compat
    // endpoint returns 404 for unknown models like gpt-4o-mini, breaking
    // every classify() call. This fallback keeps demos working without
    // requiring the operator to remember to set OPENAI_MODEL alongside the
    // baseURL — the most common misconfiguration.
    const explicitModel = process.env.OPENAI_MODEL;
    const baseURL = process.env.OPENAI_BASE_URL || undefined;
    const looksLikeGemini =
      apiKeys.some(k => k.startsWith('AIzaSy')) ||
      (baseURL ?? '').includes('generativelanguage.googleapis.com');
    const isOpenAiModelName = !explicitModel || /^gpt-/i.test(explicitModel);
    const model = (looksLikeGemini && isOpenAiModelName)
      ? (process.env.GEMINI_MODEL ?? 'gemini-2.5-flash')
      : (explicitModel ?? 'gpt-4o-mini');

    aiCache = new OpenAIIntent({
      apiKeys,
      model,
      temperature: Number(process.env.OPENAI_TEMPERATURE ?? '0.1'),
      baseURL,
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
