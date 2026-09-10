import { useAuth } from "@/hooks/use-auth";
import { Alert } from "@/lib/alert";
/**
 * Settings Screen
 * User profile and preferences with RBAC
 */
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet,  Image, Linking } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

type SettingItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  type: "toggle" | "navigation" | "action" | "status";
  disabled?: boolean;
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
};

export default function SettingsScreen() {
  const colors = useColors();
  const { logout } = useAuth();
  const { scheme, setTheme } = useThemePreference();
  const router = useRouter();
  const { state, setLanguage, t } = useApp();
  
  // Real-time RBAC check from server
  const { data: user } = trpc.auth.me.useQuery();
  const isAdmin = user?.role === "admin";

  const [savingTheme, setSavingTheme] = useState(false);
  const changeTheme = (dark: boolean) => {
    if (savingTheme) return;
    setSavingTheme(true);
    void setTheme(dark ? "dark" : "light")
      .catch(() => Alert.alert(state.language === "en" ? "Theme not saved" : "主題未儲存", state.language === "en" ? "Please try again." : "請稍後重試。"))
      .finally(() => setSavingTheme(false));
  };

  // ── LINE binding (resident only) ────────────────────────────────────────
  // Poll bindStatus every 3s while a code is active so the UI flips to "✓
  // bound" without the user having to refresh after they tap "Send" in LINE.
  const [bindCode, setBindCode] = useState<{ code: string; expiresAt: string; deepLink: string; command: string } | null>(null);
  const isResident = user?.role === "resident";
  const bindStatus = trpc.auth.bindStatus.useQuery(undefined, {
    enabled: isResident,
    refetchInterval: bindCode ? 3000 : false,
    refetchOnWindowFocus: false,
  });
  const startBindMutation = trpc.auth.startLineBind.useMutation();
  const unbindMutation = trpc.auth.unbindLine.useMutation();
  const revokeMutation = trpc.auth.revokeAllTokens.useMutation();
  const handleRevoke = () => Alert.alert("撤銷所有個人登入連結", "所有裝置的個人登入連結將失效，需回 LINE 重新開啟 Web 入口。舊登入的離線待送操作不會自動改用新憑證傳送。Demo 共用登入不受影響。", [
    { text: "取消", style: "cancel" },
    { text: "撤銷", style: "destructive", onPress: () => {
      if (revokeMutation.isPending) return;
      void revokeMutation.mutateAsync().then(async () => { await logout(); router.replace("/login"); })
        .catch((error: Error) => Alert.alert("撤銷未完成", error.message));
    } },
  ]);

  useEffect(() => {
    // Once the binding succeeds, drop the active code panel.
    if (bindStatus.data?.bound && bindCode) setBindCode(null);
  }, [bindStatus.data?.bound, bindCode]);

  const handleStartBind = async () => {
    try {
      const r = await startBindMutation.mutateAsync();
      setBindCode(r);
    } catch (err: any) {
      Alert.alert("Bind failed", err?.message ?? "");
    }
  };
  const handleUnbind = async () => {
    await unbindMutation.mutateAsync();
    bindStatus.refetch();
  };
  const openDeepLink = (url: string) => {
    if (typeof window !== "undefined") window.open(url, "_blank");
    else Linking.openURL(url);
  };
  const qrSrc = bindCode?.deepLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(bindCode.deepLink)}`
    : null;

  const handleLanguagePress = () => {
    const nextLang = state.language === "en" ? "zh" : "en";
    setLanguage(nextLang);
  };

  const profileSettings: SettingItem[] = [
    { id: "revokeTokens", title: "撤銷所有個人登入連結", subtitle: "讓各裝置舊連結失效；本機登出不會撤銷", icon: "lock.fill", type: "action", onPress: handleRevoke },
    {
      id: "profile",
      title: t("settings.profile"),
      subtitle: state.profile.name || "Resident information",
      icon: "person.fill",
      type: "navigation",
      onPress: () => router.push("/profile-edit" as any),
    },
  ];

  const preferenceSettings: SettingItem[] = [
    {
      id: "notifications",
      title: state.language === "en" ? "Push notifications" : "推播通知",
      subtitle: state.language === "en" ? "Not configured for this Demo. View updates in the app or LINE." : "此 Demo 尚未啟用推播，請在服務頁面或 LINE 查看更新。",
      icon: "bell.fill",
      type: "status",
    },
    {
      id: "language",
      title: t("settings.language"),
      subtitle: state.language === "en" ? "English" : "繁體中文",
      icon: "globe",
      type: "navigation",
      onPress: handleLanguagePress,
    },
    {
      id: "theme",
      title: t("settings.dark_mode"),
      subtitle: state.language === "en" ? "Apply across the app and remember on this device" : "套用全站深色外觀，並記住此裝置的選擇",
      icon: "moon.fill",
      type: "toggle",
      value: scheme === "dark",
      onToggle: changeTheme,
      disabled: savingTheme,
    },
  ];

  const appSettings: SettingItem[] = [];
  
  // RBAC: Only show Admin Portal to authorized users
  if (isAdmin) {
    appSettings.push({
      id: "admin",
      title: t("settings.admin"),
      subtitle: t("settings.admin_desc"),
      icon: "shield.fill",
      type: "navigation",
      onPress: () => router.push("/admin-dashboard" as any),
    });
  }

  appSettings.push({
    id: "logout",
    title: t("settings.logout"),
    icon: "arrow.right",
    type: "action",
    onPress: () => Alert.alert("登出", "確定要登出目前帳戶？", [{text:"取消",style:"cancel"},{text:"登出",onPress:() => { void logout().then(() => router.replace("/login")).catch(() => Alert.alert("登出失敗", "請檢查連線後重試。")); }}]),
  });

  const renderSettingItem = (item: SettingItem) => {
    const Container = item.type === 'toggle' || item.type === 'status' ? View : TouchableOpacity;
    return (
      <Container
        key={item.id}
        style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
        {...(Container === TouchableOpacity ? {onPress:item.onPress,activeOpacity:0.7} : {})}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + "20" }]}>
          <IconSymbol name={item.icon as any} size={20} color={colors.primary} />
        </View>

        <View style={styles.settingContent}>
          <Text style={[styles.settingTitle, { color: colors.foreground }]}>{item.title}</Text>
          {item.subtitle && (
            <Text style={[styles.settingSubtitle, { color: colors.muted }]}>{item.subtitle}</Text>
          )}
        </View>

        {item.type === "toggle" && item.onToggle && (
          <Switch
            value={item.value}
            disabled={item.disabled}
            accessibilityLabel={item.title}
            onValueChange={item.onToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        )}

        {item.type === "navigation" && (
          <IconSymbol name="chevron.right" size={20} color={colors.muted} />
        )}
      </Container>
    );
  };

  return (
    <ScreenContainer edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("settings.title")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t("settings.profile")}</Text>
          {profileSettings.map(renderSettingItem)}
        </View>

        {isResident && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>{state.language === 'zh' ? 'LINE 綁定' : 'LINE LINKING'}</Text>
            {bindStatus.data?.bound ? (
              <View style={[lineBindStyles.card, { backgroundColor: colors.surface, borderColor: colors.success }]}>
                <View style={lineBindStyles.row}>
                  <View style={[lineBindStyles.iconCircle, { backgroundColor: colors.success + '25' }]}>
                    <IconSymbol name="checkmark.circle.fill" size={22} color={colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[lineBindStyles.title, { color: colors.foreground }]}>
                      {state.language === 'zh' ? '已綁定 LINE' : 'LINE is linked'}
                    </Text>
                    <Text style={[lineBindStyles.subtitle, { color: colors.muted }]} numberOfLines={1}>
                      {bindStatus.data.lineUserId?.slice(0, 18)}…
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleUnbind}>
                    <Text style={{ color: colors.error, fontSize: 13, fontWeight: '700' }}>
                      {state.language === 'zh' ? '解除' : 'Unbind'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : bindCode ? (
              <View style={[lineBindStyles.card, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                <Text style={[lineBindStyles.title, { color: colors.foreground, marginBottom: 6 }]}>
                  {state.language === 'zh' ? '掃 QR 一鍵綁定' : 'Scan to link LINE'}
                </Text>
                <Text style={[lineBindStyles.subtitle, { color: colors.muted, marginBottom: 12 }]}>
                  {state.language === 'zh'
                    ? '手機掃描下方 QR,LINE 會自動開啟並預填訊息,按「傳送」即完成'
                    : 'Scan with your phone — LINE opens with the bind message ready to send'}
                </Text>
                {qrSrc && (
                  <View style={lineBindStyles.qrWrap}>
                    <Image source={{ uri: qrSrc }} style={{ width: 180, height: 180 }} resizeMode="contain" />
                  </View>
                )}
                <View style={lineBindStyles.codeRow}>
                  <Text style={[lineBindStyles.codeLabel, { color: colors.muted }]}>
                    {state.language === 'zh' ? '手動輸入綁定碼' : 'Or send manually'}
                  </Text>
                  <Text style={[lineBindStyles.codeMono, { color: colors.primary }]}>{bindCode.command}</Text>
                </View>
                <View style={lineBindStyles.btnRow}>
                  {bindCode.deepLink !== "" && (
                    <TouchableOpacity
                      onPress={() => openDeepLink(bindCode.deepLink)}
                      style={[lineBindStyles.primaryBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={{ color: '#000', fontWeight: '800', fontSize: 13 }}>
                        {state.language === 'zh' ? '在 LINE 開啟' : 'Open in LINE'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setBindCode(null)} style={lineBindStyles.cancelBtn}>
                    <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>
                      {state.language === 'zh' ? '取消' : 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleStartBind}
                disabled={startBindMutation.isPending}
                style={[lineBindStyles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: startBindMutation.isPending ? 0.5 : 1 }]}
              >
                <View style={lineBindStyles.row}>
                  <View style={[lineBindStyles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                    <IconSymbol name="qrcode" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[lineBindStyles.title, { color: colors.foreground }]}>
                      {state.language === 'zh' ? '綁定 LINE 帳號' : 'Link your LINE'}
                    </Text>
                    <Text style={[lineBindStyles.subtitle, { color: colors.muted }]}>
                      {state.language === 'zh'
                        ? '綁定後可在 LINE 收到工單派遣與預約狀態通知'
                        : 'Receive work-order and booking status pushes on LINE'}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={colors.muted} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t("settings.preferences")}</Text>
          {preferenceSettings.map(renderSettingItem)}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t("settings.app")}</Text>
          {appSettings.map(renderSettingItem)}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 32 },
  header: { paddingHorizontal: 20, paddingVertical: 20 },
  headerTitle: { fontSize: 28, fontWeight: "700" },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 12, paddingHorizontal: 4 },
  settingItem: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, borderWidth: 0.5, marginBottom: 8, gap: 12 },
  iconContainer: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: 16, fontWeight: "600" },
  settingSubtitle: { fontSize: 13, marginTop: 2 },
});

const lineBindStyles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, borderWidth: 1.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700" },
  subtitle: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  qrWrap: { alignItems: "center", paddingVertical: 12, backgroundColor: "#fff", borderRadius: 8 },
  codeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#444" },
  codeLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  codeMono: { fontSize: 14, fontWeight: "700", fontFamily: "monospace" },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  primaryBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
});
