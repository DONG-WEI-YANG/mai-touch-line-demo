import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AdminHeader } from "@/components/admin/admin-ui";
import { SystemStatusCard } from "@/components/admin/system-status-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { getSystemStatusPresentation } from "@/lib/system-status";

const CHECK_LABELS: Record<string, string> = {
  connectivity: "資料庫連線",
  quickCheck: "SQLite 頁面完整性",
  foreignKeys: "外鍵一致性",
  requiredTables: "必要資料表",
};

function checkDetails(checks: Record<string, string>, issues: Array<{ message: string; details?: string[] }>): string[] {
  const results = Object.entries(checks).map(([key, value]) => (
    `${CHECK_LABELS[key] ?? key}：${value === "passed" ? "通過" : value === "not_applicable" ? "不適用" : value === "not_run" ? "未執行" : "失敗"}`
  ));
  const issueDetails = issues.flatMap((issue) => issue.details?.length
    ? [`${issue.message}：${issue.details.join("、")}`]
    : [issue.message]);
  return [...results, ...issueDetails];
}

export default function SystemIntegrityScreen() {
  const colors = useColors();
  const diagnostics = trpc.system.diagnostics.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const report = diagnostics.data;
  const overall = getSystemStatusPresentation(report?.overall ?? "unknown", "zh");
  const overallColor = overall.tone === "success"
    ? colors.success
    : overall.tone === "warning"
      ? colors.warning
      : overall.tone === "error"
        ? colors.error
        : colors.muted;

  const refreshButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="重新執行系統完整性檢查"
      disabled={diagnostics.isFetching}
      onPress={() => diagnostics.refetch()}
      style={({ pressed }) => [styles.refreshButton, {
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: pressed || diagnostics.isFetching ? 0.6 : 1,
      }]}
    >
      {diagnostics.isFetching
        ? <ActivityIndicator size="small" color={colors.primary} />
        : <IconSymbol name="arrow.clockwise" size={17} color={colors.primary} />}
      <Text style={[styles.refreshText, { color: colors.foreground }]}>重新檢查</Text>
    </Pressable>
  );

  return (
    <ScreenContainer edges={["top"]}>
      <AdminHeader
        title="系統完整性"
        subtitle="資料、AI 與語言服務的即時檢查結果"
        rightElement={refreshButton}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={diagnostics.isFetching} onRefresh={() => diagnostics.refetch()} tintColor={colors.primary} />}
      >
        {diagnostics.isLoading && (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.centerTitle, { color: colors.foreground }]}>正在逐層檢查</Text>
            <Text style={[styles.centerCopy, { color: colors.muted }]}>資料庫、OpenAI 與 NLP 會分別回報，不以設定值代替檢查。</Text>
          </View>
        )}

        {diagnostics.isError && (
          <View style={[styles.errorState, { borderColor: colors.error, backgroundColor: `${colors.error}12` }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={22} color={colors.error} />
            <View style={styles.errorCopy}>
              <Text style={[styles.centerTitle, { color: colors.foreground }]}>無法取得診斷資料</Text>
              <Text style={[styles.centerCopy, { color: colors.muted }]}>確認管理員登入與 API 連線後，再執行一次檢查。</Text>
            </View>
          </View>
        )}

        {report && (
          <>
            <View style={[styles.certificate, { borderColor: overallColor, backgroundColor: colors.surface }]}>
              <View style={styles.certificateMain}>
                <Text style={[styles.certificateLabel, { color: colors.muted }]}>本次檢查</Text>
                <Text style={[styles.certificateStatus, { color: overallColor }]}>{overall.label}</Text>
                <Text style={[styles.certificateTime, { color: colors.muted }]}>
                  {new Date(report.checkedAt).toLocaleString("zh-TW")}
                </Text>
              </View>
              <View style={[styles.runtime, { borderLeftColor: colors.border }]}>
                <Text style={[styles.runtimeValue, { color: colors.foreground }]}>{report.runtime.nodeVersion}</Text>
                <Text style={[styles.runtimeLabel, { color: colors.muted }]}>Node · {report.runtime.environment}</Text>
                <Text style={[styles.runtimeLabel, { color: colors.muted }]}>App {report.runtime.appVersion}</Text>
              </View>
            </View>

            <View style={styles.systemSpine}>
              <SystemStatusCard
                title={`Database · ${report.services.database.dialect}`}
                status={report.services.database.status}
                summary={`完整檢查耗時 ${report.services.database.durationMs} ms`}
                details={checkDetails(report.services.database.checks, report.services.database.issues)}
                icon="Database"
              />
              <SystemStatusCard
                title="OpenAI"
                status={report.services.ai.status}
                summary={report.services.ai.configured
                  ? `認證 metadata probe · ${report.services.ai.latencyMs} ms`
                  : "尚未設定 provider 憑證"}
                details={[
                  `連線：${report.services.ai.reachable ? "已驗證" : "未驗證"}`,
                  ...(report.services.ai.code ? [`狀態代碼：${report.services.ai.code}`] : []),
                ]}
                icon="BrainCircuit"
              />
              <SystemStatusCard
                title="NLP 語言服務"
                status={report.services.nlp.status}
                summary={report.services.nlp.configured
                  ? `健康檢查 · ${report.services.nlp.latencyMs} ms`
                  : "服務未啟用"}
                details={[
                  `連線：${report.services.nlp.reachable ? "已驗證" : "未驗證"}`,
                  ...(report.services.nlp.code ? [`服務回報：${report.services.nlp.code}`] : []),
                ]}
                icon="Network"
                isLast
              />
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 48, width: "100%", maxWidth: 880, alignSelf: "center" },
  refreshButton: { minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 },
  refreshText: { fontSize: 12, fontWeight: "800" },
  centerState: { minHeight: 320, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  centerTitle: { fontSize: 16, fontWeight: "800", marginTop: 12 },
  centerCopy: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 5, maxWidth: 420 },
  errorState: { borderWidth: 1, borderRadius: 12, padding: 18, flexDirection: "row", gap: 14, alignItems: "flex-start" },
  errorCopy: { flex: 1 },
  certificate: { borderWidth: 1.5, borderRadius: 14, padding: 18, flexDirection: "row", alignItems: "stretch", marginBottom: 18 },
  certificateMain: { flex: 1 },
  certificateLabel: { fontSize: 12, fontWeight: "700" },
  certificateStatus: { fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.6, marginTop: 2 },
  certificateTime: { fontSize: 11, marginTop: 7, fontVariant: ["tabular-nums"] },
  runtime: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 18, marginLeft: 18, justifyContent: "center", minWidth: 130 },
  runtimeValue: { fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  runtimeLabel: { fontSize: 10, lineHeight: 15, marginTop: 2 },
  systemSpine: { paddingRight: 4 },
});
