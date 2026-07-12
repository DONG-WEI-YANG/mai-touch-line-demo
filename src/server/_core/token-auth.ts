import { logError } from './logError';
import { ErrorIds } from '../constants/errorIds';

export type SyntheticUser = {
  id: number;
  openId: string;
  email: string;
  name: string;
  role: 'resident' | 'admin' | 'logistics';
  loginMethod: 'token';
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
  picture: string | null;
  unitId: number | null;
  tier: 'Platinum' | 'Diamond' | 'Black';
};

type Mapping = { envName: string; build: () => SyntheticUser };

const MAPPINGS: Mapping[] = [
  { envName: 'WEB_ADMIN_TOKEN',     build: () => mk(2, 'demo-admin-001',     'admin@demo.local',     'Demo Admin',     'admin') },
  { envName: 'WEB_LOGISTICS_TOKEN', build: () => mk(3, 'demo-logistics-001', 'logistics@demo.local', 'Demo Logistics', 'logistics') },
  { envName: 'WEB_RESIDENT_TOKEN',  build: () => mk(1, 'demo-seed-001',      'seed@demo.local',      'Demo Resident',  'resident') },
];

function mk(id: number, openId: string, email: string, name: string,
            role: SyntheticUser['role']): SyntheticUser {
  const now = new Date();
  return { id, openId, email, name, role, loginMethod: 'token',
           createdAt: now, updatedAt: now, lastSignedIn: now,
           picture: null, unitId: null, tier: 'Platinum' as const };
}

export function userFromToken(token: string | null | undefined): SyntheticUser | null {
  if (!token) return null;
  for (const m of MAPPINGS) {
    const expected = process.env[m.envName];
    if (expected && token === expected) return m.build();
  }
  return null;
}

/**
 * Resolve a per-LINE-user personal token via the web_tokens table. Returns null
 * if not found. Called from createContext as a fallback after the env demo
 * tokens above don't match. The User object mirrors what userFromToken
 * synthesizes — only the fields tRPC procedures touch are populated.
 *
 * Sync (better-sqlite3) so createContext can stay simple. The table is tiny
 * (one row per LINE friend) and the query hits the PK index.
 */
export function userFromPersonalToken(
  token: string,
  db: import('better-sqlite3').Database,
): SyntheticUser | null {
  if (!token) return null;
  try {
    const row = db.prepare(`
      SELECT u.id, u.openId, u.email, u.name, u.role, u.unitId, u.tier
      FROM web_tokens wt
      JOIN users u ON u.id = wt.user_id
      WHERE wt.token = ?
      LIMIT 1
    `).get(token) as undefined | {
      id: number; openId: string; email: string | null; name: string | null;
      role: 'resident' | 'admin' | 'logistics';
      unitId: number | null;
      tier: 'Platinum' | 'Diamond' | 'Black';
    };
    if (!row) return null;
    const now = new Date();
    return {
      id: row.id,
      openId: row.openId,
      email: row.email ?? '',
      name: row.name ?? 'Resident',
      role: row.role,
      loginMethod: 'token',
      createdAt: now, updatedAt: now, lastSignedIn: now,
      picture: null,
      unitId: row.unitId,
      tier: row.tier,
    };
  } catch (err) {
    // Audit finding: a swallowed DB error here silently turns a VALID token into
    // "unauthenticated" (and hides a broken web_tokens query, e.g. missing table).
    // Still return null so auth fails closed, but never do it invisibly.
    logError(ErrorIds.AUTH_TOKEN_LOOKUP_FAILED, 'userFromPersonalToken lookup failed', { cause: err });
    return null;
  }
}
