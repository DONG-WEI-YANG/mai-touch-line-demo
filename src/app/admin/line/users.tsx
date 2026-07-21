import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard, AdminButton, AdminField } from '@/components/admin/admin-ui';
import { parseError } from '@/lib/error-utils';

interface LineUserRecord {
  id: number;
  channelId: string;
  lineUserId: string;
  appUserId: number | null;
  role: string;
  displayName: string | null;
  pictureUrl: string | null;
  language: string | null;
  isDemo: number;
  createdAt: string;
  updatedAt: string;
  realUserName?: string;
  realUserId?: number;
  realUserRole?: string;
}

export default function LineUsersPage() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const q = trpc.lineAdmin.usersList.useQuery({});
  const [filter, setFilter] = useState('');

  const purgeMut = trpc.lineAdmin.usersPurgeDemo.useMutation({
    onSuccess: (res) => {
      utils.lineAdmin.usersList.invalidate();
      Alert.alert('Purge Complete', `Deleted ${res.deletedCount} demo/inactive user mappings.`);
    },
    onError: (err) => Alert.alert('Purge Failed', parseError(err)),
  });

  const updateRoleMut = trpc.lineAdmin.usersSetRole.useMutation({
    onSuccess: () => utils.lineAdmin.usersList.invalidate(),
    onError: (err) => Alert.alert('Update Failed', parseError(err)),
  });

  const filtered = useMemo(() => {
    const all = (q.data ?? []) as LineUserRecord[];
    if (!filter.trim()) return all;
    const s = filter.toLowerCase();
    return all.filter(u => 
      u.lineUserId.toLowerCase().includes(s) || 
      (u.displayName ?? '').toLowerCase().includes(s) ||
      (u.realUserName ?? '').toLowerCase().includes(s)
    );
  }, [q.data, filter]);

  const handlePurge = useCallback(() => {
    Alert.alert(
      'Purge Demo Users',
      'This will remove all LINE user mappings that are not linked to a real resident or staff account. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Purge Now', style: 'destructive', onPress: () => purgeMut.mutate() },
      ]
    );
  }, [purgeMut]);

  const handleRoleChange = useCallback((lineUserId: string, currentRole: string) => {
    const nextRole = (currentRole === 'admin' ? 'resident' : 'admin') as 'admin' | 'resident' | 'housekeeper';
    updateRoleMut.mutate({ lineUserId, role: nextRole });
  }, [updateRoleMut]);

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="LINE Users" 
        subtitle="Manage LINE-to-System identity mappings"
        rightElement={
          <AdminButton 
            title="Purge Demos" 
            type="danger" 
            onPress={handlePurge}
            style={{ paddingVertical: 8, paddingHorizontal: 12 }}
          />
        }
      />

      <View style={styles.filterBox}>
        <AdminField 
          label="" 
          value={filter} 
          onChangeText={setFilter} 
          placeholder="Filter by name or LINE ID..." 
        />
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {q.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
        
        {filtered.length === 0 && !q.isLoading && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No LINE users found.</Text>
          </View>
        )}

        {filtered.map((user) => (
          <AdminCard key={user.id} style={styles.userCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.avatar, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.avatarText, { color: colors.muted }]}>
                  {(user.displayName ?? 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.displayName, { color: colors.foreground }]}>
                  {user.displayName || 'Unnamed User'}
                </Text>
                <Text style={[styles.lineId, { color: colors.muted }]}>
                  ID: {user.lineUserId.substring(0, 12)}...
                </Text>
              </View>
              <View style={[styles.roleBadge, { backgroundColor: user.role === 'admin' ? colors.primary + '20' : colors.background }]}>
                <Text style={[styles.roleText, { color: user.role === 'admin' ? colors.primary : colors.muted }]}>
                  {user.role.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.mappingBox}>
              <Text style={[styles.mappingLabel, { color: colors.muted }]}>LINKED ACCOUNT:</Text>
              {user.realUserId ? (
                <View style={styles.linkedInfo}>
                  <Text style={[styles.realName, { color: colors.foreground }]}>
                    {user.realUserName}
                  </Text>
                  <Text style={[styles.realMeta, { color: colors.muted }]}>
                    #{user.realUserId} • {user.realUserRole}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.unlinkedText, { color: colors.error }]}>
                  NOT LINKED (DEMO/GUEST)
                </Text>
              )}
            </View>

            <View style={styles.actionRow}>
              <Text style={[styles.metaText, { color: colors.muted }]}>
                Joined: {new Date(user.createdAt).toLocaleDateString()}
              </Text>
              <AdminButton
                title={user.role === 'admin' ? 'Demote' : 'Make Admin'}
                type="secondary"
                onPress={() => handleRoleChange(user.lineUserId, user.role)}
                disabled={updateRoleMut.isPending}
                style={styles.roleBtn}
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
  filterBox: {
    paddingHorizontal: 16,
    marginBottom: -16,
  },
  userCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  info: {
    flex: 1,
  },
  displayName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  lineId: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
  },
  mappingBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 16,
  },
  mappingLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  linkedInfo: {
    gap: 2,
  },
  realName: {
    fontSize: 14,
    fontWeight: '700',
  },
  realMeta: {
    fontSize: 11,
    fontWeight: '600',
  },
  unlinkedText: {
    fontSize: 12,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 12,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '600',
  },
  roleBtn: {
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
