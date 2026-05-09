import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
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
  info: '#60a5fa',
};

type WOStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type Priority = 'low' | 'medium' | 'high' | 'urgent';

const STATUS_OPTIONS: WOStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

const STATUS_COLOR: Record<WOStatus, string> = {
  open: COLORS.warning,
  in_progress: COLORS.info,
  resolved: COLORS.success,
  closed: COLORS.muted,
};
const PRIORITY_COLOR: Record<Priority, string> = {
  low: COLORS.muted,
  medium: COLORS.accent,
  high: COLORS.warning,
  urgent: COLORS.error,
};

type StatusFilter = WOStatus | 'all';
const FILTERS: StatusFilter[] = ['all', 'open', 'in_progress', 'resolved', 'closed'];

export default function AdminWorkOrdersPage() {
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [assignDraft, setAssignDraft] = useState<Record<number, string>>({});
  const utils = trpc.useUtils();
  const q = trpc.workOrders.listAll.useQuery();

  const updateOrder = trpc.workOrders.update.useMutation({
    onSuccess: () => {
      utils.workOrders.listAll.invalidate();
    },
    onError: (err) => Alert.alert('Update failed', err.message),
  });

  const rows = useMemo(() => {
    if (!q.data) return [];
    if (filter === 'all') return q.data;
    return q.data.filter((r: any) => r.workOrder.status === filter);
  }, [q.data, filter]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    if (!q.data) return c;
    c.all = q.data.length;
    for (const r of q.data as any[]) c[r.workOrder.status as WOStatus]++;
    return c;
  }, [q.data]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={COLORS.accent} />}
    >
      <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>
        工單管理 (Work Orders)
      </Text>
      <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16 }}>
        Default filter: open(待處理)。
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
        <Text style={{ color: COLORS.muted, textAlign: 'center', marginTop: 32 }}>No work orders.</Text>
      )}

      {rows.map((row: any) => {
        const w = row.workOrder;
        const status = w.status as WOStatus;
        const priority = w.priority as Priority;
        const id = w.id as number;
        return (
          <View key={id} style={{ padding: 12, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ color: COLORS.text, fontWeight: 'bold', flex: 1, marginRight: 8 }} numberOfLines={1}>
                {w.title}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Text style={{ color: PRIORITY_COLOR[priority], fontSize: 10, fontWeight: 'bold' }}>
                  {priority.toUpperCase()}
                </Text>
                <Text style={{ color: STATUS_COLOR[status], fontSize: 10, fontWeight: 'bold' }}>
                  {status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>
              #WO-{id} · {w.category} · From: {row.userName ?? 'N/A'}
            </Text>
            {w.description && (
              <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }} numberOfLines={3}>
                {w.description}
              </Text>
            )}

            {/* Assignment input — staff types a name and presses Save. The endpoint
                accepts a free-text assignedTo so we don't gate on a user lookup. */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' }}>
              <TextInput
                value={assignDraft[id] ?? (w.assignedTo as string | null) ?? ''}
                onChangeText={(t) => setAssignDraft((prev) => ({ ...prev, [id]: t }))}
                placeholder="Assign to (housekeeper name)"
                placeholderTextColor={COLORS.muted}
                style={{
                  flex: 1,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  fontSize: 12,
                  color: COLORS.text,
                  borderWidth: 1,
                  borderColor: COLORS.muted,
                  borderRadius: 4,
                }}
              />
              <Pressable
                disabled={updateOrder.isPending}
                onPress={() => updateOrder.mutate({ id, assignedTo: assignDraft[id] ?? '' })}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 4,
                  backgroundColor: COLORS.accent,
                  opacity: updateOrder.isPending ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#1a1a1a', fontSize: 11, fontWeight: '600' }}>Save</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.filter((s) => s !== status).map((s) => (
                <Pressable
                  key={s}
                  disabled={updateOrder.isPending}
                  onPress={() => updateOrder.mutate({ id, status: s })}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 4,
                    backgroundColor: STATUS_COLOR[s] + '20',
                    borderWidth: 1,
                    borderColor: STATUS_COLOR[s] + '60',
                    opacity: updateOrder.isPending ? 0.5 : 1,
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
