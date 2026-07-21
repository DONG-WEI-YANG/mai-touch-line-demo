import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, RefreshControl, StyleSheet, Pressable } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard, AdminButton } from '@/components/admin/admin-ui';
import { parseError } from '@/lib/error-utils';

interface WorkOrderRecord {
  id: number;
  userId: number;
  userName?: string;
  title: string | null;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  location?: string;
  createdAt: string;
}

type WOStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
const STATUS_OPTIONS: WOStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export default function AdminWorkOrdersPage() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const q = trpc.workOrders.listAll.useQuery();
  const [filter, setFilter] = useState<WOStatus | 'all'>('open');

  const updateMut = trpc.workOrders.update.useMutation({
    onSuccess: () => utils.workOrders.listAll.invalidate(),
    onError: (err) => Alert.alert('Failed', parseError(err)),
  });

  const deleteMut = trpc.workOrders.delete.useMutation({
    onSuccess: () => utils.workOrders.listAll.invalidate(),
    onError: (err) => Alert.alert('Failed', parseError(err)),
  });

  const rows = useMemo(() => {
    if (!q.data) return [];
    const all = q.data as WorkOrderRecord[];
    if (filter === 'all') return all;
    return all.filter(w => w.status === filter);
  }, [q.data, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    if (!q.data) return c;
    const all = q.data as WorkOrderRecord[];
    c.all = all.length;
    for (const w of all) {
      if (w.status in c) c[w.status]++;
    }
    return c;
  }, [q.data]);

  const getStatusColor = (status: WOStatus) => {
    switch (status) {
      case 'open': return colors.warning;
      case 'in_progress': return '#60a5fa';
      case 'resolved': return colors.success;
      case 'closed': return colors.muted;
      default: return colors.foreground;
    }
  };

  const confirmDelete = useCallback((id: number) => {
    Alert.alert('Delete Work Order', `Permanently delete WO-${id}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate({ id }) },
    ]);
  }, [deleteMut]);

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="工單管理" 
        subtitle="Maintenance and repair requests"
      />

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(['all', ...STATUS_OPTIONS] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                { backgroundColor: filter === f ? colors.primary : colors.surface, borderColor: colors.border }
              ]}
            >
              <Text style={[styles.filterChipText, { color: filter === f ? '#000' : colors.foreground }]}>
                {f.replace('_', ' ').toUpperCase()} ({counts[f]})
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
        
        {rows.length === 0 && !q.isLoading && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No work orders found.</Text>
          </View>
        )}

        {rows.map((w) => {
          const statusColor = getStatusColor(w.status as WOStatus);
          return (
            <AdminCard key={w.id} style={styles.woCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.woTitle, { color: colors.foreground }]}>{w.title}</Text>
                  <Text style={[styles.woMeta, { color: colors.muted }]}>
                    #WO-{w.id} · {w.userName ?? `User #${w.userId}`}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{w.status.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={[styles.description, { color: colors.foreground }]}>{w.description}</Text>
              
              <View style={styles.timeInfo}>
                <Text style={[styles.timeText, { color: colors.muted }]}>
                  Created: {new Date(w.createdAt).toLocaleString()}
                </Text>
                <Text style={[styles.timeText, { color: colors.muted }]}>
                  Location: {w.location || 'Not specified'}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <View style={styles.statusButtons}>
                  {STATUS_OPTIONS.filter(s => s !== w.status).map(s => (
                    <Pressable
                      key={s}
                      onPress={() => updateMut.mutate({ id: w.id, status: s })}
                      disabled={updateMut.isPending}
                      style={[styles.statusBtn, { borderColor: getStatusColor(s) + '40', backgroundColor: getStatusColor(s) + '10' }]}
                    >
                      <Text style={[styles.statusBtnText, { color: getStatusColor(s) }]}>{s.split('_')[0]}</Text>
                    </Pressable>
                  ))}
                </View>
                <AdminButton title="Del" type="danger" onPress={() => confirmDelete(w.id)} style={styles.delBtn} />
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
  woCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  woTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  woMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  timeInfo: {
    gap: 4,
    marginBottom: 16,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBtnText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  delBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
