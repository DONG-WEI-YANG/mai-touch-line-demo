/**
 * 物業櫃台語音代辦 — 物業人員先選「代哪一戶」,再押住說話代住戶預約/派單。
 * 走 staff 端點(voice.staffCommand / staffCommit),以 targetUserId 身份寫入。
 */
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminHeader } from "@/components/admin/admin-ui";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { VoiceBookingPanel, type VoiceSlots } from "@/components/voice-booking-panel";

export default function VoiceDeskScreen() {
  const colors = useColors();
  const [targetUserId, setTargetUserId] = useState<number | null>(null);

  const { data: residents = [], isLoading } = trpc.voice.residents.useQuery();
  const commandMutation = trpc.voice.staffCommand.useMutation();
  const commitMutation = trpc.voice.staffCommit.useMutation();

  const selected = residents.find((r: any) => r.id === targetUserId);

  return (
    <ScreenContainer edges={["top"]}>
      <AdminHeader title="櫃台語音代辦" subtitle={selected ? `代:${selected.name}` : "請先選擇住戶"} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>選擇住戶</Text>
        <View style={styles.residentGrid}>
          {isLoading && <Text style={{ color: colors.muted }}>載入中…</Text>}
          {residents.map((r: any) => (
            <Pressable
              key={r.id}
              onPress={() => setTargetUserId(r.id)}
              style={[
                styles.residentChip,
                { borderColor: colors.border, backgroundColor: r.id === targetUserId ? colors.primary : colors.surface },
              ]}
            >
              <Text style={{ color: r.id === targetUserId ? "#fff" : colors.foreground, fontWeight: "600" }}>
                {r.name}{r.unitNumber ? ` · ${r.unitNumber}` : ""}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 20 }} />

        <VoiceBookingPanel
          disabled={targetUserId == null}
          disabledHint="請先於上方選擇住戶"
          command={(audio) =>
            commandMutation.mutateAsync({
              audioBase64: audio.audioBase64,
              mimeType: audio.mimeType,
              language: "zh",
              targetUserId: targetUserId as number,
            })
          }
          commit={(intent: string, slots: VoiceSlots) =>
            commitMutation.mutateAsync({ intent: intent as any, slots: slots as any, targetUserId: targetUserId as number })
          }
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase" },
  residentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  residentChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1 },
});
