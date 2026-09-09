import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const logoutMutation = trpc.auth.logout.useMutation();

  const user = (q.data ?? null) as AuthUser | null;
  const loading = q.isLoading;
  const error = q.error ?? null;
  const isAuthenticated = useMemo(() => !!user, [user]);

  const refresh = useCallback(() => {
    return utils.auth.me.invalidate();
  }, [utils]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    clearStoredToken();
    await queryClient.cancelQueries();
    queryClient.clear();
    if (typeof window !== "undefined") window.location.replace("/login");
  }, [logoutMutation, queryClient]);

  return { user, loading, error, isAuthenticated, refresh, logout };
}
