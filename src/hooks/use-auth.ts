import { useCallback, useMemo } from 'react';
import { trpc, clearStoredToken } from '../lib/trpc';

export type AuthUser = {
  id: number;
  openId: string;
  name: string;
  email: string;
  role: 'resident' | 'admin' | 'logistics';
  loginMethod: string;
  lastSignedIn: Date;
  picture: string | null;
  unitId: number | null;
  tier: 'Platinum' | 'Diamond' | 'Black';
};

export function useAuth() {
  const q = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();

  const user = (q.data ?? null) as AuthUser | null;
  const loading = q.isLoading;
  const error = q.error ?? null;
  const isAuthenticated = useMemo(() => !!user, [user]);

  const refresh = useCallback(() => {
    return utils.auth.me.invalidate();
  }, [utils]);

  const logout = useCallback(async () => {
    clearStoredToken();
    await utils.auth.me.invalidate();
  }, [utils]);

  return { user, loading, error, isAuthenticated, refresh, logout };
}
