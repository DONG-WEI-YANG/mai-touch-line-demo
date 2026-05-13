import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

type WorkOrder = {
  workOrder: {
    id: number;
    title: string;
    description: string | null;
    category: "maintenance" | "security" | "concierge" | "housekeeping" | "laundry" | "vehicle" | "other";
    status: "open" | "in_progress" | "resolved" | "closed";
    priority: "low" | "medium" | "high" | "urgent";
    assignedTo: string | null;
    createdAt: string;
  };
  userName: string | null;
};

type BookingRow = {
  booking: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    guestCount: number;
    status: "confirmed" | "pending" | "cancelled" | "completed";
    notes: string | null;
    createdAt: string;
  };
  amenityName: string | null;
  userName: string | null;
};

export default function LogisticsDashboardScreen() {
  const colors = useColors();
  const { data: workOrders, isLoading, refetch } = trpc.workOrders.listAll.useQuery();
  const { data: bookings, refetch: refetchBookings } = trpc.bookings.listAll.useQuery();

  // Advance a work order's status. The server (workOrders.update) also pushes a
  // "工單 #WO-N 狀態更新:…" message back to the original LINE requester, so the
  // resident sees the change in real time on LINE — that's the demo money shot.
  const updateWO = trpc.workOrders.update.useMutation({
    onSuccess: () => { refetch(); Alert.alert('已更新', '住戶已收到 LINE 通知 📲'); },
    onError: (err) => Alert.alert('更新失敗', err.message),
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchBookings()]);
    setRefreshing(false);
  };

  const priorityColors = {
    low: colors.muted,
    medium: colors.primary,
    high: colors.warning,
    urgent: colors.error,
  };

  // Each LINE intent maps work_orders.category like:
  //   repair    → maintenance
  //   visitor   → concierge   (V- prefix in title)
  //   complaint → other / housekeeping
  // Show a category chip so logistics can scan order types at a glance.
  const categoryLabel: Record<WorkOrder["workOrder"]["category"], string> = {
    maintenance:  "維修",
    security:     "保全",
    concierge:    "禮賓",
    housekeeping: "打掃",
    laundry:      "送洗",
    vehicle:      "車輛接送",
    other:        "其他",
  };
  const ALL_WO_STATUS: WorkOrder["workOrder"]["status"][] = ["open", "in_progress", "resolved", "closed"];
  const woStatusLabel: Record<WorkOrder["workOrder"]["status"], string> = {
    open:        "待處理",
    in_progress: "處理中",
    resolved:    "已完成",
    closed:      "已關閉",
  };
  const woStatusColor: Record<WorkOrder["workOrder"]["status"], string> = {
    open:        colors.warning,
    in_progress: colors.primary,
    resolved:    colors.success,
    closed:      colors.muted,
  };

  const bookingStatusLabel: Record<BookingRow["booking"]["status"], string> = {
    confirmed: "已確認",
    pending:   "待確認",
    cancelled: "已取消",
    completed: "已完成",
  };
  const bookingStatusColor: Record<BookingRow["booking"]["status"], string> = {
    confirmed: colors.success,
    pending:   colors.warning,
    cancelled: colors.muted,
    completed: colors.primary,
  };

  const WorkOrderCard = ({ item }: { item: WorkOrder }) => {
    const wo = item.workOrder;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{wo.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: woStatusColor[wo.status] + '22' }]}>
            <Text style={[styles.statusText, { color: woStatusColor[wo.status] }]}>{woStatusLabel[wo.status]}</Text>
          </View>
        </View>
        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
            <Text style={[styles.chipText, { color: colors.primary }]}>#WO-{wo.id}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.muted + '15', borderColor: colors.muted + '40' }]}>
            <Text style={[styles.chipText, { color: colors.foreground }]}>{categoryLabel[wo.category]}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: priorityColors[wo.priority] + '15', borderColor: priorityColors[wo.priority] + '40' }]}>
            <Text style={[styles.chipText, { color: priorityColors[wo.priority] }]}>{wo.priority.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={[styles.cardDescription, { color: colors.muted }]} numberOfLines={2}>
          {wo.description || "No description provided."}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={[styles.cardMeta, { color: colors.muted }]}>From: {item.userName || 'N/A'}</Text>
          <Text style={[styles.cardMeta, { color: colors.muted }]}>{new Date(wo.createdAt).toLocaleDateString()}</Text>
        </View>
        {wo.assignedTo ? (
          <Text style={[styles.assigneeRow, { color: colors.primary }]} numberOfLines={1}>
            🧑‍🔧 處理人:{wo.assignedTo}
          </Text>
        ) : null}
        {/* Status workflow — tap to advance. workOrders.update also pushes the
            change back to the resident's LINE chat (see workOrders router). */}
        <View style={styles.actionRow}>
          {ALL_WO_STATUS.filter((s) => s !== wo.status).map((s) => (
            <TouchableOpacity
              key={s}
              disabled={updateWO.isPending}
              onPress={() => updateWO.mutate({ id: wo.id, status: s })}
              style={[styles.actionBtn, {
                backgroundColor: woStatusColor[s] + '1A',
                borderColor: woStatusColor[s] + '55',
                opacity: updateWO.isPending ? 0.5 : 1,
              }]}
            >
              <Text style={[styles.actionBtnText, { color: woStatusColor[s] }]}>→ {woStatusLabel[s]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const BookingCard = ({ item }: { item: BookingRow }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
          {item.amenityName ?? `Amenity #${item.booking.id}`}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: bookingStatusColor[item.booking.status] + '20' }]}>
          <Text style={[styles.statusText, { color: bookingStatusColor[item.booking.status] }]}>
            {bookingStatusLabel[item.booking.status]}
          </Text>
        </View>
      </View>
      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
          <Text style={[styles.chipText, { color: colors.primary }]}>#BK-{item.booking.id}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.muted + '15', borderColor: colors.muted + '40' }]}>
          <Text style={[styles.chipText, { color: colors.foreground }]}>
            {item.booking.date} {item.booking.startTime}-{item.booking.endTime}
          </Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.muted + '15', borderColor: colors.muted + '40' }]}>
          <Text style={[styles.chipText, { color: colors.muted }]}>{item.booking.guestCount} 人</Text>
        </View>
      </View>
      {item.booking.notes && (
        <Text style={[styles.cardDescription, { color: colors.muted }]} numberOfLines={2}>{item.booking.notes}</Text>
      )}
      <View style={styles.cardFooter}>
        <Text style={[styles.cardMeta, { color: colors.muted }]}>From: {item.userName ?? 'N/A'}</Text>
        <Text style={[styles.cardMeta, { color: colors.muted }]}>
          {new Date(item.booking.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Logistics Dashboard</Text>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
          {refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : <IconSymbol name="arrow.clockwise" size={20} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      {isLoading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          <Text style={[styles.sectionHeader, { color: colors.muted }]}>設施預約 (BOOKINGS)</Text>
          {(bookings as BookingRow[] | undefined)?.length ? (
            (bookings as BookingRow[]).map(b => <BookingCard key={`b${b.booking.id}`} item={b} />)
          ) : (
            <View style={styles.emptyContainer}><Text style={[styles.emptyText, { color: colors.muted }]}>No bookings.</Text></View>
          )}

          <Text style={[styles.sectionHeader, { color: colors.muted, marginTop: 24 }]}>工單 (WORK ORDERS)</Text>
          {(workOrders as WorkOrder[] | undefined)?.length ? (
            (workOrders as WorkOrder[]).map(w => <WorkOrderCard key={`w${w.workOrder.id}`} item={w} />)
          ) : (
            <View style={styles.emptyContainer}><Text style={[styles.emptyText, { color: colors.muted }]}>No work orders.</Text></View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  assigneeRow: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.25)',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
