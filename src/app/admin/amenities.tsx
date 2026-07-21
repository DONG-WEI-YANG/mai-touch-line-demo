import { useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { trpc } from '@/lib/trpc';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { AdminHeader, AdminCard, AdminButton, AdminField } from '@/components/admin/admin-ui';

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

function parseIntSafe(s: string, fallback: number): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function AdminAmenitiesPage() {
  const colors = useColors();
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
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="設施管理" 
        subtitle={`${q.data?.length ?? 0} amenities configured`}
        rightElement={
          <AdminButton 
            title={showCreate ? 'Cancel' : '+ Add'} 
            type={showCreate ? 'secondary' : 'primary'}
            onPress={() => setShowCreate(!showCreate)}
            style={{ paddingVertical: 8 }}
          />
        }
      />
      
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {showCreate && (
          <AdminCard title="New Amenity" style={{ marginBottom: 24 }}>
            <AdminField label="Name *" value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} />
            <AdminField label="Description" value={draft.description ?? ''} onChangeText={(t) => setDraft({ ...draft, description: t })} multiline />
            <AdminField label="Location" value={draft.location ?? ''} onChangeText={(t) => setDraft({ ...draft, location: t })} />
            <AdminField label="Rules" value={draft.rules ?? ''} onChangeText={(t) => setDraft({ ...draft, rules: t })} multiline />
            <AdminField label="Capacity" value={String(draft.capacity)} onChangeText={(t) => setDraft({ ...draft, capacity: parseIntSafe(t, 1) })} keyboardType="number-pad" />

            <Text style={[styles.label, { color: colors.muted }]}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setDraft({ ...draft, category: c })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: draft.category === c ? colors.primary : colors.surface,
                      borderColor: draft.category === c ? colors.primary : colors.border,
                    }
                  ]}
                >
                  <Text style={[styles.chipText, { color: draft.category === c ? '#000' : colors.foreground }]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AdminField label="Open" value={draft.openTime} onChangeText={(t) => setDraft({ ...draft, openTime: t })} />
              </View>
              <View style={{ flex: 1 }}>
                <AdminField label="Close" value={draft.closeTime} onChangeText={(t) => setDraft({ ...draft, closeTime: t })} />
              </View>
              <View style={{ flex: 1 }}>
                <AdminField label="Slot (min)" value={String(draft.slotDurationMinutes)} onChangeText={(t) => setDraft({ ...draft, slotDurationMinutes: parseIntSafe(t, 60) })} keyboardType="number-pad" />
              </View>
            </View>

            <AdminButton
              title={createMut.isPending ? 'Creating…' : 'Create'}
              onPress={submitCreate}
              disabled={createMut.isPending}
              style={{ marginTop: 8 }}
            />
          </AdminCard>
        )}

        {q.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
        {q.error && <Text style={{ color: colors.error, textAlign: 'center' }}>Error: {q.error.message}</Text>}

        {(q.data ?? []).map((a: any) => {
          const isEditing = editingId === a.id;
          return (
            <AdminCard key={a.id} style={{ marginBottom: 12 }}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.amenityName, { color: colors.foreground }]}>{a.name}</Text>
                  <Text style={[styles.amenityMeta, { color: colors.muted }]}>
                    #{a.id} · {a.category} · capacity {a.capacity} · {a.openTime}-{a.closeTime}
                    {a.isActive === false ? ' · INACTIVE' : ''}
                  </Text>
                </View>
                <View style={styles.actionButtons}>
                  <AdminButton 
                    title={isEditing ? 'Close' : 'Edit'} 
                    type="secondary" 
                    onPress={() => (isEditing ? (setEditingId(null), setEditDraft(null)) : beginEdit(a))}
                    style={styles.smallButton}
                  />
                  <AdminButton 
                    title="Del" 
                    type="danger" 
                    onPress={() => confirmDelete(a.id, a.name)}
                    style={styles.smallButton}
                  />
                </View>
              </View>

              {a.description && !isEditing && (
                <Text style={[styles.description, { color: colors.muted }]} numberOfLines={2}>
                  {a.description}
                </Text>
              )}

              {isEditing && editDraft && (
                <View style={[styles.editForm, { borderTopColor: colors.border }]}>
                  <AdminField label="Name" value={editDraft.name} onChangeText={(t) => setEditDraft({ ...editDraft, name: t })} />
                  <AdminField label="Description" value={editDraft.description} onChangeText={(t) => setEditDraft({ ...editDraft, description: t })} multiline />
                  <AdminField label="Capacity" value={String(editDraft.capacity)} onChangeText={(t) => setEditDraft({ ...editDraft, capacity: parseIntSafe(t, 1) })} keyboardType="number-pad" />
                  
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <AdminField label="Open" value={editDraft.openTime} onChangeText={(t) => setEditDraft({ ...editDraft, openTime: t })} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AdminField label="Close" value={editDraft.closeTime} onChangeText={(t) => setEditDraft({ ...editDraft, closeTime: t })} />
                    </View>
                  </View>
                  
                  <AdminButton
                    title={`isActive: ${editDraft.isActive ? 'True ✓' : 'False (tap to enable)'}`}
                    type={editDraft.isActive ? 'success' : 'secondary'}
                    onPress={() => setEditDraft({ ...editDraft, isActive: !editDraft.isActive })}
                    style={{ marginBottom: 12 }}
                  />
                  
                  <AdminButton
                    title={updateMut.isPending ? 'Saving…' : 'Save changes'}
                    onPress={submitEdit}
                    disabled={updateMut.isPending}
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
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  amenityName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  amenityMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  description: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  editForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
});
