import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { trpc } from '@/lib/trpc';

const COLORS = {
  bg: '#1a1a1a',
  card: '#252525',
  accent: '#C9A96E',
  text: '#fff',
  muted: '#888',
  error: '#ff6b6b',
};

type Role = 'resident' | 'admin' | 'logistics' | 'housekeeper';
type RoleFilter = Role | 'all';
const ROLE_FILTERS: RoleFilter[] = ['all', 'resident', 'admin', 'logistics', 'housekeeper'];

const ROLE_COLOR: Record<Role, string> = {
  resident: COLORS.accent,
  admin: '#ff6b6b',
  logistics: '#60a5fa',
  housekeeper: '#a78bfa',
};

export default function AdminResidentsPage() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');
  const q = trpc.admin.users.useQuery();

  const filtered = useMemo(() => {
    if (!q.data) return [];
    let rows = q.data as any[];
    if (roleFilter !== 'all') rows = rows.filter((u) => u.role === roleFilter);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      rows = rows.filter(
        (u) =>
          (u.name ?? '').toLowerCase().includes(s) ||
          (u.email ?? '').toLowerCase().includes(s) ||
          String(u.id).includes(s),
      );
    }
    return rows;
  }, [q.data, roleFilter, search]);

  const counts = useMemo(() => {
    const c: Record<RoleFilter, number> = {
      all: 0, resident: 0, admin: 0, logistics: 0, housekeeper: 0,
    };
    if (!q.data) return c;
    c.all = q.data.length;
    for (const u of q.data as any[]) {
      const r = u.role as Role;
      if (r in c) c[r]++;
    }
    return c;
  }, [q.data]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={COLORS.accent} />}
    >
      <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>
        住戶 / 用戶 (Residents)
      </Text>
      <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16 }}>
        Read-only. 角色變更目前需 SQL 直改 (production auth 後加 role mutation)。
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name / email / id"
        placeholderTextColor={COLORS.muted}
        style={{
          padding: 10,
          marginBottom: 12,
          color: COLORS.text,
          backgroundColor: COLORS.card,
          borderRadius: 4,
          fontSize: 13,
        }}
      />

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {ROLE_FILTERS.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRoleFilter(r)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 4,
              backgroundColor: roleFilter === r ? COLORS.accent : COLORS.card,
            }}
          >
            <Text style={{ color: roleFilter === r ? '#1a1a1a' : '#fff', fontSize: 12 }}>
              {r} ({counts[r]})
            </Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading && <ActivityIndicator color={COLORS.accent} />}
      {q.error && <Text style={{ color: COLORS.error }}>Error: {q.error.message}</Text>}
      {!q.isLoading && filtered.length === 0 && (
        <Text style={{ color: COLORS.muted, textAlign: 'center', marginTop: 32 }}>No matching users.</Text>
      )}

      {filtered.map((u: any) => {
        const role = (u.role ?? 'resident') as Role;
        return (
          <View key={u.id} style={{ padding: 12, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>
                {u.name ?? '(no name)'}
              </Text>
              <Text style={{ color: ROLE_COLOR[role] ?? COLORS.muted, fontSize: 11, fontWeight: 'bold' }}>
                {role.toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>
              #{u.id} · {u.email || '(no email)'} · {u.loginMethod || 'unknown auth'}
            </Text>
            <Text style={{ color: COLORS.muted, fontSize: 11 }}>
              Tier: {u.tier ?? '-'} · Unit: {u.unitId ?? '-'} · Last sign-in:{' '}
              {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString() : 'never'}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
