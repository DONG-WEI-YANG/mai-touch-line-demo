/**
 * Activity Screen
 * Work orders and task tracking
 */
import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { TranslationKey } from "@/lib/i18n";

type TabType = "active" | "completed" | "all";

type WorkOrderType = "maintenance" | "security" | "concierge";
type WorkOrderStatus = "pending" | "in_progress" | "completed";
type Priority = "low" | "medium" | "high" | "urgent";

type WorkOrder = {
  id: string;
  title: string;
  description?: string;
  type: WorkOrderType;
  priority: Priority;
  status: WorkOrderStatus;
  createdAt: number;
  updatedAt: number;
};

const TYPE_ICONS: Record<WorkOrderType, string> = {
  maintenance: "gear",
  security: "exclamationmark.triangle.fill",
  concierge: "star.fill",
};

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  pending: "#D4A843",
  in_progress: "#5B9A6F",
  completed: "#8A8580",
};

const PRIORITY_COLORS = {
  low: "#8A8580",
  medium: "#D4A843",
  high: "#E0B84D",
  urgent: "#C75050",
};

export default function ActivityScreen() {
  const colors = useColors();
  const { state, t } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>("active");

  const workOrders = state.workOrders;
  const isLoading = false;

  const TABS: { id: TabType; label: string }[] = [
    { id: "active", label: t("activity.active") },
    { id: "completed", label: t("activity.completed") },
    { id: "all", label: t("activity.all") },
  ];

  const filteredOrders = workOrders.filter((order) => {
    if (activeTab === "active") {
      return order.status === "pending" || order.status === "in_progress";
    }
    if (activeTab === "completed") {
      return order.status === "completed";
    }
    return true;
  });

  const renderWorkOrder = useCallback(({ item }: { item: WorkOrder }) => {
    const statusColor = STATUS_COLORS[item.status];
    const priorityColor = PRIORITY_COLORS[item.priority];
    
    // Translate status and category
    const statusLabel = t(`activity.status.${item.status}` as TranslationKey);
    const categoryLabel = t(`activity.category.${item.type}` as TranslationKey);

    return (
      <TouchableOpacity
        style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
      >
        {/* Type Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + "20" }]}>
          <IconSymbol name={TYPE_ICONS[item.type] as any} size={24} color={colors.primary} />
        </View>

        <View style={styles.orderContent}>
          {/* Title and Priority */}
          <View style={styles.orderHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.orderTitle, { color: colors.foreground }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.orderCategory, { color: colors.muted }]}>{categoryLabel}</Text>
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: priorityColor + "20" }]}>
              <Text style={[styles.priorityText, { color: priorityColor }]}>
                {item.priority.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Description */}
          {item.description && (
            <Text style={[styles.orderDescription, { color: colors.foreground, opacity: 0.8 }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Status and Time */}
          <View style={styles.orderFooter}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
            <Text style={[styles.timeText, { color: colors.muted }]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [colors, t]);

  return (
    <ScreenContainer edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("activity.title")}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
          {filteredOrders.length} {activeTab} {filteredOrders.length === 1 ? "item" : "items"}
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.id ? colors.primary : colors.muted },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Work Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderWorkOrder}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="checkmark.circle.fill" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {isLoading ? "Loading..." : "No work orders"}
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

function formatTime(date: number | Date): string {
  const now = new Date();
  const diff = now.getTime() - (typeof date === "number" ? date : new Date(date).getTime());
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  orderCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    borderWidth: 0.5,
    marginBottom: 12,
    gap: 14,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  orderContent: {
    flex: 1,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  orderCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "700",
  },
  orderDescription: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 10,
  },
  orderFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  timeText: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});
