import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { trpc } from '@/lib/trpc';

const COLORS = {
  bg: '#1a1a1a',
  card: '#252525',
  cardLight: '#2f2f2f',
  accent: '#C9A96E',
  text: '#fff',
  muted: '#888',
  error: '#ff6b6b',
  success: '#4ade80',
  warning: '#fbbf24',
};

const COURIER_OPTIONS = ['Black Cat', 'FedEx', 'DHL', 'SF Express', 'Amazon', 'Local', 'Other'];

export default function AdminPackagesPage() {
  const utils = trpc.useUtils();
  const list = trpc.packages.list.useQuery();
  const users = trpc.admin.users.useQuery();
  const [showCompose, setShowCompose] = useState(false);
  const [draft, setDraft] = useState({
    recipientId: 0,
    courier: '',
    storageLocation: '',
    sender: '',
    notes: '',
  });
  const [recipientFilter, setRecipientFilter] = useState('');
  const [pickupBy, setPickupBy] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const recipientChoices = useMemo(() => {
    const all = (users.data ?? []) as any[];
    const residents = all.filter((u) => u.role === 'resident');
    if (!recipientFilter.trim()) return residents.slice(0, 10);
    const s = recipientFilter.trim().toLowerCase();
    return residents.filter(
      (u) => (u.name ?? '').toLowerCase().includes(s) || (u.email ?? '').toLowerCase().includes(s),
    ).slice(0, 10);
  }, [users.data, recipientFilter]);

  const pickedRecipient = useMemo(
    () => (users.data as any[] | undefined)?.find((u) => u.id === draft.recipientId),
    [users.data, draft.recipientId],
  );

  const filtered = useMemo(() => {
    if (!list.data) return [];
    if (filter === 'pending') return (list.data as any[]).filter((p) => !p.pickedUpAt);
    return list.data as any[];
  }, [list.data, filter]);

  const registerMut = trpc.packages.register.useMutation({
    onSuccess: (r) => {
      utils.packages.list.invalidate();
      Alert.alert('Registered', `PIN: ${r.pin}\n通知住戶來領取時告知此 PIN`);
      setDraft({ recipientId: 0, courier: '', storageLocation: '', sender: '', notes: '' });
      setRecipientFilter('');
      setShowCompose(false);
    },
    onError: (err) => Alert.alert('Register failed', err.message),
  });
  const markedMut = trpc.packages.markPickedUp.useMutation({
    onSuccess: () => utils.packages.list.invalidate(),
    onError: (err) => Alert.alert('Failed', err.message),
  });
  const delMut = trpc.packages.delete.useMutation({
    onSuccess: () => utils.packages.list.invalidate(),
    onError: (err) => Alert.alert('Delete failed', err.message),
  });

  const submitRegister = () => {
    if (!draft.recipientId) {
      Alert.alert('Validation', 'Pick a recipient first');
      return;
    }
    registerMut.mutate({
      recipientId: draft.recipientId,
      courier: draft.courier || undefined,
      storageLocation: draft.storageLocation || undefined,
      sender: draft.sender || undefined,
      notes: draft.notes || undefined,
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={list.isFetching} onRefresh={() => list.refetch()} tintColor={COLORS.accent} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold' }}>包裹代收 (Packages)</Text>
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
            {filtered.length} of {list.data?.length ?? 0}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowCompose((v) => !v)}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4,
                   backgroundColor: showCompose ? COLORS.muted : COLORS.accent }}
        >
          <Text style={{ color: showCompose ? '#fff' : '#1a1a1a', fontWeight: 'bold' }}>
            {showCompose ? 'Cancel' : '+ Register'}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {(['pending', 'all'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4,
                     backgroundColor: filter === f ? COLORS.accent : COLORS.card }}
          >
            <Text style={{ color: filter === f ? '#1a1a1a' : '#fff', fontSize: 12 }}>
              {f === 'pending' ? '未領取' : '全部'}
            </Text>
          </Pressable>
        ))}
      </View>

      {showCompose && (
        <View style={{ padding: 12, marginBottom: 16, backgroundColor: COLORS.cardLight, borderRadius: 6 }}>
          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Recipient *</Text>
          {pickedRecipient ? (
            <Pressable
              onPress={() => setDraft({ ...draft, recipientId: 0 })}
              style={{ padding: 10, backgroundColor: COLORS.accent + '40', borderRadius: 4, marginBottom: 8 }}
            >
              <Text style={{ color: COLORS.text }}>
                ✓ {pickedRecipient.name ?? '(no name)'} · #{pickedRecipient.id}
              </Text>
              <Text style={{ color: COLORS.muted, fontSize: 11 }}>tap to change</Text>
            </Pressable>
          ) : (
            <>
              <TextInput
                value={recipientFilter}
                onChangeText={setRecipientFilter}
                placeholder="Search resident by name / email"
                placeholderTextColor={COLORS.muted}
                style={{ padding: 8, marginBottom: 6, color: COLORS.text,
                         backgroundColor: COLORS.bg, borderRadius: 4 }}
              />
              {recipientChoices.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => setDraft({ ...draft, recipientId: u.id })}
                  style={{ padding: 8, marginBottom: 4, backgroundColor: COLORS.card, borderRadius: 4 }}
                >
                  <Text style={{ color: COLORS.text, fontSize: 13 }}>
                    {u.name ?? '(no name)'}
                  </Text>
                  <Text style={{ color: COLORS.muted, fontSize: 11 }}>
                    #{u.id} · Unit {u.unitId ?? '-'} · {u.email}
                  </Text>
                </Pressable>
              ))}
            </>
          )}

          <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 8, marginBottom: 4 }}>Courier</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {COURIER_OPTIONS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setDraft({ ...draft, courier: c })}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
                         backgroundColor: draft.courier === c ? COLORS.accent : COLORS.card }}
              >
                <Text style={{ color: draft.courier === c ? '#1a1a1a' : '#fff', fontSize: 11 }}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Sender</Text>
          <TextInput
            value={draft.sender}
            onChangeText={(t) => setDraft({ ...draft, sender: t })}
            placeholder="Optional — sender name / company"
            placeholderTextColor={COLORS.muted}
            style={{ padding: 8, marginBottom: 8, color: COLORS.text,
                     backgroundColor: COLORS.bg, borderRadius: 4 }}
          />

          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Storage location</Text>
          <TextInput
            value={draft.storageLocation}
            onChangeText={(t) => setDraft({ ...draft, storageLocation: t })}
            placeholder="e.g. 前台 B 架 / 冷藏櫃 #3"
            placeholderTextColor={COLORS.muted}
            style={{ padding: 8, marginBottom: 8, color: COLORS.text,
                     backgroundColor: COLORS.bg, borderRadius: 4 }}
          />

          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Notes</Text>
          <TextInput
            value={draft.notes}
            onChangeText={(t) => setDraft({ ...draft, notes: t })}
            placeholder="特殊處理 / 易碎 / 冷藏..."
            placeholderTextColor={COLORS.muted}
            multiline
            style={{ padding: 8, marginBottom: 8, color: COLORS.text,
                     backgroundColor: COLORS.bg, borderRadius: 4, minHeight: 50, textAlignVertical: 'top' }}
          />

          <Pressable
            disabled={registerMut.isPending}
            onPress={submitRegister}
            style={{ paddingVertical: 10, borderRadius: 4, backgroundColor: COLORS.accent,
                     alignItems: 'center', opacity: registerMut.isPending ? 0.5 : 1 }}
          >
            <Text style={{ color: '#1a1a1a', fontWeight: 'bold' }}>
              {registerMut.isPending ? 'Registering…' : 'Register & generate PIN'}
            </Text>
          </Pressable>
        </View>
      )}

      {list.isLoading && <ActivityIndicator color={COLORS.accent} />}
      {list.error && <Text style={{ color: COLORS.error }}>{list.error.message}</Text>}
      {!list.isLoading && filtered.length === 0 && (
        <Text style={{ color: COLORS.muted, textAlign: 'center', marginTop: 32 }}>No packages.</Text>
      )}

      {filtered.map((p: any) => {
        const isPending = !p.pickedUpAt;
        return (
          <View
            key={p.id}
            style={{ padding: 12, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 6,
                     borderLeftWidth: isPending ? 3 : 0,
                     borderLeftColor: isPending ? COLORS.warning : COLORS.muted }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>
                {p.recipientName ?? `User #${p.recipientId}`}
              </Text>
              <Text style={{ color: isPending ? COLORS.warning : COLORS.muted, fontSize: 11, fontWeight: 'bold' }}>
                {isPending ? `PIN: ${p.pickupPin}` : 'COLLECTED'}
              </Text>
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>
              #PKG-{p.id} · {p.courier ?? '?'} · {new Date(p.arrivedAt).toLocaleString()}
            </Text>
            {p.storageLocation && (
              <Text style={{ color: COLORS.muted, fontSize: 11 }}>📦 {p.storageLocation}</Text>
            )}
            {p.sender && (
              <Text style={{ color: COLORS.muted, fontSize: 11 }}>From: {p.sender}</Text>
            )}
            {p.notes && (
              <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
                {p.notes}
              </Text>
            )}
            {p.pickedUpAt && (
              <Text style={{ color: COLORS.success, fontSize: 11, marginTop: 4 }}>
                ✓ Picked up by {p.pickedUpBy} · {new Date(p.pickedUpAt).toLocaleString()}
              </Text>
            )}

            {isPending && (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <TextInput
                  value={pickupBy[p.id] ?? ''}
                  onChangeText={(t) => setPickupBy((prev) => ({ ...prev, [p.id]: t }))}
                  placeholder="Picked up by (name)"
                  placeholderTextColor={COLORS.muted}
                  style={{ flex: 1, padding: 6, color: COLORS.text,
                           backgroundColor: COLORS.bg, borderRadius: 4, fontSize: 12 }}
                />
                <Pressable
                  disabled={markedMut.isPending}
                  onPress={() => {
                    const name = (pickupBy[p.id] ?? '').trim();
                    if (!name) {
                      Alert.alert('Validation', 'Enter the receiver name');
                      return;
                    }
                    markedMut.mutate({ id: p.id, pickedUpBy: name });
                  }}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4,
                           backgroundColor: COLORS.success + '60' }}
                >
                  <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: '600' }}>Mark picked up</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Alert.alert('Delete', `Delete PKG-${p.id}?`, [
                      { text: 'Cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => delMut.mutate({ id: p.id }) },
                    ]);
                  }}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: '#5d0a0a' }}
                >
                  <Text style={{ color: '#fff', fontSize: 11 }}>Del</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
