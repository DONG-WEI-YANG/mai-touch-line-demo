import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function GuestPassScreen() {
  const colors = useColors();
  const { t, state: _state } = useApp();
  const router = useRouter();
  
  const [scanAnim] = useState(new Animated.Value(0));
  const logEntryMutation = trpc.access.logEntry.useMutation();

  const handleSimulateScan = async () => {
    try {
      await logEntryMutation.mutateAsync({
        entryPoint: "Main Lobby",
        result: "success"
      });
      Alert.alert("Access Granted", "Welcome to m'AI Touch Residence.\nThe gate is now open.");
    } catch (e) {
      Alert.alert("Access Denied", "Invalid pass or system error.");
    }
  };

  useEffect(() => {
    // Continuous scanning line animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: false, // height/translateY might not support native driver on web
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200],
  });

  return (
    <ScreenContainer edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("access.title")}</Text>
      </View>

      <View style={styles.content}>
        {/* The Digital Pass Card - Dark Luxury Theme */}
        <View style={[styles.passCard, { backgroundColor: "#1A1A1A", borderColor: colors.primary }]}>
          <View style={styles.passHeader}>
            <IconSymbol name="brain" size={24} color={colors.primary} />
            <Text style={[styles.passBrand, { color: colors.primary }]}>m'AI Touch Access</Text>
          </View>

          {/* Simulated QR Code Area */}
          <View style={[styles.qrContainer, { borderColor: colors.primary }]}>
            <View style={styles.qrGrid}>
              <IconSymbol name="qrcode" size={160} color="#FFFFFF" />
            </View>
            <Animated.View 
              style={[
                styles.scanLine, 
                { 
                  backgroundColor: colors.primary,
                  transform: [{ translateY: scanTranslateY }]
                }
              ]} 
            />
          </View>

          <View style={styles.passInfo}>
            <Text style={[styles.infoLabel, { color: "#888" }]}>{t("access.guest_name")}</Text>
            <Text style={[styles.infoValue, { color: "#FFF" }]}>VIP Guest • Dr. Chen</Text>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <View>
                <Text style={[styles.infoLabel, { color: "#888" }]}>{t("access.valid_until")}</Text>
                <Text style={[styles.infoValue, { color: "#FFF" }]}>Today, 23:59</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.success + "20" }]}>
                <Text style={[styles.statusText, { color: colors.success }]}>{t("access.pass_active")}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={[styles.hintText, { color: colors.muted }]}>
          {t("access.scan_hint")}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handleSimulateScan}
          >
            <IconSymbol name="sensor.tag.radiowaves.forward.fill" size={20} color="#000" />
            <Text style={styles.actionBtnText}>Simulate Lobby Scan</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.shareBtn, { borderColor: colors.border }]}>
            <IconSymbol name="square.and.arrow.up" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  content: { flex: 1, padding: 24, alignItems: "center" },
  passCard: { 
    width: "100%", 
    borderRadius: 32, 
    borderWidth: 2, 
    padding: 24,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  passHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 },
  passBrand: { fontSize: 14, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  qrContainer: {
    width: 220,
    height: 220,
    backgroundColor: "#000",
    borderRadius: 20,
    padding: 10,
    alignSelf: "center",
    overflow: "hidden",
    borderWidth: 1,
  },
  qrGrid: { flex: 1, justifyContent: "center", alignItems: "center", opacity: 1 },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    shadowColor: "#FFD700",
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 5,
  },
  passInfo: { marginTop: 32 },
  infoLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  infoValue: { fontSize: 18, fontWeight: "800" },
  divider: { height: 1, backgroundColor: "#333", marginVertical: 16 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "800" },
  hintText: { marginTop: 24, fontSize: 13, textAlign: "center", lineHeight: 20 },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 40,
  },
  actionBtn: { 
    flex: 1,
    height: 56, 
    borderRadius: 28, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 10 
  },
  shareBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { fontSize: 15, fontWeight: "800", color: "#000" },
});
