/**
 * 住戶語音預約/派單 — 押住說話,自助完成公設預約或報修派單。
 * 身份即登入住戶(voice.command / voice.commit)。
 */
import { useRouter } from "expo-router";
import React from "react";
import { Text, View, ScrollView, StyleSheet, Pressable } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { VoiceBookingPanel, type VoiceSlots } from "@/components/voice-booking-panel";
import { useColors } from "@/hooks/use-colors";
import { invalidateDomainCaches } from "@/lib/mutation-cache";
import { trpc } from "@/lib/trpc";

/**
 * 例句不是裝飾。語音介面最大的失敗點是使用者盯著麥克風不知道能說什麼,
 * 於是隨便說一句、被判為 unclear、然後再也不用。給三句可直接照唸的話,
 * 比任何說明文字都有效。
 */
const EXAMPLES = [
  "預約明天晚上七點健身房",
  "這週六下午兩點想用交誼廳",
  "主臥浴室漏水,要報修",
];

export default function VoiceBookingScreen() {
  const colors = useColors();
  const router = useRouter();
  const utils = trpc.useUtils();
  const commandMutation = trpc.voice.command.useMutation();
  const commitMutation = trpc.voice.commit.useMutation({
    onSuccess: async () => {
      await invalidateDomainCaches("booking", utils);
      await invalidateDomainCaches("workOrder", utils);
    },
  });

  return (
    <ScreenContainer edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>語音預約 · 報修</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          按住麥克風說出需求,系統聽懂後會先給你一張確認卡,確認無誤才會送出。
        </Text>

        <VoiceBookingPanel
          command={(audio) =>
            commandMutation.mutateAsync({ audioBase64: audio.audioBase64, mimeType: audio.mimeType, language: "zh" })
          }
          commit={(intent: string, slots: VoiceSlots, requestId: string) =>
            commitMutation.mutateAsync({ intent: intent as any, slots: slots as any, requestId })
          }
        />

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>可以這樣說</Text>
        <View style={styles.examples}>
          {EXAMPLES.map((example) => (
            <View
              key={example}
              style={[styles.example, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.exampleText, { color: colors.foreground }]}>「{example}」</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>送出之後</Text>
        <View style={styles.links}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/my-bookings")}
            style={[styles.link, { borderColor: colors.border }]}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>查看我的預約</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/activity")}
            style={[styles.link, { borderColor: colors.border }]}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>追蹤報修進度</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 28,
    marginBottom: 12,
  },
  examples: { gap: 8 },
  example: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  exampleText: { fontSize: 14, lineHeight: 21 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  link: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 9 },
  linkText: { fontSize: 13, fontWeight: "700" },
});
