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
