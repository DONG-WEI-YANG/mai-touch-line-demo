import { useState, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, StyleSheet, Pressable } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard, AdminButton, AdminField } from '@/components/admin/admin-ui';
import { parseError } from '@/lib/error-utils';
import { invalidateDomainCaches } from '@/lib/mutation-cache';

type WOStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
const STATUS_OPTIONS: WOStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export default function AdminWorkOrdersPage() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const q = trpc.workOrders.listAll.useQuery();
  const [filter, setFilter] = useState<WOStatus | 'all'>('open');
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [assignment, setAssignment] = useState<{ id: number; assignedTo: string; priority: 'low' | 'medium' | 'high' | 'urgent' } | null>(null);

  const updateMut = trpc.workOrders.update.useMutation({
    onSuccess: () => { setAssignment(null); setNotice('工單已更新'); return invalidateDomainCaches('workOrder', utils); },
    onError: (err) => setNotice(`更新失敗：${parseError(err)}`),
  });

  const deleteMut = trpc.workOrders.delete.useMutation({
    onSuccess: () => { setDeleteTarget(null); setNotice('工單已刪除'); return invalidateDomainCaches('workOrder', utils); },
    onError: (err) => setNotice(`刪除失敗：${parseError(err)}`),
  });

  const rows = useMemo(() => {
    if (!q.data) return [];
    const all = q.data.map(({ workOrder, userName }) => ({ ...workOrder, userName }));
    if (filter === 'all') return all;
    return all.filter(w => w.status === filter);
  }, [q.data, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    if (!q.data) return c;
    const all = q.data.map(({ workOrder, userName }) => ({ ...workOrder, userName }));
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

  const confirmDelete = (id: number) => setDeleteTarget(id);

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="工單管理" 
        subtitle="Maintenance and repair requests"
      />

      {!!notice && <Text accessibilityRole="alert" style={{ color: colors.foreground, padding: 16 }}>{notice}</Text>}
      {deleteTarget !== null && <AdminCard title={`刪除工單 WO-${deleteTarget}？`}>
        <AdminButton title="確認刪除" type="danger" disabled={deleteMut.isPending} onPress={() => deleteMut.mutate({ id: deleteTarget })} />
        <AdminButton title="取消" type="secondary" disabled={deleteMut.isPending} onPress={() => setDeleteTarget(null)} />
      </AdminCard>}

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
              <Text style={{ color: colors.muted, marginBottom: 8 }}>負責人：{w.assignedTo || '尚未指派'} · 優先級：{w.priority}</Text>
              <AdminButton title="指派與優先級" type="secondary" onPress={() => setAssignment({ id: w.id, assignedTo: w.assignedTo ?? '', priority: w.priority as 'low' | 'medium' | 'high' | 'urgent' })} />
              {assignment?.id === w.id && <View style={{ marginVertical: 12 }}>
                <AdminField label="負責人／單位" value={assignment.assignedTo} onChangeText={(assignedTo) => setAssignment({ ...assignment, assignedTo })} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {(['low', 'medium', 'high', 'urgent'] as const).map((priority) => <AdminButton key={priority} title={{ low: '低', medium: '一般', high: '高', urgent: '緊急' }[priority]} type={assignment.priority === priority ? 'primary' : 'secondary'} onPress={() => setAssignment({ ...assignment, priority })} />)}
                </View>
                <AdminButton title="儲存指派" disabled={updateMut.isPending} onPress={() => updateMut.mutate({ ...assignment, assignedTo: assignment.assignedTo.trim() })} />
                <AdminButton title="取消編輯" type="secondary" onPress={() => setAssignment(null)} />
              </View>}
              
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
