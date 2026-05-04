import React, { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { Tabs, usePathname, useRouter, useRootNavigationState } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { AppProvider, useApp } from "@/lib/app-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

// Create query client.
// Retry policy: never retry on 4xx (auth/permission/validation errors won't
// fix themselves); allow one retry on 5xx or network errors. This stops the
// console from being flooded by repeated 403 retries when a procedure rejects
// the current role (e.g. admin token hitting a residentProcedure during the
// brief layout mount before role-based redirect kicks in).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error: unknown) => {
        const e = error as { data?: { httpStatus?: number }; status?: number } | null;
        const status = e?.data?.httpStatus ?? e?.status ?? 0;
        if (status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    },
  },
});

// Create tRPC client
const trpcClient = createTRPCClient();

function Root() {
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const router = useRouter();
  const pathname = usePathname();
  const navState = useRootNavigationState();

  // Note: URL→localStorage token bootstrap happens synchronously in lib/trpc.ts
  // at module import (before any useQuery), so by the time this component
  // mounts, the Authorization header on tRPC calls is already correct. No
  // separate bootstrap useEffect needed here.

  // Routing decisions — gated on navState.key so we never call router.replace
  // before the navigation tree has mounted (avoids the "navigate before mount"
  // crash that happens when Expo Router's root Slot isn't ready yet).
  useEffect(() => {
    if (!navState?.key) return;
    if (isLoading) return;

    const expectedForRole = (role: string | undefined) =>
      role === 'admin' ? '/admin-dashboard' :
      role === 'logistics' ? '/logistics-dashboard' :
      '/';

    const onLogin = pathname === '/login';
    if (!user) {
      if (!onLogin) router.replace('/login');
      return;
    }
    // Logged in: bounce away from /login + non-resident roles to their landing
    if (onLogin) {
      router.replace(expectedForRole(user.role) as any);
      return;
    }
    if (user.role === 'admin' && pathname !== '/admin-dashboard' && !pathname.startsWith('/admin')) {
      router.replace('/admin-dashboard');
      return;
    }
    if (user.role === 'logistics' && pathname !== '/logistics-dashboard' && !pathname.startsWith('/logistics')) {
      router.replace('/logistics-dashboard');
      return;
    }
  }, [navState?.key, user, isLoading, pathname, router]);

  // Loading screen ONLY while auth.me is in flight. We DON'T gate on
  // navState.key because useRootNavigationState() only becomes truthy AFTER
  // a navigator is rendered — gating render on it would create a deadlock
  // (Loading shows → no navigator → navState never ready → Loading forever).
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#C9A96E" />
        <Text style={{ color: '#999', marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  // Always return the navigator so navState becomes ready, then the useEffect
  // above redirects admin/logistics to their proper landing within one frame.
  return <ResidentLayout />;
}

function ResidentLayout() {
  const colors = useColors();
  const { t } = useApp();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.brain"),
          tabBarIcon: ({ color, size }) => <IconSymbol name="brain" size={size + 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: t("tabs.concierge"),
          tabBarIcon: ({ color, size }) => <IconSymbol name="star.fill" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: t("tabs.timeline"),
          tabBarIcon: ({ color, size }) => <IconSymbol name="list.bullet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.system"),
          tabBarIcon: ({ color, size }) => <IconSymbol name="gear" size={size} color={color} />,
        }}
      />
      {/* Hide dashboards and login from resident tabs */}
      <Tabs.Screen name="admin-dashboard" options={{ href: null }} />
      <Tabs.Screen name="logistics-dashboard" options={{ href: null }} />
      <Tabs.Screen name="login" options={{ href: null }} />
      <Tabs.Screen name="amenities/[id]" options={{ href: null }} />
      <Tabs.Screen name="my-bookings" options={{ href: null }} />
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <Root />
          </AppProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </SafeAreaProvider>
  );
}

