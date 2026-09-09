import React, { memo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Switch } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';

import { Device } from './types';

type DeviceItemProps = {
  device: Device;
  onToggle: (deviceId: number, currentStatus: string) => void;
};

const DeviceItem = memo(({ device, onToggle }: DeviceItemProps) => {
  const colors = useColors();
  const isActive = device.status === "on" || device.status === "active";
  
  return (
    <View style={[styles.deviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: isActive ? colors.primary + "20" : "#333" }]}>
        <IconSymbol 
          name={device.type === "power" ? "bolt.fill" : "lightbulb.fill"} 
          size={20} 
          color={isActive ? colors.primary : colors.muted} 
        />
      </View>
      <View style={styles.info}>
        <Text style={[styles.deviceName, { color: colors.foreground }]}>{device.name}</Text>
        <Text style={[styles.deviceStatus, { color: isActive ? colors.primary : colors.muted }]}>
          {device.status.toUpperCase()}
        </Text>
      </View>
      <Switch
        value={isActive}
        onValueChange={() => onToggle(device.id, device.status)}
        trackColor={{ false: "#333", true: colors.primary }}
      />
    </View>
  );
});

type DeviceListProps = {
  devices: Device[];
  isLoading: boolean;
  onToggle: (deviceId: number, currentStatus: string) => void;
};

export function DeviceList({ devices, isLoading, onToggle }: DeviceListProps) {
  const colors = useColors();

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />;
  }

  if (devices.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.muted }]}>No devices found matching filters</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {devices.map((device) => (
        <DeviceItem key={device.id} device={device} onToggle={onToggle} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 12,
    gap: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "700",
  },
  deviceStatus: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
