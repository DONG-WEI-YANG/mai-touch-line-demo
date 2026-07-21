import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard, AdminButton, AdminField } from '@/components/admin/admin-ui';
import { parseError } from '@/lib/error-utils';

interface UserRecord {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  unitId: number | null;
}

export default function AdminResidentsPage() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const q = trpc.admin.users.useQuery();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', unitId: '' });

  const addMut = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      utils.admin.users.invalidate();
      setDraft({ name: '', email: '', unitId: '' });
      setShowAdd(false);
      Alert.alert('Success', 'Resident added');
    },
    onError: (err) => Alert.alert('Failed', parseError(err)),
  });

  const deleteMut = trpc.admin.deleteUser.useMutation({
    onSuccess: () => utils.admin.users.invalidate(),
    onError: (err) => Alert.alert('Failed', parseError(err)),
  });

  const filtered = useMemo(() => {
    const all = (q.data ?? []) as UserRecord[];
    const residents = all.filter(u => u.role === 'resident');
    if (!search.trim()) return residents;
    const s = search.toLowerCase();
    return residents.filter(u => 
      (u.name ?? '').toLowerCase().includes(s) || 
      (u.email ?? '').toLowerCase().includes(s) ||
      (u.unitId ?? '').toString().includes(s)
    );
  }, [q.data, search]);

  const submitAdd = useCallback(() => {
    if (!draft.name.trim()) { Alert.alert('Name required'); return; }
    addMut.mutate({
      name: draft.name.trim(),
      email: draft.email.trim() || undefined,
      role: 'resident',
      unitId: draft.unitId ? parseInt(draft.unitId, 10) : undefined,
    });
  }, [draft, addMut]);

  const confirmDelete = useCallback((id: number, name: string) => {
    Alert.alert('Delete Resident', `Permanently remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate({ id }) },
    ]);
  }, [deleteMut]);

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="住戶管理" 
        subtitle={`${filtered.length} residents registered`}
        rightElement={
          <AdminButton 
            title={showAdd ? 'Cancel' : '+ Add'} 
            type={showAdd ? 'secondary' : 'primary'}
            onPress={() => setShowAdd(!showAdd)}
            style={{ paddingVertical: 8 }}
          />
        }
      />

      <View style={styles.searchBox}>
        <AdminField 
          label="" 
          value={search} 
          onChangeText={setSearch} 
          placeholder="Search by name, email or unit..." 
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {showAdd && (
          <AdminCard title="Add New Resident" style={styles.composeCard}>
            <AdminField label="Full Name *" value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} placeholder="e.g. John Doe" />
            <AdminField label="Email Address" value={draft.email} onChangeText={(t) => setDraft({ ...draft, email: t })} placeholder="e.g. john@example.com" keyboardType="email-address" />
            <AdminField label="Unit Number" value={draft.unitId} onChangeText={(t) => setDraft({ ...draft, unitId: t })} placeholder="e.g. 1205" keyboardType="number-pad" />

            <AdminButton
              title={addMut.isPending ? 'Adding…' : 'Register Resident'}
              onPress={submitAdd}
              disabled={addMut.isPending}
            />
          </AdminCard>
        )}

        {q.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
        
        {filtered.length === 0 && !q.isLoading && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No residents found.</Text>
          </View>
        )}

        {filtered.map((u) => (
          <AdminCard key={u.id} style={styles.userCard}>
            <View style={styles.cardHeader}>
              <View style={styles.avatarWrap}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {(u.name ?? 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.info}>
                <Text style={[styles.userName, { color: colors.foreground }]}>{u.name ?? '(no name)'}</Text>
                <Text style={[styles.userMeta, { color: colors.muted }]}>
                  #{u.id} · {u.email || 'No Email'}
                </Text>
                {u.unitId && (
                  <View style={[styles.unitBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.unitText, { color: colors.foreground }]}>UNIT {u.unitId}</Text>
                  </View>
                )}
              </View>
              <AdminButton 
                title="Del" 
                type="danger" 
                onPress={() => confirmDelete(u.id, u.name ?? 'this user')} 
                style={styles.delBtn}
              />
            </View>
          </AdminCard>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 0,
  },
  searchBox: {
    paddingHorizontal: 16,
    marginBottom: -16,
  },
  composeCard: {
    marginBottom: 24,
    marginTop: 16,
  },
  userCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    justifyContent: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  info: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  userMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  unitBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  unitText: {
    fontSize: 10,
    fontWeight: '800',
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
