/**
 * Floating demo role switcher.
 *
 * Renders three pills (Admin / Logistics / Resident) bottom-right that swap
 * the localStorage token and reload to the matching role landing page. Only
 * mounts when at least one of the EXPO_PUBLIC_DEMO_*_TOKEN env vars is set,
 * so production builds (where these are unset) get nothing — no special
 * gating needed at the deploy level.
 *
 * Web-only: relies on localStorage + `window.location.href`. Native demo
 * has no equivalent of demo-token quick-login; returns null there.
 */
import { useMemo } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { trpc, setStoredToken } from '@/lib/trpc';

type Slot = {
  role: 'admin' | 'logistics' | 'resident';
  label: string;
  short: string;
  token: string | undefined;
  landing: string;
};

const SLOTS: Slot[] = [
  { role: 'admin',     label: 'Admin',     short: 'A', token: process.env.EXPO_PUBLIC_DEMO_ADMIN_TOKEN,     landing: '/admin-dashboard' },
  { role: 'logistics', label: 'Logistics', short: 'L', token: process.env.EXPO_PUBLIC_DEMO_LOGISTICS_TOKEN, landing: '/logistics-dashboard' },
  { role: 'resident',  label: 'Resident',  short: 'R', token: process.env.EXPO_PUBLIC_DEMO_RESIDENT_TOKEN,  landing: '/' },
];

export function DemoRoleSwitcher() {
  // Only show when running on web AND at least one demo token is available.
  // On native or in production-without-tokens, this short-circuits to null.
  const available = useMemo(() => SLOTS.filter((s) => !!s.token), []);
  const { data: user } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (Platform.OS !== 'web') return null;
  if (available.length === 0) return null;
  // Hide while signed-out — the /login page already has its own quick buttons.
  if (!user) return null;

  const currentRole = (user as { role?: string }).role;

  const switchTo = (slot: Slot) => {
    if (slot.role === currentRole) return;
    setStoredToken(slot.token!);
    // Full reload is intentional: it drops in-flight tRPC queries that were
    // bound to the old role's tier, avoiding flicker as React Query
    // background-revalidates and procs the role-guard redirect twice.
    if (typeof window !== 'undefined') {
      window.location.href = slot.landing;
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 9999,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 6,
          paddingVertical: 6,
          borderRadius: 24,
          backgroundColor: 'rgba(20,20,20,0.92)',
          borderWidth: 1,
          borderColor: '#C9A96E40',
        }}
      >
        <Text style={{ color: '#888', fontSize: 10, paddingHorizontal: 6, fontWeight: '600' }}>
          DEMO
        </Text>
        {available.map((slot) => {
          const active = slot.role === currentRole;
          return (
            <Pressable
              key={slot.role}
              onPress={() => switchTo(slot)}
              disabled={active}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: active ? '#C9A96E' : pressed ? '#444' : 'transparent',
              })}
              accessibilityLabel={`Switch to ${slot.label}`}
            >
              <Text
                style={{
                  color: active ? '#1a1a1a' : '#fff',
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {slot.short}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
