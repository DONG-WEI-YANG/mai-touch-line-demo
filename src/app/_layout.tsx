import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "@/lib/trpc";
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
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  if (isLoading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>;
  }

  if (!user) {
    // For this example, we assume if there's no user, they should be in the main app flow
    // A real app might redirect to a login screen: return <Redirect href="/login" />;
    return <ResidentLayout />;
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
      {/* Hide dashboards from resident tabs */}
      <Tabs.Screen name="admin-dashboard" options={{ href: null }} />
      <Tabs.Screen name="logistics-dashboard" options={{ href: null }} />
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

