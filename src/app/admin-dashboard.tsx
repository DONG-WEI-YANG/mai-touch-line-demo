import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";

export default function AdminDashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  // 30s instead of 5s — at 5s, 3 polled queries on this screen + 2 on
  // amenity-iot were hitting Render's rate limiter (429) within ~1 minute,
  // freezing the dashboard mid-demo. 30s is plenty for IoT health/dispatch
  // updates and stays well under any free-tier limit.
  const HARDWARE_POLLING_MS = 30000;
  const FALLBACK_SPIKE_WINDOW = 8;
  const FALLBACK_SPIKE_MIN_COUNT = 3;
  const FALLBACK_SPIKE_MIN_RATE = 0.5;
  const ALERT_SNOOZE_MS = 10 * 60 * 1000;
  const ALERT_STATE_KEY = "admin.hardware.alertState.dashboard";
  type StatCardIconName = React.ComponentProps<typeof IconSymbol>["name"];
  
  // Queries
  const { data: stats, refetch: refetchStats } = trpc.admin.stats.useQuery();
  const { data: nlpHealth, refetch: refetchHealth } = trpc.admin.nlpHealth.useQuery();
  const { data: modelStats, refetch: refetchModels } = trpc.admin.modelDownloads.useQuery();
  const { data: diag, refetch: refetchDiag, isError: diagnosticsFailed } = trpc.system.diagnostics.useQuery();
  const {data: notificationQueue, refetch: refetchNotifications, isError: notificationsFailed} = trpc.system.notificationQueue.useQuery();
  // refetchInterval returns false when the last fetch errored — stops tight 403
  // loops if backend rejects the procedure (e.g. demo synthetic user missing
  // some permission).
  function stopOnError<T>(fallback: number): (data: T | undefined, query: { state: { error: unknown } }) => number | false {
    return (_data, query) => query.state.error ? false : fallback;
  }
  const { data: logs, refetch: refetchLogs } = trpc.access.liveFeed.useQuery(undefined, { refetchInterval: stopOnError<typeof logs>(HARDWARE_POLLING_MS) });
  const { data: gatewayHealth, refetch: refetchGatewayHealth } = trpc.admin.hardwareGatewayHealth.useQuery(undefined, { refetchInterval: stopOnError<typeof gatewayHealth>(HARDWARE_POLLING_MS) });
  const { data: dispatchHistory, refetch: refetchDispatchHistory } = trpc.admin.hardwareDispatchHistory.useQuery({ limit: FALLBACK_SPIKE_WINDOW }, { refetchInterval: stopOnError<typeof dispatchHistory>(HARDWARE_POLLING_MS) });

  const [refreshing, setRefreshing] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<number>(0);
  const [acknowledgedSignature, setAcknowledgedSignature] = useState<string>("");
  const recentHardwareHistory = useMemo(() => dispatchHistory ?? [], [dispatchHistory]);
  const recentFallbackCount = recentHardwareHistory.filter((entry) => entry.result.fallbackUsed).length;
  const recentFallbackRate = recentHardwareHistory.length > 0 ? recentFallbackCount / recentHardwareHistory.length : 0;
  const isFallbackSpike = recentFallbackCount >= FALLBACK_SPIKE_MIN_COUNT && recentFallbackRate >= FALLBACK_SPIKE_MIN_RATE;
  const spikeSignature = useMemo(
    () =>
      recentHardwareHistory
        .slice(0, FALLBACK_SPIKE_WINDOW)
        .map((entry) => `${entry.id}:${entry.result.fallbackUsed ? 1 : 0}`)
        .join("|"),
    [recentHardwareHistory, FALLBACK_SPIKE_WINDOW],
  );
  const isSnoozed = snoozedUntil > Date.now();
  const isAcknowledged = acknowledgedSignature !== "" && acknowledgedSignature === spikeSignature;
  const showFallbackAlert = isFallbackSpike && !isSnoozed && !isAcknowledged;
  const alertStatusLabel = diagnosticsFailed ? '讀取失敗' : !diag ? '檢查中' : diag.overall === 'healthy' ? '正常' : diag.overall === 'unavailable' ? '服務異常' : '部分服務未就緒';
  const alertStatusColor = diagnosticsFailed || diag?.overall === 'unavailable' ? colors.error : diag?.overall === 'healthy' ? colors.success : colors.warning;
  const lastAlertUpdateText = diag?.checkedAt
    ? `檢查時間 ${new Date(diag.checkedAt).toLocaleTimeString()}`
    : '尚無檢查結果';

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchStats(),
      refetchHealth(),
      refetchModels(),
      refetchDiag(),
      refetchNotifications(),
      refetchLogs(),
      refetchGatewayHealth(),
      refetchDispatchHistory(),
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ALERT_STATE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { snoozedUntil?: number; acknowledgedSignature?: string };
        setSnoozedUntil(parsed.snoozedUntil || 0);
        setAcknowledgedSignature(parsed.acknowledgedSignature || "");
      } catch {
        setSnoozedUntil(0);
        setAcknowledgedSignature("");
      }
    })();
  }, [ALERT_STATE_KEY]);

  const persistAlertState = async (nextSnoozedUntil: number, nextAcknowledgedSignature: string) => {
    setSnoozedUntil(nextSnoozedUntil);
    setAcknowledgedSignature(nextAcknowledgedSignature);
    try {
      await AsyncStorage.setItem(
        ALERT_STATE_KEY,
        JSON.stringify({
          snoozedUntil: nextSnoozedUntil,
          acknowledgedSignature: nextAcknowledgedSignature,
        }),
      );
    } catch {
      return;
    }
  };

  const handleSnooze = async () => {
    await persistAlertState(Date.now() + ALERT_SNOOZE_MS, acknowledgedSignature);
  };

  const handleAcknowledge = async () => {
    await persistAlertState(snoozedUntil, spikeSignature);
  };

  const StatCard = ({ title, value, icon, color }: { title: string; value: number | string; icon: StatCardIconName; color?: string }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: (color || colors.primary) + "20" }]}>
        <IconSymbol name={icon} size={20} color={color || colors.primary} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statTitle, { color: colors.muted }]}>{title}</Text>
    </View>
  );

  const StatusRow = ({ label, status, isConfigured = true }: { label: string; status: string; isConfigured?: boolean }) => (
    <View style={styles.diagRow}>
      <Text style={[styles.diagLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.diagRight}>
        <View style={[styles.statusBadgeSmall, { backgroundColor: (status === 'healthy' ? colors.success : status === 'unavailable' || status === '讀取失敗' ? colors.error : colors.warning) + '20' }]}>
          <Text style={[styles.statusTextSmall, { color: status === 'healthy' ? colors.success : status === 'unavailable' || status === '讀取失敗' ? colors.error : colors.warning }]}>
            {!isConfigured || status === 'unconfigured' ? '未啟用' : status.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>System Management</Text>
        <View style={styles.headerStatusWrap}>
          <View style={[styles.headerStatusBadge, { backgroundColor: alertStatusColor + "20" }]}>
            <Text style={[styles.headerStatusText, { color: alertStatusColor }]}>{alertStatusLabel}</Text>
          </View>
          <Text style={[styles.headerStatusMeta, { color: colors.muted }]}>{lastAlertUpdateText}</Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
          {refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : <IconSymbol name="arrow.clockwise" size={20} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Operations Overview */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>OPERATIONS</Text>
        <View style={styles.grid}>
          <StatCard title="Total Users" value={stats?.totalUsers || 0} icon="person.3.fill" />
          <StatCard title="Active Bookings" value={stats?.activeBookings || 0} icon="calendar" />
        </View>

        {/* API Diagnostics */}
        <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 32 }]}>API & CONNECTIVITY</Text>
        <View style={[styles.monitorBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <StatusRow label={`Database (${diag?.services.database.dialect || "checking"})`} status={diag?.services.database.status || "checking"} />
          <StatusRow label="獨立 NLP 服務" status={diagnosticsFailed ? '讀取失敗' : diag?.services.nlp.status || "checking"} isConfigured={diag?.services.nlp.configured} />
          <StatusRow label="AI 供應商連線" status={diagnosticsFailed ? '讀取失敗' : diag?.services.ai.status || "checking"} isConfigured={diag?.services.ai.configured} />
          <Text style={{ color: colors.muted, marginTop: 8 }}>AI 檢查為模型清單連線測試，不代表實際推論驗收。獨立 NLP 未啟用不代表 LINE AI 無法使用。</Text>
          {diag?.services.ai.fallbackUsed && <Text style={{ color: colors.warning }}>主用憑證檢查失敗，目前備援連線正常。</Text>}
          {diag?.services.ai.code && <Text style={{ color: colors.warning }}>AI 檢查結果：{diag.services.ai.code}</Text>}
        </View>

        {/* AI & NLP Health */}
        <Text style={{color: notificationsFailed || notificationQueue?.failed ? colors.warning : colors.muted, marginTop:12}}>
          {notificationsFailed ? '通知佇列讀取失敗' : !notificationQueue ? '通知佇列檢查中' : !notificationQueue.configured ? '持久通知佇列未配置' : `通知待送 ${notificationQueue.pending} 筆，其中 ${notificationQueue.failed} 筆失敗待重試`}
        </Text>
        <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 32 }]}>AI INFRASTRUCTURE</Text>
        <View style={[styles.monitorBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.progressContainer}>
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, { color: colors.muted }]}>Models Loaded</Text>
              <Text style={[styles.progressValue, { color: colors.primary }]}>{modelStats?.downloaded_models || 0} / 120</Text>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${((modelStats?.downloaded_models || 0) / 120) * 100}%` }]} />
            </View>
          </View>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.foreground }]}>{nlpHealth?.pool_stats?.avg_latency_ms?.toFixed(1) || 0} ms</Text>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Latency</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.foreground }]}>{nlpHealth?.mode === 'full' ? 'Neural' : 'Fallback'}</Text>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Active Mode</Text>
            </View>
          </View>
        </View>

        {/* Hardware Gateway Health */}
        <View style={[styles.sectionTitleRow, { marginTop: 32 }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted, marginBottom: 0 }]}>HARDWARE GATEWAY</Text>
          {showFallbackAlert && (
            <View style={styles.warningTag}>
              <Text style={styles.warningTagText}>FALLBACK SPIKE</Text>
            </View>
          )}
        </View>
        <View style={[styles.monitorBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <StatusRow label="Gateway Status" status={gatewayHealth?.status || "Check..."} />
          <StatusRow label="Adapter" status={gatewayHealth?.config?.adapterResolved || "unavailable"} />
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.foreground }]}>{gatewayHealth?.counters?.totalDispatches || 0}</Text>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Total Dispatches</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.foreground }]}>{gatewayHealth?.counters?.dispatchedCommands || 0}</Text>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Commands Sent</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.foreground }]}>{gatewayHealth?.counters?.fallbackDispatches || 0}</Text>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Fallbacks</Text>
            </View>
          </View>
          {!!gatewayHealth?.lastFailureReason && (
            <Text style={[styles.failureText, { color: colors.error }]} numberOfLines={2}>
              Last failure: {gatewayHealth.lastFailureReason}
            </Text>
          )}
          {showFallbackAlert && (
            <View style={styles.alertControls}>
              <TouchableOpacity style={[styles.alertButton, { borderColor: colors.border }]} onPress={handleAcknowledge}>
                <Text style={[styles.alertButtonText, { color: colors.foreground }]}>Acknowledge</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.alertButton, { borderColor: colors.border }]} onPress={handleSnooze}>
                <Text style={[styles.alertButtonText, { color: colors.foreground }]}>Snooze 10m</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Recent Hardware Dispatch */}
        <View style={[styles.sectionTitleRow, { marginTop: 32 }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted, marginBottom: 0 }]}>RECENT HARDWARE DISPATCH</Text>
          {showFallbackAlert && (
            <View style={styles.warningTag}>
              <Text style={styles.warningTagText}>FALLBACK SPIKE</Text>
            </View>
          )}
        </View>
        <View style={[styles.monitorBox, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0 }]}>
          {!dispatchHistory || dispatchHistory.length === 0 ? (
            <Text style={{ color: colors.muted, padding: 20, textAlign: "center" }}>No recent hardware commands</Text>
          ) : (
            dispatchHistory.map((entry) => (
              <View key={entry.id} style={[styles.logItem, { borderBottomColor: colors.border }]}>
                <View style={[styles.logIcon, { backgroundColor: entry.result.success ? colors.success + "20" : colors.error + "20" }]}>
                  <IconSymbol
                    name={entry.result.success ? "checkmark.circle.fill" : "xmark.circle.fill"}
                    size={14}
                    color={entry.result.success ? colors.success : colors.error}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logText, { color: colors.foreground }]}>
                    {entry.input.deviceName || `Device #${entry.input.deviceId}`} → {entry.input.status}
                  </Text>
                  <Text style={[styles.logTime, { color: colors.muted }]}>
                    {new Date(entry.timestamp).toLocaleTimeString()} • {entry.adapterResolved || "none"} • {entry.durationMs}ms
                  </Text>
                </View>
                <Text style={[styles.logResult, { color: entry.result.commandDispatched ? colors.success : colors.warning || colors.primary }]}>
                  {entry.result.commandDispatched ? "SENT" : "FALLBACK"}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Security Tracking Feed */}
        <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 32 }]}>門禁回報（未驗證設備）</Text>
        <View style={[styles.monitorBox, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0 }]}>
          {!logs || logs.length === 0 ? (
            <Text style={{ color: colors.muted, padding: 20, textAlign: 'center' }}>No recent entry logs</Text>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={[styles.logItem, { borderBottomColor: colors.border }]}>
                <View style={[styles.logIcon, { backgroundColor: colors.muted + '20' }]}>
                  <IconSymbol name="info.circle.fill" size={14} color={colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logText, { color: colors.foreground }]}>{log.entryPoint}</Text>
                  <Text style={[styles.logTime, { color: colors.muted }]}>{log.source === 'demo' ? '示範紀錄' : '來源未驗證'} · {new Date(log.createdAt).toLocaleTimeString()}</Text>
                </View>
                <Text style={[styles.logResult, { color: colors.muted }]}>
                  自述 {log.result.toUpperCase()}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Maintenance Actions */}
        <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 32 }]}>SYSTEM ACTIONS</Text>
        <TouchableOpacity 
          style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push("/admin/amenity-iot")}
        >
          <IconSymbol name="bolt.fill" size={20} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>Amenity IoT Control</Text>
          <IconSymbol name="chevron.right" size={20} color={colors.muted} />
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "800" },
  headerStatusWrap: { alignItems: "flex-end", gap: 2 },
  headerStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  headerStatusText: { fontSize: 10, fontWeight: "800" },
  headerStatusMeta: { fontSize: 9, fontWeight: "600" },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 16 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "48%", padding: 16, borderRadius: 20, borderWidth: 1.5, gap: 6 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statTitle: { fontSize: 12, fontWeight: "600" },
  monitorBox: { padding: 20, borderRadius: 24, borderWidth: 1.5, gap: 16 },
  diagRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  diagLabel: { fontSize: 15, fontWeight: "600" },
  diagRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusBadgeSmall: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTextSmall: { fontSize: 10, fontWeight: "800" },
  warningTag: { backgroundColor: "#ED6C02", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  warningTagText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  progressContainer: { gap: 10 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 13, fontWeight: "600" },
  progressValue: { fontSize: 13, fontWeight: "700" },
  progressBarBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 3 },
  metricsRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10 },
  metricItem: { alignItems: "center", gap: 4 },
  metricValue: { fontSize: 15, fontWeight: "700" },
  metricLabel: { fontSize: 11, fontWeight: "600" },
  failureText: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  actionRow: { flexDirection: "row", alignItems: "center", padding: 18, borderRadius: 20, borderWidth: 1.5, marginBottom: 12, gap: 14 },
  actionText: { flex: 1, fontSize: 15, fontWeight: "700" },
  logItem: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 0.5, gap: 12 },
  logIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  logText: { fontSize: 14, fontWeight: "600" },
  logTime: { fontSize: 11, marginTop: 2 },
  logResult: { fontSize: 10, fontWeight: "800" },
  alertControls: { flexDirection: "row", gap: 8, marginTop: 6 },
  alertButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  alertButtonText: { fontSize: 11, fontWeight: "700" },
});
