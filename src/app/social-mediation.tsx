/**
 * Elegant Social Mediation
 *
 * Discreet handling of neighbor issues. Submitting the form creates a
 * work_order with category='concierge' so it lands in the logistics
 * dashboard's WORK ORDERS section, where staff can route it to the
 * mediation team without exposing the requester's identity to neighbors.
 */
import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { trpc } from "@/lib/trpc";

type IssueType = "noise" | "odor" | "parking" | "common_area" | "other";

const ISSUE_OPTIONS: Array<{ id: IssueType; labelEn: string; labelZh: string; icon: string }> = [
  { id: "noise",        labelEn: "Noise",        labelZh: "噪音擾鄰",   icon: "speaker.wave.3.fill" },
  { id: "odor",         labelEn: "Odor",         labelZh: "異味",       icon: "wifi" },
  { id: "parking",      labelEn: "Parking",      labelZh: "停車糾紛",   icon: "house.fill" },
  { id: "common_area",  labelEn: "Common Area",  labelZh: "公共區域",   icon: "person.3.fill" },
  { id: "other",        labelEn: "Other",        labelZh: "其他",       icon: "ellipsis" },
];

export default function SocialMediationScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state } = useApp();
  const isZh = state.language === "zh";

  const [issueType, setIssueType] = useState<IssueType>("noise");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState<{ id: number } | null>(null);

  const createMutation = trpc.workOrders.create.useMutation();

  const handleSubmit = useCallback(async () => {
    if (!details.trim()) return;
    const opt = ISSUE_OPTIONS.find(o => o.id === issueType)!;
    try {
      const woId = await createMutation.mutateAsync({
        title: `[mediation] ${isZh ? opt.labelZh : opt.labelEn}`,
        description: details.trim(),
        category: "concierge",
        priority: "medium",
      });
      setSubmitted({ id: typeof woId === "number" ? woId : Number(woId) });
      setDetails("");
    } catch (err) {
      console.error("[social-mediation] submit failed", err);
    }
  }, [createMutation, details, issueType, isZh]);

  return (
    <ScreenContainer edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {isZh ? "優雅社區調節" : "Elegant Social Mediation"}
          </Text>
        </View>

        <View style={[styles.banner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}>
          <IconSymbol name="shield.fill" size={18} color={colors.primary} />
          <Text style={[styles.bannerText, { color: colors.foreground }]} numberOfLines={3}>
            {isZh
              ? "您的身份將完全保密。物業團隊會以匿名方式向涉事住戶發送禮貌提醒,維護鄰里關係。"
              : "Your identity stays anonymous. Our team will send a discreet, courteous notice to the involved unit — no names disclosed."}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>
          {isZh ? "問題類型" : "ISSUE TYPE"}
        </Text>
        <View style={styles.chipGrid}>
          {ISSUE_OPTIONS.map(opt => {
            const active = issueType === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setIssueType(opt.id)}
                style={[styles.chip, {
                  backgroundColor: active ? colors.primary + "30" : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                }]}
              >
                <IconSymbol name={opt.icon as any} size={16} color={active ? colors.primary : colors.muted} />
                <Text style={[styles.chipLabel, { color: active ? colors.primary : colors.foreground }]}>
                  {isZh ? opt.labelZh : opt.labelEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 24 }]}>
          {isZh ? "事件描述" : "DESCRIBE THE SITUATION"}
        </Text>
        <View style={[styles.textareaWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={details}
            onChangeText={setDetails}
            multiline
            numberOfLines={5}
            placeholder={isZh
              ? "請簡述狀況、發生時間、涉及的單元(若知道)..."
              : "Describe what happened, when, and the unit involved if known…"}
            placeholderTextColor={colors.muted}
            style={[styles.textarea, { color: colors.foreground }]}
          />
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!details.trim() || createMutation.isPending}
          style={[styles.submitBtn, {
            backgroundColor: !details.trim() ? colors.muted : colors.primary,
            opacity: !details.trim() ? 0.4 : 1,
          }]}
        >
          {createMutation.isPending
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={styles.submitText}>
                {isZh ? "匿名提交給物業" : "Submit Anonymously"}
              </Text>}
        </TouchableOpacity>

        {submitted && (
          <View style={[styles.successCard, { backgroundColor: colors.success + "20", borderColor: colors.success }]}>
            <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.successTitle, { color: colors.success }]}>
                {isZh ? "已送出" : "Submitted"}
              </Text>
              <Text style={[styles.successDesc, { color: colors.foreground }]}>
                {isZh
                  ? `工單編號 #WO-${submitted.id} — 物業團隊將於 24 小時內處理。`
                  : `Ticket #WO-${submitted.id} — our team will respond within 24 hours.`}
              </Text>
            </View>
          </View>
        )}

        {createMutation.error && (
          <View style={[styles.errorCard, { backgroundColor: colors.error + "20", borderColor: colors.error }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>
              {createMutation.error.message}
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "800" },
  banner: { marginHorizontal: 20, padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 24 },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  sectionLabel: { paddingHorizontal: 20, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: 12 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipLabel: { fontSize: 13, fontWeight: "600" },
  textareaWrap: { marginHorizontal: 20, borderWidth: 1.5, borderRadius: 12, padding: 12, minHeight: 110 },
  textarea: { fontSize: 14, lineHeight: 20, minHeight: 80, textAlignVertical: "top" },
  submitBtn: { marginHorizontal: 20, marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  submitText: { color: "#000", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  successCard: { marginHorizontal: 20, marginTop: 20, padding: 14, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  successTitle: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  successDesc: { fontSize: 13, lineHeight: 18 },
  errorCard: { marginHorizontal: 20, marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  errorText: { fontSize: 12, fontWeight: "600", flex: 1 },
});
