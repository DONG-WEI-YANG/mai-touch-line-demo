/**
 * Home Screen - Digital Brain AI
 * Sophisticated AI Concierge with Real-time Physical Dispatching
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { RoutingSuggestionCard } from "@/components/routing-suggestion-card";
import { trpc } from "@/lib/trpc";
import AdminDashboardScreen from "./admin-dashboard";
import { useWebVoiceRecorder } from "@/hooks/use-web-voice-recorder";

const { width } = Dimensions.get("window");

const QUICK_ACTIONS = [
  { id: "1", label: "Prepare Home", icon: "house.fill", prompt: "Prepare my apartment for arrival" },
  { id: "2", label: "Guest Access", icon: "person.3.fill", prompt: "I have a guest arriving" },
  { id: "3", label: "Silent Mode", icon: "eye.slash.fill", prompt: "Enable privacy mode" },
  { id: "4", label: "Book Spa", icon: "star.fill", prompt: "I want to book the wellness spa" },
];

export default function HomeScreen() {
  const colors = useColors();
  const { state, sendMessage, dismissRoutingSuggestion, t, setLanguage } = useApp();
  const [ttsEnabled, setTtsEnabled] = useState(false);
  // Speak the latest assistant message via the Web Speech API. Only on web —
  // gated by `window.speechSynthesis` existence so RN-native (iOS/Android)
  // builds skip silently. Triggered by ttsEnabled + new message detection.
  const lastSpokenIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ttsEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const last = state.messages[state.messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (lastSpokenIdRef.current === last.id) return;
    lastSpokenIdRef.current = last.id;
    try {
      const u = new SpeechSynthesisUtterance(last.content);
      u.lang = state.language === 'zh' ? 'zh-TW' : 'en-US';
      u.rate = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* speechSynthesis can throw on Safari without user gesture */ }
  }, [state.messages, ttsEnabled, state.language]);
  
  // HOOKS MUST BE AT TOP LEVEL
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();
  // system.activeJobs is residentProcedure-gated. Even though Brain only
  // renders for residents, Expo Router briefly mounts this screen during
  // role-based <Redirect> transitions for admin/logistics tokens too —
  // gate by role so it doesn't 403 in those windows.
  const isResident = (user as { role?: string } | undefined)?.role === 'resident';
  const { data: activeJobs, refetch: refetchJobs } = trpc.system.activeJobs.useQuery(undefined, {
    enabled: !!user && isResident,
    refetchInterval: (data, query) => {
      if (query.state.error) return false;
      return data?.length ? 1000 : 5000;
    },
  });
  const runJobMutation = trpc.system.runJob.useMutation({ onSuccess: () => refetchJobs() });

  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  // Voice input + 聲紋 visualizer. Records via MediaRecorder, visualizes via
  // AnalyserNode, sends to voice.transcribe, drops the result into the chat
  // input so the user can review before sending.
  const voice = useWebVoiceRecorder();
  const transcribeMutation = trpc.voice.transcribe.useMutation();
  const handleMicTap = useCallback(async () => {
    if (voice.state === 'recording') {
      const result = await voice.stop();
      if (!result) return;
      try {
        const r = await transcribeMutation.mutateAsync({
          audioBase64: result.audioBase64,
          mimeType: result.mimeType,
          language: state.language === 'zh' ? 'zh' : 'en',
        });
        const text = (r.text ?? '').trim();
        if (text) {
          setInputText(prev => (prev ? prev + ' ' : '') + text);
        }
      } catch (err) {
        console.error('[voice] transcribe failed', err);
      }
    } else if (voice.state === 'idle' || voice.state === 'error') {
      await voice.start();
    }
  }, [voice, transcribeMutation, state.language]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;
    sendMessage(text);
    if (text.toLowerCase().includes("prepare") || text.includes("準備")) {
      runJobMutation.mutate({ type: "arrival" });
    }
    setInputText("");
  }, [sendMessage, runJobMutation]);

  const renderMessage = useCallback(({ item }: { item: any }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessageContainer : styles.assistantMessageContainer]}>
        {!isUser && (
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary + "30" }]}>
            <IconSymbol name="brain" size={14} color={colors.primary} />
          </View>
        )}
        <View style={[styles.messageBubble, { backgroundColor: isUser ? colors.primary : colors.surface, borderBottomRightRadius: isUser ? 4 : 20, borderBottomLeftRadius: isUser ? 20 : 4, borderColor: isUser ? colors.primary : colors.border, borderWidth: 1.5 }]}>
          <Text style={[styles.messageText, { color: isUser ? "#000" : colors.foreground }]}>{item.content}</Text>
          <Text style={[styles.timestamp, { color: isUser ? "rgba(0,0,0,0.6)" : colors.muted }]}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  }, [colors]);

  useEffect(() => {
    if (state.messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [state.messages, state.isTyping]);

  // CONDITIONAL RENDERING AFTER HOOKS
  if (userLoading) {
    return <ScreenContainer edges={["top"]}><View style={styles.center}><ActivityIndicator color={colors.primary} /></View></ScreenContainer>;
  }

  if (user?.role === "admin") {
    return <AdminDashboardScreen />;
  }

  if (user?.role === "logistics") {
    // Defer to dedicated route; root layout will catch redirect to /logistics-dashboard.
    return <ScreenContainer edges={["top"]}><View style={styles.center}><Text style={{ color: "#999" }}>Redirecting to logistics dashboard…</Text></View></ScreenContainer>;
  }

  return (
    <ScreenContainer style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("home.title")}</Text>
            <View style={styles.statusRow}><View style={[styles.statusDot, { backgroundColor: "#5B9A6F" }]} /><Text style={[styles.headerSubtitle, { color: colors.muted }]}>Active • Elite Resident</Text></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              accessibilityLabel="Voice input"
              onPress={handleMicTap}
              disabled={voice.state === 'stopping' || transcribeMutation.isPending}
              style={[styles.profileBtn, {
                backgroundColor: voice.state === 'recording' ? colors.error + '30' : colors.surface,
                borderColor: voice.state === 'recording' ? colors.error : colors.border,
              }]}
            >
              {transcribeMutation.isPending
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <IconSymbol name="mic.fill" size={18} color={voice.state === 'recording' ? colors.error : colors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Toggle text-to-speech"
              onPress={() => {
                if (ttsEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
                setTtsEnabled(v => !v);
              }}
              style={[styles.profileBtn, { backgroundColor: ttsEnabled ? colors.primary + '30' : colors.surface, borderColor: ttsEnabled ? colors.primary : colors.border }]}
            >
              <IconSymbol name={ttsEnabled ? 'speaker.wave.3.fill' : 'speaker.slash.fill'} size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Toggle language"
              onPress={() => setLanguage(state.language === 'en' ? 'zh' : 'en')}
              style={[styles.profileBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                {state.language === 'en' ? '中' : 'EN'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.profileBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="person.fill" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {voice.state === 'recording' && (
          <View style={[styles.voiceOverlay, { backgroundColor: colors.surface, borderColor: colors.error }]}>
            <View style={styles.voiceHeader}>
              <View style={[styles.voiceDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.voiceLabel, { color: colors.foreground }]}>{state.language === 'zh' ? '聆聽中…' : 'Listening…'}</Text>
              <Text style={[styles.voiceHint, { color: colors.muted }]}>{state.language === 'zh' ? '再點麥克風結束' : 'Tap mic to stop'}</Text>
            </View>
            <View style={styles.waveRow}>
              {voice.bands.map((v, i) => (
                <View
                  key={i}
                  style={{
                    width: 4,
                    marginHorizontal: 2,
                    borderRadius: 2,
                    backgroundColor: colors.primary,
                    height: Math.max(3, v * 36),
                    opacity: 0.4 + v * 0.6,
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {transcribeMutation.isPending && (
          <View style={[styles.voiceOverlay, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.voiceLabel, { color: colors.foreground, marginLeft: 8 }]}>
              {state.language === 'zh' ? '辨識中…' : 'Transcribing…'}
            </Text>
          </View>
        )}

        {activeJobs?.map(job => (
          <View key={job.id} style={[styles.jobOverlay, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <View style={styles.jobHeader}>
              <IconSymbol name="bolt.fill" size={14} color={colors.primary} />
              <Text style={[styles.jobTitle, { color: colors.foreground }]}>Digital Brain Dispatching: {job.type.toUpperCase()}</Text>
              <Text style={[styles.jobProgress, { color: colors.primary }]}>{job.progress}%</Text>
            </View>
            <View style={[styles.jobBarBg, { backgroundColor: colors.border }]}><View style={[styles.jobBarFill, { backgroundColor: colors.primary, width: `${job.progress}%` }]} /></View>
            <Text style={[styles.jobStep, { color: colors.muted }]}>{job.currentStep}</Text>
          </View>
        ))}

        {state.routingSuggestion && <View style={styles.suggestionOverlay}><RoutingSuggestionCard suggestion={state.routingSuggestion as any} onDismiss={dismissRoutingSuggestion} /></View>}

        <FlatList
          ref={flatListRef}
          data={state.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          ListHeaderComponent={() => (
            <View style={styles.quickActionsContainer}>
              <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t("home.suggested")}</Text>
              <View style={styles.quickActionsGrid}>
                {QUICK_ACTIONS.map((action) => (
                  <TouchableOpacity key={action.id} style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => handleSend(action.prompt)}>
                    <IconSymbol name={action.icon as any} size={18} color={colors.primary} />
                    <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          ListFooterComponent={() => state.isTyping ? <View style={styles.typingContainer}><ActivityIndicator size="small" color={colors.primary} /><Text style={[styles.typingText, { color: colors.muted }]}>{t("home.thinking")}</Text></View> : null}
        />

        <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <TextInput style={[styles.input, { color: colors.foreground }]} placeholder={t("home.how_help")} placeholderTextColor={colors.muted} value={inputText} onChangeText={setInputText} multiline />
            <TouchableOpacity style={[styles.sendButton, { backgroundColor: inputText.trim() ? colors.primary : "transparent" }]} onPress={() => handleSend(inputText)} disabled={!inputText.trim() || state.isTyping}><IconSymbol name="arrow.right" size={18} color={inputText.trim() ? "#000" : colors.muted} /></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  headerSubtitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  profileBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  jobOverlay: { margin: 16, padding: 16, borderRadius: 20, borderWidth: 1.5, gap: 10, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  voiceOverlay: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 10 },
  voiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 0 },
  voiceDot: { width: 8, height: 8, borderRadius: 4 },
  voiceLabel: { fontSize: 13, fontWeight: '700' },
  voiceHint: { fontSize: 11, fontWeight: '500' },
  waveRow: { flexDirection: 'row', alignItems: 'center', flex: 1, height: 40, justifyContent: 'flex-end' },
  jobHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  jobTitle: { flex: 1, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  jobProgress: { fontSize: 12, fontWeight: "900" },
  jobBarBg: { height: 4, borderRadius: 2, overflow: "hidden" },
  jobBarFill: { height: "100%", borderRadius: 2 },
  jobStep: { fontSize: 11, fontWeight: "600", fontStyle: "italic" },
  suggestionOverlay: { paddingHorizontal: 16, marginTop: 8 },
  messagesList: { paddingHorizontal: 20, paddingBottom: 20 },
  quickActionsContainer: { marginVertical: 24 },
  sectionTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingHorizontal: 4 },
  quickActionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickActionCard: { width: (width - 50) / 2, padding: 18, borderRadius: 18, borderWidth: 1.5, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
  quickActionLabel: { fontSize: 14, fontWeight: "700", letterSpacing: 0.2 },
  messageContainer: { marginVertical: 8, flexDirection: "row", alignItems: "flex-end" },
  userMessageContainer: { justifyContent: "flex-end" },
  assistantMessageContainer: { justifyContent: "flex-start" },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 8, marginBottom: 4 },
  messageBubble: { maxWidth: "85%", paddingHorizontal: 18, paddingVertical: 14, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },
  messageText: { fontSize: 16, lineHeight: 22, fontWeight: "500" },
  timestamp: { fontSize: 11, marginTop: 6, textAlign: "right" },
  typingContainer: { flexDirection: "row", alignItems: "center", paddingVertical: 16, gap: 12 },
  typingText: { fontSize: 14, fontStyle: "italic" },
  inputWrapper: { paddingHorizontal: 20, paddingVertical: 24, borderTopWidth: 1 },
  inputContainer: { flexDirection: "row", alignItems: "flex-end", borderRadius: 28, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 10, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8 },
  input: { flex: 1, fontSize: 15, maxHeight: 100, paddingVertical: 8 },
  sendButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 2 },
});
