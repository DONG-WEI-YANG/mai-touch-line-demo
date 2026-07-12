import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { TranslationKey } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

type Service = {
  id: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  icon: string;
  category: "operations" | "lifestyle";
  route?: string;
  adminOnly?: boolean;
};

const SERVICES: Service[] = [
  // Admin Infrastructure
  {
    id: "admin-iot",
    titleKey: "smarthome.title",
    descKey: "settings.admin_desc",
    icon: "bolt.fill",
    category: "operations",
    route: "/admin/amenity-iot",
    adminOnly: true,
  },
  // Property Operations
  {
    id: "voice-booking",
    titleKey: "services.voice.title",
    descKey: "services.voice.desc",
    icon: "mic.fill",
    category: "operations",
    route: "/voice-booking",
  },
  {
    id: "digital-wallet",
    titleKey: "wallet.title",
    descKey: "wallet.balance",
    icon: "creditcard",
    category: "operations",
    route: "/wallet",
  },
  {
    id: "social-mediation",
    titleKey: "services.social.title",
    descKey: "services.social.desc",
    icon: "person.3.fill",
    category: "operations",
    route: "/social-mediation",
  },
  
  // Lifestyle Experience
  {
    id: "smart-home",
    titleKey: "smarthome.title",
    descKey: "services.space.desc",
    icon: "house.fill",
    category: "lifestyle",
    route: "/smart-home",
  },
  {
    id: "lifestyle-curation",
    titleKey: "services.curation.title",
    descKey: "services.curation.desc",
    icon: "calendar",
    category: "lifestyle",
    route: "/amenities",
  },
];

export default function ServicesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { t } = useApp();
  const { data: user } = trpc.auth.me.useQuery();
  const isAdmin = user?.role === "admin";

  const handleServicePress = useCallback((service: Service) => {
    if (service.route) {
      router.push(service.route as any);
    } else {
      router.push("/");
    }
  }, [router]);

  const renderService = (service: Service) => {
    // RBAC Filter
    if (service.adminOnly && !isAdmin) return null;
    if (isAdmin && service.id === "smart-home") return null; // Admins use admin-iot

    return (
      <TouchableOpacity
        key={service.id}
        style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => handleServicePress(service)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + "20" }]}>
          <IconSymbol name={service.icon as any} size={28} color={colors.primary} />
        </View>
        <View style={styles.serviceContent}>
          <Text style={[styles.serviceTitle, { color: colors.foreground }]}>{t(service.titleKey)}</Text>
          <Text style={[styles.serviceDescription, { color: colors.muted }]}>{t(service.descKey)}</Text>
        </View>
        <IconSymbol name="chevron.right" size={20} color={colors.muted} />
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{isAdmin ? "Operations Hub" : t("services.title")}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            {isAdmin ? "Infrastructure and community management" : "Elite property management and lifestyle curation"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("services.ops")}</Text>
          {SERVICES.filter(s => s.category === "operations").map(renderService)}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("services.life")}</Text>
          {SERVICES.filter(s => s.category === "lifestyle").map(renderService)}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 32 },
  header: { paddingHorizontal: 20, paddingVertical: 20 },
  headerTitle: { fontSize: 28, fontWeight: "700" },
  headerSubtitle: { fontSize: 14, marginTop: 4 },
  section: { paddingHorizontal: 16, marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  serviceCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1.5, marginBottom: 12, gap: 14 },
  iconContainer: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  serviceContent: { flex: 1 },
  serviceTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  serviceDescription: { fontSize: 13, lineHeight: 18 },
});
