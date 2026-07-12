/**
 * VoiceBookingPanel — 押住說話 → 提案 → 確認 → 訂/派 的共用 UI。
 *
 * 「聽懂並提案,確認後才寫入」:錄音送到 command()(voice.command / staffCommand)
 * 拿回提案,使用者在卡片上補齊/修正 slot,按「確認」才呼叫 commit()。住戶版與物業
 * 櫃台版共用本元件,只差注入的 command / commit 兩個函式。
 * 設計見 docs/superpowers/specs/2026-07-12-voice-booking-design.md。
 */
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useWebVoiceRecorder } from "@/hooks/use-web-voice-recorder";

export type VoiceSlots = {
  facility?: "gym" | "pool" | "meeting_room" | "lounge" | "bbq" | "sauna";
  date?: string;
  time?: string;
  issue?: string;
  location?: string;
  urgency?: "low" | "med" | "high";
  [k: string]: unknown;
};

export type VoiceProposal = {
  transcript: string;
  intent: string;
  kind: "booking" | "work_order" | "query" | "unclear";
  slots: VoiceSlots;
  missing: string[];
  confidence: number;
  language: string;
};

type Audio = { audioBase64: string; mimeType: string };

type Props = {
  command: (audio: Audio) => Promise<VoiceProposal>;
  commit: (intent: string, slots: VoiceSlots) => Promise<{ ref: string }>;
  /** Optional gate — e.g. property desk must pick a resident before recording. */
  disabled?: boolean;
  disabledHint?: string;
};

const FACILITY_LABEL: Record<string, string> = {
  gym: "健身房", pool: "游泳池", meeting_room: "會議室", lounge: "交誼廳", bbq: "烤肉區", sauna: "三溫暖",
};
const REQUIRED: Record<string, string[]> = {
  booking: ["facility", "date", "time"],
  work_order: ["issue", "location", "urgency"],
};

export function VoiceBookingPanel({ command, commit, disabled, disabledHint }: Props) {
  const colors = useColors();
  const voice = useWebVoiceRecorder();
  const [phase, setPhase] = useState<"idle" | "thinking" | "review" | "committing" | "done">("idle");
  const [proposal, setProposal] = useState<VoiceProposal | null>(null);
  const [slots, setSlots] = useState<VoiceSlots>({});
  const [resultRef, setResultRef] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const busy = phase === "thinking" || phase === "committing";
  const recording = voice.state === "recording";

  const missing = useMemo(() => {
    if (!proposal || (proposal.kind !== "booking" && proposal.kind !== "work_order")) return [];
    return (REQUIRED[proposal.kind] ?? []).filter((k) => {
      const v = (slots as Record<string, unknown>)[k];
      return v == null || v === "";
    });
  }, [proposal, slots]);

  const reset = useCallback(() => {
    setPhase("idle"); setProposal(null); setSlots({}); setResultRef(null); setErrorMsg(null);
  }, []);

  const onPressIn = useCallback(async () => {
    if (disabled || busy) return;
    setErrorMsg(null); setResultRef(null); setProposal(null);
    await voice.start();
  }, [disabled, busy, voice]);

  const onPressOut = useCallback(async () => {
    if (voice.state !== "recording") return;
    const audio = await voice.stop();
    if (!audio) { setErrorMsg("沒有收到音訊,請再試一次"); return; }
    setPhase("thinking");
    try {
      const p = await command(audio);
      setProposal(p);
      setSlots(p.slots ?? {});
      setPhase("review");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "語音辨識失敗");
      setPhase("idle");
    }
  }, [voice, command]);

  const onConfirm = useCallback(async () => {
    if (!proposal || missing.length > 0) return;
    setPhase("committing");
    try {
      const { ref } = await commit(proposal.intent, slots);
      setResultRef(ref);
      setPhase("done");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "送出失敗,請再試一次");
      setPhase("review");
    }
  }, [proposal, missing, commit, slots]);

  const setSlot = (k: keyof VoiceSlots, v: unknown) => setSlots((s) => ({ ...s, [k]: v }));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Mic — push to talk */}
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || busy}
        style={[
          styles.mic,
          { backgroundColor: recording ? colors.error : disabled || busy ? colors.muted : colors.primary },
        ]}
      >
        <Text style={styles.micIcon}>{recording ? "■" : "🎙"}</Text>
      </Pressable>
      <Text style={[styles.hint, { color: colors.muted }]}>
        {disabled ? (disabledHint ?? "尚未就緒")
          : recording ? "放開結束 · 說出你的需求"
          : busy ? "處理中…" : "按住說話（例:預約明天晚上七點健身房)"}
      </Text>

      {errorMsg && <Text style={[styles.error, { color: colors.error }]}>{errorMsg}</Text>}
      {phase === "thinking" && <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />}

      {/* Proposal review (stays mounted through committing) */}
      {(phase === "review" || phase === "committing") && proposal && (
        <View style={styles.section}>
          <Text style={[styles.transcript, { color: colors.muted }]}>「{proposal.transcript}」</Text>

          {proposal.kind === "unclear" && (
            <Text style={[styles.notice, { color: colors.warning }]}>沒聽清楚或無法判斷,請重說一次,或改用手動預約。</Text>
          )}
          {proposal.kind === "query" && (
            <Text style={[styles.notice, { color: colors.muted }]}>這是查詢類指令,不會建立預約或工單。</Text>
          )}

          {proposal.kind === "booking" && (
            <>
              <Text style={[styles.title, { color: colors.foreground }]}>預約 · {FACILITY_LABEL[String(slots.facility)] ?? "（未指定公設）"}</Text>
              <Field label="日期" value={String(slots.date ?? "")} onChange={(v) => setSlot("date", v)} placeholder="YYYY-MM-DD" colors={colors} flag={missing.includes("date")} />
              <Field label="時間" value={String(slots.time ?? "")} onChange={(v) => setSlot("time", v)} placeholder="HH:MM" colors={colors} flag={missing.includes("time")} />
              {missing.includes("facility") && <Text style={[styles.notice, { color: colors.warning }]}>未辨識出公設,請重說並指定(例:健身房)。</Text>}
            </>
          )}

          {proposal.kind === "work_order" && (
            <>
              <Text style={[styles.title, { color: colors.foreground }]}>派單 · {proposal.intent}</Text>
              <Field label="問題" value={String(slots.issue ?? "")} onChange={(v) => setSlot("issue", v)} placeholder="例:浴室漏水" colors={colors} flag={missing.includes("issue")} />
              <Field label="地點" value={String(slots.location ?? "")} onChange={(v) => setSlot("location", v)} placeholder="例:主臥浴室" colors={colors} flag={missing.includes("location")} />
              <UrgencyPicker value={(slots.urgency as string) ?? ""} onChange={(v) => setSlot("urgency", v)} colors={colors} flag={missing.includes("urgency")} />
            </>
          )}

          {(proposal.kind === "booking" || proposal.kind === "work_order") && (
            <Pressable
              onPress={onConfirm}
              disabled={missing.length > 0}
              style={[styles.confirm, { backgroundColor: missing.length > 0 ? colors.muted : colors.success }]}
            >
              <Text style={styles.confirmText}>
                {missing.length > 0 ? `還缺 ${missing.length} 項` : phase === "committing" ? "送出中…" : "確認送出"}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={reset} style={styles.link}><Text style={{ color: colors.muted }}>重新開始</Text></Pressable>
        </View>
      )}

      {/* Success */}
      {phase === "done" && resultRef && (
        <View style={styles.section}>
          <Text style={[styles.title, { color: colors.success }]}>✅ 已送出 · 單號 {resultRef}</Text>
          <Pressable onPress={reset} style={[styles.confirm, { backgroundColor: colors.primary }]}>
            <Text style={styles.confirmText}>再來一筆</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Field({ label, value, onChange, placeholder, colors, flag }: any) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: flag ? colors.warning : colors.muted }]}>{label}{flag ? " *" : ""}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.foreground, borderColor: flag ? colors.warning : colors.border }]}
      />
    </View>
  );
}

function UrgencyPicker({ value, onChange, colors, flag }: any) {
  const opts: Array<{ k: string; label: string }> = [
    { k: "low", label: "低" }, { k: "med", label: "中" }, { k: "high", label: "高" },
  ];
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: flag ? colors.warning : colors.muted }]}>緊急度{flag ? " *" : ""}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {opts.map((o) => (
          <Pressable key={o.k} onPress={() => onChange(o.k)}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: value === o.k ? colors.primary : "transparent" }]}>
            <Text style={{ color: value === o.k ? "#fff" : colors.foreground }}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center" },
  mic: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  micIcon: { fontSize: 34, color: "#fff" },
  hint: { marginTop: 12, fontSize: 13, textAlign: "center" },
  error: { marginTop: 10, fontSize: 13, textAlign: "center" },
  section: { width: "100%", marginTop: 16 },
  transcript: { fontSize: 14, fontStyle: "italic", marginBottom: 10, textAlign: "center" },
  notice: { fontSize: 13, marginTop: 8, textAlign: "center" },
  title: { fontSize: 17, fontWeight: "800", marginBottom: 10 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, marginBottom: 4, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  confirm: { marginTop: 8, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  confirmText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  link: { marginTop: 12, alignItems: "center" },
});
