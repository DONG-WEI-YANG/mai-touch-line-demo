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
           createdAt: now, updatedAt: now, lastSignedIn: now };
}

export function userFromToken(token: string | null | undefined): SyntheticUser | null {
  if (!token) return null;
  for (const m of MAPPINGS) {
    const expected = process.env[m.envName];
    if (expected && token === expected) return m.build();
  }
  return null;
}
