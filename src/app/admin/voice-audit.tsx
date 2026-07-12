/**
 * 語音稽核軌跡 — 檢視誰、何時、下了什麼語音指令(提案/落地/駁回)。
 * 資料來自 voice.auditLogs(staffProcedure,記憶體 ring buffer)。
 */
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin/admin-ui";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const OUTCOME_LABEL: Record<string, string> = {
  proposed: "提案", committed: "已送出", rejected: "駁回", unclear: "未辨識",
};

export default function VoiceAuditScreen() {
  const colors = useColors();
  const { data, isLoading } = trpc.voice.auditLogs.useQuery({ limit: 100 }, { refetchInterval: 15000 });
  const items = data?.items ?? [];
  const stats = data?.stats;

  const outcomeColor = (o: string) =>
    o === "committed" ? colors.success : o === "rejected" ? colors.error : o === "unclear" ? colors.warning : colors.muted;

  return (
    <ScreenContainer edges={["top"]}>
      <AdminHeader
        title="語音稽核軌跡"
        subtitle={stats ? `共 ${stats.total} 筆 · 送出 ${stats.committed} · 駁回 ${stats.rejected}` : "載入中…"}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && <Text style={{ color: colors.muted }}>載入中…</Text>}
        {!isLoading && items.length === 0 && (
          <Text style={{ color: colors.muted }}>目前沒有語音指令紀錄(伺服器重啟後會清空)。</Text>
        )}
        {items.map((e: any) => (
          <View key={e.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.rowTop}>
              <Text style={[styles.intent, { color: colors.foreground }]}>{e.intent}</Text>
              <View style={[styles.badge, { backgroundColor: outcomeColor(e.outcome) + "22" }]}>
                <Text style={[styles.badgeText, { color: outcomeColor(e.outcome) }]}>{OUTCOME_LABEL[e.outcome] ?? e.outcome}</Text>
              </View>
            </View>
            {e.transcript ? <Text style={[styles.transcript, { color: colors.muted }]}>「{e.transcript}」</Text> : null}
            <Text style={[styles.meta, { color: colors.muted }]}>
              {new Date(e.timestamp).toLocaleString()} · {e.source === "staff" ? `物業代 #${e.targetUserId}` : `住戶 #${e.actorUserId}`} · {e.phase}
              {e.ref ? ` · ${e.ref}` : ""}{e.error ? ` · ${e.error}` : ""}
            </Text>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  row: { borderWidth: 1, borderRadius: 12, padding: 12 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  intent: { fontSize: 15, fontWeight: "700" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  transcript: { fontSize: 13, fontStyle: "italic", marginTop: 6 },
  meta: { fontSize: 11, marginTop: 6 },
});
