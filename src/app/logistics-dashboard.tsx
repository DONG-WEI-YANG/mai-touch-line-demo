import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

type WorkOrder = {
  workOrder: {
    id: number;
    title: string;
    description: string | null;
    status: "open" | "in_progress" | "resolved" | "closed";
    priority: "low" | "medium" | "high" | "urgent";
    createdAt: string;
  };
  userName: string | null;
};

export default function LogisticsDashboardScreen() {
  const colors = useColors();
  const { data: workOrders, isLoading, refetch } = trpc.workOrders.listAll.useQuery();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const priorityColors = {
    low: colors.muted,
    medium: colors.primary,
    high: colors.warning,
    urgent: colors.error,
  };

  const WorkOrderCard = ({ item }: { item: WorkOrder }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.workOrder.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: priorityColors[item.workOrder.priority] + '20' }]}>
          <Text style={[styles.statusText, { color: priorityColors[item.workOrder.priority] }]}>{item.workOrder.priority.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={[styles.cardDescription, { color: colors.muted }]} numberOfLines={2}>
        {item.workOrder.description || "No description provided."}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={[styles.cardMeta, { color: colors.muted }]}>From: {item.userName || 'N/A'}</Text>
        <Text style={[styles.cardMeta, { color: colors.muted }]}>{new Date(item.workOrder.createdAt).toLocaleDateString()}</Text>
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
        <FlatList
          data={workOrders}
          renderItem={({ item }) => <WorkOrderCard item={item as WorkOrder} />}
          keyExtractor={(item) => (item as WorkOrder).workOrder.id.toString()}
          contentContainerStyle={styles.content}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>No work orders found.</Text>
            </View>
          }
        />
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
});
