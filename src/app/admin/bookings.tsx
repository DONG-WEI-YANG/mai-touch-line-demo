import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { trpc } from '@/lib/trpc';

const COLORS = {
  bg: '#1a1a1a',
  card: '#252525',
  accent: '#C9A96E',
  text: '#fff',
  muted: '#888',
  error: '#ff6b6b',
  success: '#4ade80',
  warning: '#fbbf24',
};

type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';
const STATUS_OPTIONS: BookingStatus[] = ['confirmed', 'pending', 'cancelled', 'completed'];

const STATUS_COLOR: Record<BookingStatus, string> = {
  confirmed: COLORS.success,
  pending: COLORS.warning,
  cancelled: COLORS.muted,
  completed: COLORS.accent,
};

type StatusFilter = BookingStatus | 'all';
const FILTERS: StatusFilter[] = ['all', 'confirmed', 'pending', 'cancelled', 'completed'];

export default function AdminBookingsPage() {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const utils = trpc.useUtils();
  const q = trpc.bookings.listAll.useQuery();

  // Optimistic invalidate so the badge flips immediately after a status change.
  const updateStatus = trpc.bookings.updateStatus.useMutation({
    onSuccess: () => utils.bookings.listAll.invalidate(),
    onError: (err) => Alert.alert('Update failed', err.message),
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
    for (const r of q.data as any[]) c[r.booking.status as BookingStatus]++;
    return c;
  }, [q.data]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={COLORS.accent} />}
    >
      <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>
        預約管理 (Bookings)
      </Text>
      <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16 }}>
        全社區預約一覽 — 點下方狀態切換以變更。
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 4,
              backgroundColor: filter === f ? COLORS.accent : COLORS.card,
            }}
          >
            <Text style={{ color: filter === f ? '#1a1a1a' : '#fff', fontSize: 12 }}>
              {f} ({counts[f]})
            </Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading && <ActivityIndicator color={COLORS.accent} />}
      {q.error && <Text style={{ color: COLORS.error }}>Error: {q.error.message}</Text>}
      {!q.isLoading && rows.length === 0 && (
        <Text style={{ color: COLORS.muted, textAlign: 'center', marginTop: 32 }}>No bookings.</Text>
      )}

      {rows.map((row: any) => {
        const b = row.booking;
        const status = b.status as BookingStatus;
        return (
          <View key={b.id} style={{ padding: 12, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ color: COLORS.text, fontWeight: 'bold', flex: 1 }} numberOfLines={1}>
                {row.amenityName ?? `Amenity #${b.amenityId}`}
              </Text>
              <Text style={{ color: STATUS_COLOR[status], fontSize: 11, fontWeight: 'bold' }}>
                {status.toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>
              #BK-{b.id} · {b.date} {b.startTime}-{b.endTime} · {b.guestCount} 人
            </Text>
            <Text style={{ color: COLORS.muted, fontSize: 11 }}>
              From: {row.userName ?? 'N/A'}
            </Text>
            {b.notes && (
              <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4, fontStyle: 'italic' }} numberOfLines={2}>
                "{b.notes}"
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.filter((s) => s !== status).map((s) => (
                <Pressable
                  key={s}
                  disabled={updateStatus.isPending}
                  onPress={() => updateStatus.mutate({ id: b.id, status: s })}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 4,
                    backgroundColor: STATUS_COLOR[s] + '20',
                    borderWidth: 1,
                    borderColor: STATUS_COLOR[s] + '60',
                    opacity: updateStatus.isPending ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: STATUS_COLOR[s], fontSize: 11, fontWeight: '600' }}>→ {s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
