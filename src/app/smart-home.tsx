import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";

export default function SmartHomeScreen() {
  const colors = useColors();
  const { t, state } = useApp();
  const router = useRouter();

  // Real-time IoT data
  const { data: devices = [], isLoading, refetch } = trpc.iot.myDevices.useQuery();
  const updateDeviceMutation = trpc.iot.updateDevice.useMutation();

  const handleToggle = async (deviceId: number, currentStatus: string) => {
    const nextStatus = currentStatus === "on" ? "off" : "on";
    try {
      await updateDeviceMutation.mutateAsync({ deviceId, status: nextStatus });
      refetch();
    } catch (e) {
      console.error("Failed to update device", e);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "light": return "sun.max.fill";
      case "climate": return "thermometer.medium";
      case "curtain": return "curtains";
      case "security": return "lock.fill";
      default: return "gear";
    }
  };

  const DeviceCard = ({ device }: { device: any }) => (
    <View style={[styles.deviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: device.status === "on" ? colors.primary + "30" : "#333" }]}>
        <IconSymbol 
          name={getDeviceIcon(device.type) as any} 
          size={24} 
          color={device.status === "on" ? colors.primary : colors.muted} 
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.deviceName, { color: colors.foreground }]}>{device.name}</Text>
        <Text style={[styles.deviceStatus, { color: device.status === "on" ? colors.primary : colors.muted }]}>
          {device.status === "on" ? t("smarthome.status.on") : t("smarthome.status.off")}
        </Text>
      </View>
      <Switch
        value={device.status === "on"}
        onValueChange={() => handleToggle(device.id, device.status)}
        trackColor={{ false: "#333", true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <ScreenContainer edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("smarthome.title")}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>{state.profile.unit}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t("smarthome.devices")}</Text>
        
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : devices.length === 0 ? (
          <View style={styles.emptyBox}>
            <IconSymbol name="info.circle.fill" size={40} color={colors.border} />
            <Text style={{ color: colors.muted, marginTop: 12 }}>No devices configured for this unit.</Text>
          </View>
        ) : (
          <View style={styles.deviceList}>
            {devices.map((device: any) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </View>
        )}

        {/* Climate Summary */}
        <View style={[styles.climateBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary }]}>
          <IconSymbol name="thermometer.sun.fill" size={32} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.climateLabel, { color: colors.foreground }]}>{t("smarthome.climate")}</Text>
            <Text style={[styles.climateValue, { color: colors.primary }]}>22.5°C • Perfect Ambiance</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  headerSubtitle: { fontSize: 13, fontWeight: "600" },
  content: { padding: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 16 },
  deviceList: { gap: 12 },
  deviceCard: { 
    flexDirection: "row", 
    alignItems: "center", 
    padding: 16, 
    borderRadius: 20, 
    borderWidth: 1.5,
    gap: 16
  },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  deviceName: { fontSize: 16, fontWeight: "700" },
  deviceStatus: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  climateBox: { 
    marginTop: 32, 
    padding: 24, 
    borderRadius: 24, 
    borderWidth: 1, 
    flexDirection: "row", 
    alignItems: "center" 
  },
  climateLabel: { fontSize: 14, fontWeight: "600" },
  climateValue: { fontSize: 18, fontWeight: "800", marginTop: 4 },
  emptyBox: { alignItems: 'center', marginTop: 60, opacity: 0.5 },
});
