import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { trpc } from '@/lib/trpc';

const COLORS = { bg: '#1a1a1a', card: '#252525', accent: '#C9A96E', text: '#fff', muted: '#888', error: '#ff6b6b' };

type UserRole = 'resident' | 'housekeeper' | 'admin';
const ROLES: UserRole[] = ['resident', 'housekeeper', 'admin'];

export default function UsersPage() {
  const [filterRole, setFilterRole] = useState<UserRole | undefined>(undefined);
  const utils = trpc.useUtils();
  const q = trpc.lineAdmin.usersList.useQuery(filterRole ? { role: filterRole } : {});
  const setRole = trpc.lineAdmin.usersSetRole.useMutation({
    onSuccess: () => utils.lineAdmin.usersList.invalidate(),
    onError: (err) => Alert.alert('Error', err.message),
  });
  const purge = trpc.lineAdmin.usersPurgeDemo.useMutation({
    onSuccess: (r) => {
      Alert.alert('Done', `Deleted ${r.deleted} demo users`);
      utils.lineAdmin.usersList.invalidate();
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
      <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
        LINE Users
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([undefined, ...ROLES] as Array<UserRole | undefined>).map((r, i) => (
          <Pressable
            key={i}
            onPress={() => setFilterRole(r)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 4,
              backgroundColor: filterRole === r ? COLORS.accent : COLORS.muted,
            }}
          >
            <Text style={{ color: filterRole === r ? '#1a1a1a' : '#fff' }}>{r ?? 'all'}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() =>
            Alert.alert('Confirm', 'Delete all demo users?', [
              { text: 'Cancel' },
              { text: 'Delete', onPress: () => purge.mutate(), style: 'destructive' },
            ])
          }
          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, backgroundColor: '#5d0a0a' }}
        >
          <Text style={{ color: '#fff' }}>Purge demo users</Text>
        </Pressable>
      </View>

      {q.isLoading && <Text style={{ color: COLORS.muted }}>Loading...</Text>}
      {q.error && <Text style={{ color: COLORS.error }}>Error: {q.error.message}</Text>}

      {q.data?.map((u: {
        id: number;
        lineUserId: string;
        displayName: string | null;
        language: string | null;
        role: string;
        isDemo: number;
      }) => (
        <View key={u.id} style={{ padding: 12, marginBottom: 4, backgroundColor: COLORS.card, borderRadius: 4 }}>
          <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>
            {u.displayName ?? '(no name)'} {u.isDemo ? '🧪' : ''}
          </Text>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>
            {u.lineUserId} | lang={u.language} | role={u.role}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            {ROLES.filter((r) => r !== u.role).map((r) => (
              <Pressable
                key={r}
                onPress={() => setRole.mutate({ lineUserId: u.lineUserId, role: r })}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: COLORS.muted }}
              >
                <Text style={{ color: '#fff', fontSize: 11 }}>-&gt; {r}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
