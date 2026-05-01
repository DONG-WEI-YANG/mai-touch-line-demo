/**
 * Settings Screen
 * User profile and preferences with RBAC
 */
import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

type SettingItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  type: "toggle" | "navigation" | "action";
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
};

export default function SettingsScreen() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { state, setLanguage, t } = useApp();
  
  // Real-time RBAC check from server
  const { data: user } = trpc.auth.me.useQuery();
  const isAdmin = user?.role === "admin";

  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(colorScheme === "dark");

  const handleLanguagePress = () => {
    const nextLang = state.language === "en" ? "zh" : "en";
    setLanguage(nextLang);
  };

  const profileSettings: SettingItem[] = [
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
      title: "Notifications",
      subtitle: "Push notifications for updates",
      icon: "bell.fill",
      type: "toggle",
      value: notifications,
      onToggle: setNotifications,
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
      subtitle: "Use dark color scheme",
      icon: "moon.fill",
      type: "toggle",
      value: darkMode,
      onToggle: setDarkMode,
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
    onPress: () => Alert.alert("Logout", "Are you sure?"),
  });

  const renderSettingItem = (item: SettingItem) => {
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={item.onPress}
        activeOpacity={item.type === "toggle" ? 1 : 0.7}
        disabled={item.type === "toggle"}
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
            onValueChange={item.onToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        )}

        {item.type === "navigation" && (
          <IconSymbol name="chevron.right" size={20} color={colors.muted} />
        )}
      </TouchableOpacity>
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
