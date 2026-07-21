import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, RefreshControl, StyleSheet, Pressable } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard, AdminButton, AdminField } from '@/components/admin/admin-ui';
import { parseError } from '@/lib/error-utils';

interface PackageRecord {
  id: number;
  recipientId: number;
  recipientName: string | null;
  sender: string | null;
  courier: string | null;
  storageLocation: string | null;
  pickupPin: string;
  arrivedAt: string;
  pickedUpAt: string | null;
  pickedUpBy: string | null;
  notes: string | null;
  registeredBy: number | null;
}

interface UserRecord {
  id: number;
  name: string | null;
  role: string;
  unitId: number | null;
}

export default function AdminPackagesPage() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const q = trpc.packages.list.useQuery();
  const users = trpc.admin.users.useQuery();
  
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [showLog, setShowLog] = useState(false);
  const [draft, setDraft] = useState({ userId: 0, courier: '', notes: '' });
  const [userSearch, setUserSearch] = useState('');

  const logMut = trpc.packages.register.useMutation({
    onSuccess: () => {
      utils.packages.list.invalidate();
      setDraft({ userId: 0, courier: '', notes: '' });
      setUserSearch('');
      setShowLog(false);
      Alert.alert('Success', 'Package logged');
    },
    onError: (err) => Alert.alert('Failed', parseError(err)),
  });

  const pickupMut = trpc.packages.markPickedUp.useMutation({
    onSuccess: () => utils.packages.list.invalidate(),
    onError: (err) => Alert.alert('Failed', parseError(err)),
  });

  const deleteMut = trpc.packages.delete.useMutation({
    onSuccess: () => utils.packages.list.invalidate(),
    onError: (err) => Alert.alert('Failed', parseError(err)),
  });

  const userChoices = useMemo(() => {
    const all = (users.data ?? []) as UserRecord[];
    const residents = all.filter(u => u.role === 'resident');
    if (!userSearch.trim()) return residents.slice(0, 5);
    const s = userSearch.toLowerCase();
    return residents.filter(u => 
      (u.name ?? '').toLowerCase().includes(s) || (u.unitId ?? '').toString().includes(s)
    ).slice(0, 5);
  }, [users.data, userSearch]);

  const selectedUser = useMemo(() => 
    (users.data as UserRecord[] | undefined)?.find(u => u.id === draft.userId),
    [users.data, draft.userId]
  );

  const rows = useMemo(() => {
    if (!q.data) return [];
    const all = q.data as PackageRecord[];
    if (filter === 'pending') return all.filter(p => !p.pickedUpAt);
    return all;
  }, [q.data, filter]);

  const submitLog = useCallback(() => {
    if (!draft.userId) { Alert.alert('Validation', 'Pick a resident'); return; }
    if (!draft.courier.trim()) { Alert.alert('Validation', 'Courier name required'); return; }
    logMut.mutate({
      recipientId: draft.userId,
      courier: draft.courier.trim(),
      notes: draft.notes.trim() || undefined,
    });
  }, [draft, logMut]);

  const confirmDelete = useCallback((id: number) => {
    Alert.alert('Delete Record', `Permanently delete package PKG-${id}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate({ id }) },
    ]);
  }, [deleteMut]);

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="包裹管理" 
        subtitle={`${rows.length} packages listed`}
        rightElement={
          <AdminButton 
            title={showLog ? 'Cancel' : '+ Log'} 
            type={showLog ? 'secondary' : 'primary'}
            onPress={() => setShowLog(!showLog)}
            style={{ paddingVertical: 8 }}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.filterRow}>
          {(['pending', 'all'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                { backgroundColor: filter === f ? colors.primary : colors.surface, borderColor: colors.border }
              ]}
            >
              <Text style={[styles.filterChipText, { color: filter === f ? '#000' : colors.foreground }]}>
                {f === 'pending' ? '未領取' : '全部'}
              </Text>
            </Pressable>
          ))}
        </View>

        {showLog && (
          <AdminCard title="Log New Package Arrival" style={styles.composeCard}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>RESIDENT *</Text>
            {selectedUser ? (
              <Pressable
                onPress={() => setDraft({ ...draft, userId: 0 })}
                style={[styles.pickedUser, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
              >
                <Text style={[styles.pickedUserText, { color: colors.foreground }]}>
                  ✓ {selectedUser.name ?? 'Unknown'} (Unit {selectedUser.unitId ?? '?'})
                </Text>
                <Text style={[styles.tapToChange, { color: colors.primary }]}>Change</Text>
              </Pressable>
            ) : (
              <View style={styles.userPicker}>
                <AdminField label="" value={userSearch} onChangeText={setUserSearch} placeholder="Search by name or unit..." />
                <View style={styles.choicesRow}>
                  {userChoices.map(u => (
                    <Pressable
                      key={u.id}
                      onPress={() => setDraft({ ...draft, userId: u.id })}
                      style={[styles.choiceItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                      <Text style={[styles.choiceName, { color: colors.foreground }]}>{u.name ?? '?'}</Text>
                      <Text style={[styles.choiceMeta, { color: colors.muted }]}>Unit {u.unitId ?? '?'}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <AdminField label="Courier / Logistics *" value={draft.courier} onChangeText={(t) => setDraft({ ...draft, courier: t })} placeholder="e.g. SF Express, 黑貓" />
            <AdminField label="Internal Notes" value={draft.notes} onChangeText={(t) => setDraft({ ...draft, notes: t })} multiline placeholder="e.g. 大型包裹, 需冷藏" />

            <AdminButton
              title={logMut.isPending ? 'Logging…' : 'Log Package'}
              onPress={submitLog}
              disabled={logMut.isPending}
            />
          </AdminCard>
        )}

        {q.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
        
        {rows.length === 0 && !q.isLoading && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No packages found.</Text>
          </View>
        )}

        {rows.map((p) => {
          const isPending = !p.pickedUpAt;
          return (
            <AdminCard key={p.id} style={[styles.packageCard, { borderLeftWidth: isPending ? 4 : 0, borderLeftColor: colors.warning }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.courierName, { color: colors.foreground }]}>{p.courier}</Text>
                  <Text style={[styles.packageMeta, { color: colors.muted }]}>
                    #PKG-{p.id} · {p.recipientName ?? `Resident #${p.recipientId}`}
                  </Text>
                </View>
                {isPending && (
                  <View style={[styles.pendingBadge, { backgroundColor: colors.warning + '20' }]}>
                    <Text style={[styles.pendingText, { color: colors.warning }]}>PENDING</Text>
                  </View>
                )}
              </View>

              <View style={styles.timeInfo}>
                <Text style={[styles.timeText, { color: colors.muted }]}>
                  Arrived: {new Date(p.arrivedAt).toLocaleString()}
                </Text>
                {p.pickedUpAt && (
                  <Text style={[styles.timeText, { color: colors.success }]}>
                    ✓ Picked up: {new Date(p.pickedUpAt).toLocaleString()}
                  </Text>
                )}
              </View>

              {p.notes && (
                <Text style={[styles.notesText, { color: colors.muted }]}>Note: {p.notes}</Text>
              )}

              {isPending && (
                <View style={styles.actionRow}>
                  <AdminButton 
                    title={pickupMut.isPending ? "Updating..." : "Confirm Pickup"} 
                    onPress={() => pickupMut.mutate({ id: p.id })}
                    disabled={pickupMut.isPending}
                    style={styles.pickupBtn}
                  />
                  <AdminButton 
                    title="Del" 
                    type="danger" 
                    onPress={() => confirmDelete(p.id)} 
                    style={styles.delBtn}
                  />
                </View>
              )}
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  composeCard: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  pickedUser: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickedUserText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tapToChange: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  userPicker: {
    marginBottom: 8,
  },
  choicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -8,
    marginBottom: 16,
  },
  choiceItem: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: '30%',
    alignItems: 'center',
  },
  choiceName: {
    fontSize: 12,
    fontWeight: '600',
  },
  choiceMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  packageCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  courierName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  packageMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: '800',
  },
  timeInfo: {
    marginTop: 10,
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  actionRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  pickupBtn: {
    flex: 1,
    paddingVertical: 10,
  },
  delBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
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
