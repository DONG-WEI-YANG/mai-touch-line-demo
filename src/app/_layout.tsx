import React, { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { Tabs, usePathname, useRouter, useRootNavigationState } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient, trpcProxy, hasStoredToken } from "@/lib/trpc";
import { AppProvider, useApp } from "@/lib/app-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { offlineService, type OfflineOperation } from "@/lib/offline";
import { DemoRoleSwitcher } from "@/components/demo-role-switcher";
import { authGate, shouldBlockOnAuthLoading, shouldRetryAuth } from "@/lib/auth-gate";
import { shouldRetryQuery } from "@/lib/query-retry";
import { recoveryRefetchInterval } from "@/lib/recovery-interval";

// Create query client.
// 重試政策住在 src/lib/query-retry.ts(純函式,有測試):403/401/400 這類不重試
// (權限與驗證錯誤不會自己好),429 會退避重試(限流是暫時的),5xx 與網路錯誤
// 給一次機會。
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: shouldRetryQuery,
      // Window focus shouldn't refire failed-permission queries — that produced
      // a continuous 403 loop in the console when the admin landed on resident-
      // only pages briefly during role-based redirect.
      refetchOnWindowFocus: false,
    },
  },
});

// Create tRPC client
const trpcClient = createTRPCClient();

// Queue operations run outside React hooks. Once the server confirms one,
// invalidate active queries so every mounted list reconciles to server truth.
offlineService.on('operation:completed', () => {
  void queryClient.invalidateQueries();
});

// ── Offline operation handler ────────────────────────────────────────────────
// Register once at module load so any queued operations from a previous session
// can drain on next online tick. The handler dispatches by op.type to the
// matching tRPC mutation. Throw to trigger retry; resolve to mark complete.
offlineService.setOperationHandler(async (op: OfflineOperation) => {
  switch (op.type) {
    // Resident-side operations
    case 'cancel_booking':
      await trpcProxy.bookings.cancel.mutate({ id: op.data.id });
      return;
    case 'create_booking':
      await trpcProxy.bookings.create.mutate(op.data);
      return;
    case 'create_work_order':
      await trpcProxy.workOrders.create.mutate(op.data);
      return;
    case 'send_message':
      await trpcProxy.chat.send.mutate(op.data);
      return;
    // Staff-side operations (logistics tablet, admin dashboard)
    case 'update_booking':
      await trpcProxy.bookings.updateStatus.mutate(op.data);
      return;
    case 'update_work_order':
      await trpcProxy.workOrders.update.mutate(op.data);
      return;
    // Exhaustiveness guard — TypeScript will catch any new OfflineOperationType
    // that's added without a case here. The unreachable cast lets the runtime
    // surface the bad type clearly if op.type ever escapes the union.
    default: {
      const _exhaustive: never = op.type;
      throw new Error(`offline: unhandled op.type=${String(_exhaustive)}`);
    }
  }
});
offlineService.startAutoSync(30_000);

function Root() {
  // retry 不是 false:429 / 5xx / 網路抖動只代表「暫時查不出你是誰」,
  // 直接放棄會讓 user 變成 null,守衛就把人踢回登入頁。見 src/lib/auth-gate.ts。
  const { data: user, isLoading, error: authError } = trpc.auth.me.useQuery(undefined, {
    retry: shouldRetryAuth,
    refetchOnWindowFocus: false,
    // 重試用完後停在 error 就再也不會自己好。開慢速輪詢,伺服器恢復時畫面
    // 自己接回來,不必當著客戶的面重新整理。
    refetchInterval: (_data, query) => recoveryRefetchInterval(query.state.status),
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

    // 決策住在 src/lib/auth-gate.ts(純函式,被單測窮舉過);這裡只套用結論。
    // "stay" 代表暫時查不出身分 —— 什麼都不做,留在原畫面等重試。
    const decision = authGate({
      isLoading,
      user,
      error: authError,
      hasToken: hasStoredToken(),
      pathname,
    });
    if (decision.action === "redirect") {
      router.replace(decision.target as any);
    }
  }, [navState?.key, user, isLoading, authError, pathname, router]);

  // 整頁載入畫面只留給「完全沒有 token 的冷啟動」。
  //
  // 有 token 時一律直接渲染 navigator:auth.me 會對 429/5xx 退避重試,isLoading
  // 可能持續十幾秒,擋在這裡等同讓使用者盯著一片灰色 —— 而且 navigator 沒掛載
  // 期間深連結會遺失,直接開 /showcase 會掉回首頁。判斷見 src/lib/auth-gate.ts。
  //
  // (不 gate 在 navState.key 上的原因不變:那會造成死結 —— 顯示 Loading → 沒有
  // navigator → navState 永遠不 ready → Loading 永遠不消失。)
  if (shouldBlockOnAuthLoading({ isLoading, hasToken: hasStoredToken() })) {
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
  // Hide the bottom tab bar for non-resident roles. The Tabs container still
  // mounts (so admin/logistics screens render inside the same shell), but the
  // 4-tab bar would just be dead buttons for them — Concierge/Timeline/etc.
  // bounce back to their dashboard via the role guard in Root().
  // 與 Root() 同一個 query key,重試政策也要一致 —— 否則哪一邊先掛載就用哪邊的
  // 設定,行為會隨渲染順序飄移。
  const { data: user } = trpc.auth.me.useQuery(undefined, {
    retry: shouldRetryAuth,
    refetchOnWindowFocus: false,
  });
  const isResident = (user as { role?: string } | undefined)?.role === 'resident';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: !isResident ? { display: 'none' } : {
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
      {/* Hide dashboards, login, and feature pages that aren't part of the
          4-tab resident bottom nav. Without href:null, Expo Router auto-mounts
          every file in app/ as a tab — those leak into the bar with broken
          ⏷ ⏷ icons (no tabBarIcon configured). */}
      <Tabs.Screen name="admin-dashboard" options={{ href: null }} />
      <Tabs.Screen name="logistics-dashboard" options={{ href: null }} />
      <Tabs.Screen name="login" options={{ href: null }} />
      <Tabs.Screen name="amenities/[id]" options={{ href: null }} />
      <Tabs.Screen name="my-bookings" options={{ href: null }} />
      <Tabs.Screen name="wallet" options={{ href: null }} />
      <Tabs.Screen name="guest-pass" options={{ href: null }} />
      <Tabs.Screen name="smart-home" options={{ href: null }} />
      <Tabs.Screen name="profile-edit" options={{ href: null }} />
      <Tabs.Screen name="admin/index" options={{ href: null }} />
      <Tabs.Screen name="admin/line" options={{ href: null }} />
      <Tabs.Screen name="admin/amenity-iot" options={{ href: null }} />
      <Tabs.Screen name="admin/system-integrity" options={{ href: null }} />
      <Tabs.Screen name="showcase" options={{ href: null }} />
      <Tabs.Screen name="admin/bookings" options={{ href: null }} />
      <Tabs.Screen name="admin/work-orders" options={{ href: null }} />
      <Tabs.Screen name="admin/amenities" options={{ href: null }} />
      <Tabs.Screen name="admin/residents" options={{ href: null }} />
      <Tabs.Screen name="admin/announcements" options={{ href: null }} />
      <Tabs.Screen name="announcements" options={{ href: null }} />
      <Tabs.Screen name="admin/packages" options={{ href: null }} />
      <Tabs.Screen name="packages" options={{ href: null }} />
      <Tabs.Screen name="admin/parking" options={{ href: null }} />
      <Tabs.Screen name="parking" options={{ href: null }} />
      <Tabs.Screen name="admin/billing" options={{ href: null }} />
      <Tabs.Screen name="bills" options={{ href: null }} />
      <Tabs.Screen name="social-mediation" options={{ href: null }} />
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
            <DemoRoleSwitcher />
          </AppProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </SafeAreaProvider>
  );
}

