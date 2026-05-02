import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { Tabs, Redirect, usePathname, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient, setStoredToken } from "@/lib/trpc";
import { AppProvider, useApp } from "@/lib/app-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Create tRPC client
const trpcClient = createTRPCClient();

function Root() {
  const { data: user, isLoading, refetch } = trpc.auth.me.useQuery();
  const router = useRouter();
  const pathname = usePathname();

  const [bootstrapping, setBootstrapping] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return new URL(window.location.href).searchParams.has('token'); }
    catch { return false; }
  });

  // Bootstrap: extract ?token from URL into localStorage on first paint
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const t = url.searchParams.get('token');
    if (t) {
      setStoredToken(t);
      url.searchParams.delete('token');
      window.history.replaceState(
        {},
        '',
        url.pathname +
          (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') +
          url.hash
      );
      void refetch().finally(() => setBootstrapping(false));
    } else {
      setBootstrapping(false);
    }
  }, [refetch]);

  // Routing decisions
  useEffect(() => {
    if (isLoading || bootstrapping) return;
    const onLogin = pathname === '/login';
    if (!user && !onLogin) {
      router.replace('/login');
      return;
    }
    if (user && onLogin) {
      const landing =
        user.role === 'admin' ? '/admin-dashboard' :
        user.role === 'logistics' ? '/logistics-dashboard' :
        '/';
      router.replace(landing as any);
      return;
    }
  }, [user, isLoading, bootstrapping, pathname, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#C9A96E" />
        <Text style={{ color: '#999', marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Role-based routing
  if (user.role === 'admin') {
    return <Redirect href="/admin-dashboard" />;
  }

  if (user.role === 'logistics') {
    return <Redirect href="/logistics-dashboard" />;
  }

  // Default to resident view
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

