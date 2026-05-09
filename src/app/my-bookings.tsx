/**
 * My Bookings Screen
 * View and manage amenity reservations
 */
import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { offlineService } from "@/lib/offline";

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

  const { data: bookings = [], isLoading, refetch } = trpc.bookings.myBookings.useQuery();
  const cancelBookingMutation = trpc.bookings.cancel.useMutation();

  const handleCancelBooking = useCallback(async (bookingId: number) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this reservation?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            // Offline-first: if the device is currently offline, queue the
            // cancel and surface a "will sync later" message instead of a
            // hard error. The sync handler in _layout.tsx replays it via
            // trpcProxy when the network comes back.
            if (!offlineService.isDeviceOnline()) {
              await offlineService.queueOperation({
                type: 'cancel_booking',
                data: { id: bookingId },
              });
              Alert.alert("Queued", "You're offline — cancellation will sync when you reconnect");
              return;
            }
            try {
              await cancelBookingMutation.mutateAsync({ id: bookingId });
              refetch();
              Alert.alert("Success", "Booking cancelled successfully");
            } catch (error) {
              // Network errors during a "should-be-online" call still benefit
              // from the queue — they often mean the server blipped or the
              // device's online flag is stale.
              const isNetworkErr = error instanceof TypeError ||
                (error as { message?: string })?.message?.toLowerCase().includes('network');
              if (isNetworkErr) {
                await offlineService.queueOperation({
                  type: 'cancel_booking',
                  data: { id: bookingId },
                });
                Alert.alert("Queued", "Network hiccup — cancellation will retry automatically");
                return;
              }
              Alert.alert("Error", "Failed to cancel booking");
            }
          },
        },
      ]
    );
  }, [cancelBookingMutation, refetch]);

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
            Amenity #{item.amenityId}
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
        {item.status === "confirmed" && (
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.error }]}
            onPress={() => handleCancelBooking(item.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelButtonText, { color: colors.error }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [colors, handleCancelBooking]);

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
      <FlatList
        data={bookings}
        renderItem={renderBooking}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
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
    day: "numeric" 
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
