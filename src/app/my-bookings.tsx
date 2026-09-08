/**
 * My Bookings Screen
 * View and manage amenity reservations
 */
import React, { useCallback, useRef, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { offlineService } from "@/lib/offline";
import { invalidateDomainCaches } from "@/lib/mutation-cache";
import { cancelBooking } from "@/lib/booking-cancellation";
import { parseError } from "@/lib/error-utils";
import { useOfflineStatus } from "@/hooks/use-offline-status";

type Booking = {
  id: number;
  amenityId: number;
  date: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  notes?: string;
  status: "confirmed" | "pending" | "cancelled" | "completed";
  createdAt: Date;
};

export default function MyBookingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const cancelling = useRef(false);
  const offline = useOfflineStatus();
  const queuedIds = new Set(offlineService.getOperations()
    .filter((op) => op.type === 'cancel_booking' && op.status !== 'completed')
    .map((op) => (op.data as { id: number }).id));

  const { data: bookings = [], isLoading, error, refetch, isFetching } = trpc.bookings.myBookings.useQuery(undefined, {
    refetchInterval: 10_000, refetchOnWindowFocus: true,
  });
  const amenities = trpc.amenities.list.useQuery();
  const cancelBookingMutation = trpc.bookings.cancel.useMutation({
    onSuccess: () => invalidateDomainCaches("booking", utils),
  });

  const handleCancelBooking = useCallback(async (bookingId: number) => {
    if (cancelling.current) return;
    cancelling.current = true;
    setBusyId(bookingId);
    setNotice('正在送出取消申請…');
    try {
      const result = await cancelBooking(bookingId, {
        isOnline: () => offlineService.isDeviceOnline(),
        cancel: (id) => cancelBookingMutation.mutateAsync({ id }),
        queue: (id) => offlineService.queueOperation({ type: 'cancel_booking', data: { id } }),
      });
      setNotice(result === 'confirmed' ? '預約已取消' : '取消申請已儲存，等待連線同步；預約尚未確認取消。');
      setCancelTarget(null);
    } catch (error) {
      setNotice(`取消未完成：${parseError(error)}。請重試。`);
    } finally {
      cancelling.current = false;
      setBusyId(null);
    }
  }, [cancelBookingMutation]);
  const renderBooking = useCallback(({ item }: { item: Booking }) => {
    const statusColor = item.status === "confirmed" ? colors.success : colors.muted;

    return (
      <View style={[styles.bookingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>

        {/* Booking Info */}
        <View style={styles.bookingInfo}>
          <Text style={[styles.amenityName, { color: colors.foreground }]}>
            {amenities.data?.find((amenity) => amenity.id === item.amenityId)?.name ?? `設施 #${item.amenityId}`}
          </Text>

          <View style={styles.detailRow}>
            <IconSymbol name="calendar" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              {formatDate(item.date)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <IconSymbol name="clock.fill" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              {item.startTime} - {item.endTime}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <IconSymbol name="person.3.fill" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              {item.guestCount} {item.guestCount === 1 ? "guest" : "guests"}
            </Text>
          </View>

          {item.notes && (
            <Text style={[styles.notes, { color: colors.muted }]} numberOfLines={2}>
              Note: {item.notes}
            </Text>
          )}
        </View>

        {/* Actions */}
        {(item.status === "confirmed" || item.status === "pending") && (
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.error }]}
            accessibilityRole="button"
            disabled={busyId !== null || queuedIds.has(item.id)}
            onPress={() => setCancelTarget(item.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelButtonText, { color: colors.error }]}>{queuedIds.has(item.id) ? '取消申請同步中／待重試，請查看同步狀態' : '取消預約'}</Text>
          </TouchableOpacity>
        )}
        {cancelTarget === item.id && <View style={{ marginTop: 12 }}>
          <Text style={{ color: colors.foreground }}>確定取消這筆預約？</Text>
          <TouchableOpacity accessibilityRole="button" disabled={busyId !== null} onPress={() => handleCancelBooking(item.id)} style={styles.cancelButton}>
            <Text style={{ color: colors.error }}>{busyId === item.id ? '送出中…' : '確認取消'}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busyId !== null} onPress={() => setCancelTarget(null)} style={styles.cancelButton}>
            <Text style={{ color: colors.foreground }}>保留預約</Text>
          </TouchableOpacity>
        </View>}
      </View>
    );
  }, [colors, handleCancelBooking, amenities.data, cancelTarget, busyId, queuedIds]);

  return (
    <ScreenContainer edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Bookings</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            {bookings.length} {bookings.length === 1 ? "reservation" : "reservations"}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Bookings List */}
      {!!notice && <Text accessibilityRole="alert" style={{ color: colors.foreground, paddingHorizontal: 16, paddingVertical: 8 }}>{notice}</Text>}
      {!offline.online && <Text style={{ color: colors.muted, paddingHorizontal: 16 }}>目前離線，顯示上次取得的預約。</Text>}
      {error && <View style={{ padding: 16 }}>
        <Text accessibilityRole="alert" style={{ color: colors.error }}>無法取得最新預約：{parseError(error)}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => refetch()} disabled={isFetching}>
          <Text style={{ color: colors.primary }}>重新載入</Text>
        </TouchableOpacity>
      </View>}
      <FlatList
        data={bookings}
        renderItem={renderBooking}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={isFetching && !isLoading}
        onRefresh={() => refetch()}
        ListEmptyComponent={
          error ? null :
          <View style={styles.emptyContainer}>
            <IconSymbol name="calendar" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {isLoading ? "Loading..." : "No bookings yet"}
            </Text>
            <TouchableOpacity
              style={[styles.bookButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/services")}
              activeOpacity={0.7}
            >
              <Text style={styles.bookButtonText}>Book an Amenity</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </ScreenContainer>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: "short", 
    month: "short", 
    day: "numeric",
    timeZone: "UTC",
  };
  return date.toLocaleDateString("en-US", options);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  bookingCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 0.5,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  bookingInfo: {
    gap: 10,
  },
  amenityName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 15,
  },
  notes: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 24,
  },
  bookButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  bookButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
