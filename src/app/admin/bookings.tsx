import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard } from '@/components/admin/admin-ui';
import { parseError } from '@/lib/error-utils';

type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';
const STATUS_OPTIONS: BookingStatus[] = ['confirmed', 'pending', 'cancelled', 'completed'];

type StatusFilter = BookingStatus | 'all';
const FILTERS: StatusFilter[] = ['all', 'confirmed', 'pending', 'cancelled', 'completed'];

export default function AdminBookingsPage() {
  const colors = useColors();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const utils = trpc.useUtils();
  const q = trpc.bookings.listAll.useQuery();

  const updateStatus = trpc.bookings.updateStatus.useMutation({
    onSuccess: () => utils.bookings.listAll.invalidate(),
    onError: (err) => Alert.alert('Update failed', parseError(err)),
  });

  const rows = useMemo(() => {
    if (!q.data) return [];
    if (filter === 'all') return q.data;
    return q.data.filter((r: any) => r.booking.status === filter);
  }, [q.data, filter]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, confirmed: 0, pending: 0, cancelled: 0, completed: 0 };
    if (!q.data) return c;
    c.all = q.data.length;
    for (const r of q.data as any[]) {
      const status = r.booking.status as StatusFilter;
      if (status in c) c[status]++;
    }
    return c;
  }, [q.data]);

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed': return colors.success;
      case 'pending': return colors.warning;
      case 'cancelled': return colors.muted;
      case 'completed': return colors.primary;
      default: return colors.foreground;
    }
  };

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="預約管理" 
        subtitle="Manage facility bookings building-wide"
      />

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                { backgroundColor: filter === f ? colors.primary : colors.surface, borderColor: colors.border }
              ]}
            >
              <Text style={[styles.filterChipText, { color: filter === f ? '#000' : colors.foreground }]}>
                {f.toUpperCase()} ({counts[f]})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {q.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
        {q.error && <Text style={[styles.errorText, { color: colors.error }]}>Error: {q.error.message}</Text>}
        
        {!q.isLoading && rows.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No bookings found.</Text>
          </View>
        )}

        {rows.map((row: any) => {
          const b = row.booking;
          const status = b.status as BookingStatus;
          const statusColor = getStatusColor(status);
          
          return (
            <AdminCard key={b.id} style={styles.bookingCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.amenityName, { color: colors.foreground }]} numberOfLines={1}>
                    {row.amenityName ?? `Amenity #${b.amenityId}`}
                  </Text>
                  <Text style={[styles.bookingMeta, { color: colors.muted }]}>
                    #BK-{b.id} · {b.date}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                    {status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.timeInfo}>
                <Text style={[styles.timeText, { color: colors.foreground }]}>
                  {b.startTime} - {b.endTime}
                </Text>
                <Text style={[styles.guestCount, { color: colors.muted }]}>
                  {b.guestCount} People
                </Text>
              </View>

              <Text style={[styles.userName, { color: colors.muted }]}>
                Resident: <Text style={{ color: colors.foreground, fontWeight: '600' }}>{row.userName ?? 'N/A'}</Text>
              </Text>

              {b.notes && (
                <View style={[styles.notesBox, { backgroundColor: colors.background }]}>
                  <Text style={[styles.notesText, { color: colors.muted }]}>
                    "{b.notes}"
                  </Text>
                </View>
              )}

              <View style={styles.actionRow}>
                <Text style={[styles.actionLabel, { color: colors.muted }]}>UPDATE STATUS:</Text>
                <View style={styles.actionButtons}>
                  {STATUS_OPTIONS.filter((s) => s !== status).map((s) => (
                    <Pressable
                      key={s}
                      disabled={updateStatus.isPending}
                      onPress={() => updateStatus.mutate({ id: b.id, status: s })}
                      style={[
                        styles.statusBtn, 
                        { borderColor: getStatusColor(s) + '40', backgroundColor: getStatusColor(s) + '10' }
                      ]}
                    >
                      <Text style={[styles.statusBtnText, { color: getStatusColor(s) }]}>
                        {s.substring(0, 4)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </AdminCard>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  filterContainer: {
    marginBottom: 4,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookingCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  amenityName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  bookingMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  guestCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  userName: {
    fontSize: 13,
    marginBottom: 12,
  },
  notesBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  actionRow: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 50,
    alignItems: 'center',
  },
  statusBtnText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
