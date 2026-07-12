/**
 * 住戶語音預約/派單 — 押住說話,自助完成公設預約或報修派單。
 * 身份即登入住戶(voice.command / voice.commit)。
 */
import React from "react";
import { Text, ScrollView, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { VoiceBookingPanel, type VoiceSlots } from "@/components/voice-booking-panel";

export default function VoiceBookingScreen() {
  const colors = useColors();
  const commandMutation = trpc.voice.command.useMutation();
  const commitMutation = trpc.voice.commit.useMutation();

  return (
    <ScreenContainer edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>語音預約 · 報修</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          按住麥克風說出需求,例如「預約明天晚上七點健身房」或「浴室漏水要報修」。
        </Text>

        <VoiceBookingPanel
          command={(audio) =>
            commandMutation.mutateAsync({ audioBase64: audio.audioBase64, mimeType: audio.mimeType, language: "zh" })
          }
          commit={(intent: string, slots: VoiceSlots) =>
            commitMutation.mutateAsync({ intent: intent as any, slots: slots as any })
          }
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
});
