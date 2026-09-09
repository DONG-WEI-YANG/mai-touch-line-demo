import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { 
  DEVICE_TYPE_LABELS, 
  RISK_LEVEL_LABELS, 
  AmenityFilterOption, 
  DeviceTypeOption,
  Amenity,
  PendingBulkAction
} from './types';

type BulkControlPanelProps = {
  amenities: Amenity[];
  availableDeviceTypes: DeviceTypeOption[];
  selectedAmenityId: AmenityFilterOption;
  setSelectedAmenityId: (id: AmenityFilterOption) => void;
  selectedDeviceType: DeviceTypeOption;
  setSelectedDeviceType: (type: DeviceTypeOption) => void;
  targetCount: number;
  isBulkActionDisabled: boolean;
  onBulkControl: (status: "on" | "off") => void;
  bulkErrorText: string;
  bulkResultText: string;
  isPinPanelVisible: boolean;
  pendingBulkAction: PendingBulkAction;
  pinValue: string;
  setPinValue: (v: string) => void;
  pinErrorText: string;
  onPinConfirm: () => void;
  onPinCancel: () => void;
  isPending: boolean;
};

export function BulkControlPanel({
  amenities,
  availableDeviceTypes,
  selectedAmenityId,
  setSelectedAmenityId,
  selectedDeviceType,
  setSelectedDeviceType,
  targetCount,
  isBulkActionDisabled,
  onBulkControl,
  bulkErrorText,
  bulkResultText,
  isPinPanelVisible,
  pendingBulkAction,
  pinValue,
  setPinValue,
  pinErrorText,
  onPinConfirm,
  onPinCancel,
  isPending,
}: BulkControlPanelProps) {
  const colors = useColors();
  
  const amenityOptions = [{ id: "all" as const, name: "All Areas" }, ...amenities];

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>PUBLIC INFRASTRUCTURE</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {amenityOptions.map((amenity) => {
          const isSelected = selectedAmenityId === amenity.id;
          return (
            <TouchableOpacity
              key={amenity.id}
              style={[
                styles.chip,
                {
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? colors.primary + "20" : colors.surface,
                },
              ]}
              onPress={() => setSelectedAmenityId(amenity.id)}
            >
              <Text style={[styles.chipText, { color: isSelected ? colors.primary : colors.muted }]}>
                {amenity.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {availableDeviceTypes.map((type) => {
          const isSelected = selectedDeviceType === type;
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.chip,
                {
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? colors.primary + "20" : colors.surface,
                },
              ]}
              onPress={() => setSelectedDeviceType(type)}
            >
              <Text style={[styles.chipText, { color: isSelected ? colors.primary : colors.muted }]}>
                {DEVICE_TYPE_LABELS[type]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.hintContainer}>
        <Text style={[styles.hintText, { color: colors.muted }]}>
          Target: {targetCount} devices
        </Text>
        <Text style={[styles.hintText, { color: colors.muted }]}>
          Safety rule: 必須同時選擇區域與類型，才可執行批次控制。
        </Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.bulkButton, { backgroundColor: colors.surface, borderColor: colors.border, opacity: isBulkActionDisabled ? 0.5 : 1 }]}
          disabled={isBulkActionDisabled}
          onPress={() => onBulkControl("on")}
        >
          <IconSymbol name="bolt.fill" size={16} color={colors.success} />
          <Text style={[styles.bulkButtonText, { color: colors.foreground }]}>All ON</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.bulkButton, { backgroundColor: colors.surface, borderColor: colors.border, opacity: isBulkActionDisabled ? 0.5 : 1 }]}
          disabled={isBulkActionDisabled}
          onPress={() => onBulkControl("off")}
        >
          <IconSymbol name="bolt.fill" size={16} color={colors.error} />
          <Text style={[styles.bulkButtonText, { color: colors.foreground }]}>All OFF</Text>
        </TouchableOpacity>
      </View>

      {bulkErrorText ? <Text style={[styles.errorText, { color: colors.error }]}>{bulkErrorText}</Text> : null}
      {bulkResultText ? <Text style={[styles.resultText, { color: colors.muted }]}>{bulkResultText}</Text> : null}

      {isPinPanelVisible && pendingBulkAction && (
        <View style={[styles.pinPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.pinTitle, { color: colors.foreground }]}>高風險操作二次驗證</Text>
          <Text style={[styles.pinMeta, { color: colors.muted }]}>
            風險：{RISK_LEVEL_LABELS[pendingBulkAction.riskLevel]}（{pendingBulkAction.requiredPermissionTier}）
          </Text>
          <Text style={[styles.pinMeta, { color: colors.muted }]}>
            原因：{pendingBulkAction.reasonText}
          </Text>
          
          <TextInput
            value={pinValue}
            onChangeText={setPinValue}
            placeholder="輸入管理 PIN"
            placeholderTextColor={colors.muted}
            secureTextEntry
            keyboardType="number-pad"
            style={[styles.pinInput, { borderColor: colors.border, color: colors.foreground }]}
          />
          
          {pinErrorText ? <Text style={[styles.errorText, { color: colors.error }]}>{pinErrorText}</Text> : null}
          
          <View style={styles.pinActionRow}>
            <TouchableOpacity style={[styles.pinBtn, { borderColor: colors.border }]} onPress={onPinCancel} disabled={isPending}>
              <Text style={[styles.pinBtnText, { color: colors.muted }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pinBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "20" }]} onPress={onPinConfirm} disabled={isPending}>
              <Text style={[styles.pinBtnText, { color: colors.primary }]}>
                {isPending ? "驗證中..." : "驗證並執行"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    paddingRight: 4,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  hintContainer: {
    marginVertical: 10,
    gap: 4,
  },
  hintText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  bulkButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bulkButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  resultText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  pinPanel: {
    marginTop: 16,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  pinTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  pinMeta: {
    fontSize: 11,
    fontWeight: "600",
  },
  pinInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "700",
  },
  pinActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  pinBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  pinBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
