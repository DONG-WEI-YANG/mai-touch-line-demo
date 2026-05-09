import { useState } from 'react';
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
};

type CreateInput = {
  name: string;
  description?: string;
  icon: string;
  category: 'recreation' | 'wellness' | 'entertainment' | 'business' | 'dining' | 'outdoor';
  capacity: number;
  location?: string;
  rules?: string;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
};

const CATEGORIES: CreateInput['category'][] = [
  'recreation', 'wellness', 'entertainment', 'business', 'dining', 'outdoor',
];

const EMPTY_DRAFT: CreateInput = {
  name: '', description: '', icon: 'star', category: 'recreation',
  capacity: 10, location: '', rules: '', openTime: '08:00', closeTime: '22:00',
  slotDurationMinutes: 60,
};

// Tiny helper for the inline numeric input — avoids leaking NaN into the form
// state when the user clears the field mid-typing.
function parseIntSafe(s: string, fallback: number): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function AdminAmenitiesPage() {
  const utils = trpc.useUtils();
  const q = trpc.amenities.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<CreateInput>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string; description: string; capacity: number;
    openTime: string; closeTime: string; isActive: boolean;
  } | null>(null);

  const createMut = trpc.amenities.create.useMutation({
    onSuccess: () => {
      utils.amenities.list.invalidate();
      setDraft(EMPTY_DRAFT);
      setShowCreate(false);
    },
    onError: (err) => Alert.alert('Create failed', err.message),
  });
  const updateMut = trpc.amenities.update.useMutation({
    onSuccess: () => {
      utils.amenities.list.invalidate();
      setEditingId(null);
      setEditDraft(null);
    },
    onError: (err) => Alert.alert('Update failed', err.message),
  });
  const deleteMut = trpc.amenities.delete.useMutation({
    onSuccess: () => utils.amenities.list.invalidate(),
    onError: (err) => Alert.alert('Delete failed', err.message),
  });

  const beginEdit = (a: any) => {
    setEditingId(a.id);
    setEditDraft({
      name: a.name ?? '',
      description: a.description ?? '',
      capacity: a.capacity ?? 1,
      openTime: a.openTime ?? '08:00',
      closeTime: a.closeTime ?? '22:00',
      isActive: a.isActive ?? true,
    });
  };

  const submitCreate = () => {
    if (!draft.name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    createMut.mutate(draft);
  };

  const submitEdit = () => {
    if (editingId == null || !editDraft) return;
    updateMut.mutate({ id: editingId, ...editDraft });
  };

  const confirmDelete = (id: number, name: string) => {
    Alert.alert('Delete amenity', `Permanently delete "${name}"?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate({ id }) },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={COLORS.accent} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold' }}>
            設施管理 (Amenities)
          </Text>
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
            {q.data?.length ?? 0} amenities
          </Text>
        </View>
        <Pressable
          onPress={() => setShowCreate((v) => !v)}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4,
            backgroundColor: showCreate ? COLORS.muted : COLORS.accent,
          }}
        >
          <Text style={{ color: showCreate ? '#fff' : '#1a1a1a', fontWeight: 'bold' }}>
            {showCreate ? 'Cancel' : '+ Add'}
          </Text>
        </Pressable>
      </View>

      {showCreate && (
        <View style={{ padding: 12, marginBottom: 16, backgroundColor: COLORS.cardLight, borderRadius: 6 }}>
          <Text style={{ color: COLORS.accent, fontWeight: 'bold', marginBottom: 8 }}>New Amenity</Text>
          <Field label="Name *" value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} />
          <Field label="Description" value={draft.description ?? ''} onChangeText={(t) => setDraft({ ...draft, description: t })} multiline />
          <Field label="Location" value={draft.location ?? ''} onChangeText={(t) => setDraft({ ...draft, location: t })} />
          <Field label="Rules" value={draft.rules ?? ''} onChangeText={(t) => setDraft({ ...draft, rules: t })} multiline />
          <Field label="Capacity" value={String(draft.capacity)} onChangeText={(t) => setDraft({ ...draft, capacity: parseIntSafe(t, 1) })} keyboardType="number-pad" />

          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Category</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setDraft({ ...draft, category: c })}
                style={{
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
                  backgroundColor: draft.category === c ? COLORS.accent : COLORS.card,
                }}
              >
                <Text style={{ color: draft.category === c ? '#1a1a1a' : '#fff', fontSize: 11 }}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field label="Open" value={draft.openTime} onChangeText={(t) => setDraft({ ...draft, openTime: t })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Close" value={draft.closeTime} onChangeText={(t) => setDraft({ ...draft, closeTime: t })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Slot (min)" value={String(draft.slotDurationMinutes)} onChangeText={(t) => setDraft({ ...draft, slotDurationMinutes: parseIntSafe(t, 60) })} keyboardType="number-pad" />
            </View>
          </View>

          <Pressable
            disabled={createMut.isPending}
            onPress={submitCreate}
            style={{
              marginTop: 8, paddingVertical: 10, borderRadius: 4,
              backgroundColor: COLORS.accent, alignItems: 'center',
              opacity: createMut.isPending ? 0.5 : 1,
            }}
          >
            <Text style={{ color: '#1a1a1a', fontWeight: 'bold' }}>
              {createMut.isPending ? 'Creating…' : 'Create'}
            </Text>
          </Pressable>
        </View>
      )}

      {q.isLoading && <ActivityIndicator color={COLORS.accent} />}
      {q.error && <Text style={{ color: COLORS.error }}>Error: {q.error.message}</Text>}

      {(q.data ?? []).map((a: any) => {
        const isEditing = editingId === a.id;
        return (
          <View key={a.id} style={{ padding: 12, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>{a.name}</Text>
                <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>
                  #{a.id} · {a.category} · capacity {a.capacity} · {a.openTime}-{a.closeTime}
                  {a.isActive === false ? ' · INACTIVE' : ''}
                </Text>
                {a.description && (
                  <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                    {a.description}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  onPress={() => (isEditing ? (setEditingId(null), setEditDraft(null)) : beginEdit(a))}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: isEditing ? COLORS.muted : COLORS.cardLight }}
                >
                  <Text style={{ color: '#fff', fontSize: 11 }}>{isEditing ? 'Close' : 'Edit'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(a.id, a.name)}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: '#5d0a0a' }}
                >
                  <Text style={{ color: '#fff', fontSize: 11 }}>Del</Text>
                </Pressable>
              </View>
            </View>

            {isEditing && editDraft && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.muted + '40' }}>
                <Field label="Name" value={editDraft.name} onChangeText={(t) => setEditDraft({ ...editDraft, name: t })} />
                <Field label="Description" value={editDraft.description} onChangeText={(t) => setEditDraft({ ...editDraft, description: t })} multiline />
                <Field label="Capacity" value={String(editDraft.capacity)} onChangeText={(t) => setEditDraft({ ...editDraft, capacity: parseIntSafe(t, 1) })} keyboardType="number-pad" />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Open" value={editDraft.openTime} onChangeText={(t) => setEditDraft({ ...editDraft, openTime: t })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Close" value={editDraft.closeTime} onChangeText={(t) => setEditDraft({ ...editDraft, closeTime: t })} />
                  </View>
                </View>
                <Pressable
                  onPress={() => setEditDraft({ ...editDraft, isActive: !editDraft.isActive })}
                  style={{
                    paddingVertical: 6, marginBottom: 8, borderRadius: 4,
                    backgroundColor: editDraft.isActive ? COLORS.success + '40' : COLORS.muted,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>
                    isActive: {editDraft.isActive ? 'true ✓' : 'false (tap to enable)'}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={updateMut.isPending}
                  onPress={submitEdit}
                  style={{
                    paddingVertical: 8, borderRadius: 4,
                    backgroundColor: COLORS.accent, alignItems: 'center',
                    opacity: updateMut.isPending ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: '#1a1a1a', fontWeight: 'bold' }}>
                    {updateMut.isPending ? 'Saving…' : 'Save changes'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, multiline, keyboardType }: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor={COLORS.muted}
        style={{
          paddingHorizontal: 8,
          paddingVertical: 6,
          fontSize: 13,
          color: COLORS.text,
          backgroundColor: COLORS.bg,
          borderRadius: 4,
          minHeight: multiline ? 56 : undefined,
          textAlignVertical: multiline ? 'top' : 'auto',
        }}
      />
    </View>
  );
}
