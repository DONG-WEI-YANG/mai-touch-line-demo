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

type Audience = 'all' | 'resident' | 'staff';
const AUDIENCES: Audience[] = ['all', 'resident', 'staff'];

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: '所有人',
  resident: '住戶',
  staff: '員工',
};

export default function AdminAnnouncementsPage() {
  const utils = trpc.useUtils();
  const q = trpc.announcements.listAll.useQuery();
  const [showCompose, setShowCompose] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', audience: 'all' as Audience, isPinned: false });

  const createMut = trpc.announcements.create.useMutation({
    onSuccess: () => {
      utils.announcements.listAll.invalidate();
      utils.announcements.list.invalidate();
      setDraft({ title: '', body: '', audience: 'all', isPinned: false });
      setShowCompose(false);
    },
    onError: (err) => Alert.alert('Post failed', err.message),
  });
  const updateMut = trpc.announcements.update.useMutation({
    onSuccess: () => {
      utils.announcements.listAll.invalidate();
      utils.announcements.list.invalidate();
    },
    onError: (err) => Alert.alert('Update failed', err.message),
  });
  const deleteMut = trpc.announcements.delete.useMutation({
    onSuccess: () => {
      utils.announcements.listAll.invalidate();
      utils.announcements.list.invalidate();
    },
    onError: (err) => Alert.alert('Delete failed', err.message),
  });

  const submitCreate = () => {
    if (!draft.title.trim() || !draft.body.trim()) {
      Alert.alert('Validation', 'Title and body are required');
      return;
    }
    createMut.mutate(draft);
  };

  const togglePin = (id: number, isPinned: boolean) => {
    updateMut.mutate({ id, isPinned: !isPinned });
  };

  const confirmDelete = (id: number, title: string) => {
    Alert.alert('Delete announcement', `Delete "${title}"?`, [
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
            公告管理 (Announcements)
          </Text>
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
            {q.data?.length ?? 0} total · pinned 顯示在最上
          </Text>
        </View>
        <Pressable
          onPress={() => setShowCompose((v) => !v)}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4,
            backgroundColor: showCompose ? COLORS.muted : COLORS.accent,
          }}
        >
          <Text style={{ color: showCompose ? '#fff' : '#1a1a1a', fontWeight: 'bold' }}>
            {showCompose ? 'Cancel' : '+ Compose'}
          </Text>
        </Pressable>
      </View>

      {showCompose && (
        <View style={{ padding: 12, marginBottom: 16, backgroundColor: COLORS.cardLight, borderRadius: 6 }}>
          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Title *</Text>
          <TextInput
            value={draft.title}
            onChangeText={(t) => setDraft({ ...draft, title: t })}
            placeholderTextColor={COLORS.muted}
            placeholder="e.g. 12/25 大廳清潔施工"
            style={{
              padding: 8, marginBottom: 8, color: COLORS.text,
              backgroundColor: COLORS.bg, borderRadius: 4,
            }}
          />
          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Body *</Text>
          <TextInput
            value={draft.body}
            onChangeText={(t) => setDraft({ ...draft, body: t })}
            multiline
            placeholderTextColor={COLORS.muted}
            placeholder="正文..."
            style={{
              padding: 8, marginBottom: 8, color: COLORS.text,
              backgroundColor: COLORS.bg, borderRadius: 4,
              minHeight: 100, textAlignVertical: 'top',
            }}
          />
          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Audience</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {AUDIENCES.map((a) => (
              <Pressable
                key={a}
                onPress={() => setDraft({ ...draft, audience: a })}
                style={{
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
                  backgroundColor: draft.audience === a ? COLORS.accent : COLORS.card,
                }}
              >
                <Text style={{ color: draft.audience === a ? '#1a1a1a' : '#fff', fontSize: 11 }}>
                  {AUDIENCE_LABEL[a]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setDraft({ ...draft, isPinned: !draft.isPinned })}
            style={{
              paddingVertical: 6, marginBottom: 8, borderRadius: 4,
              backgroundColor: draft.isPinned ? COLORS.accent + '40' : COLORS.muted,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>
              {draft.isPinned ? '📌 Pinned' : 'Pin to top? (off)'}
            </Text>
          </Pressable>
          <Pressable
            disabled={createMut.isPending}
            onPress={submitCreate}
            style={{
              paddingVertical: 10, borderRadius: 4,
              backgroundColor: COLORS.accent, alignItems: 'center',
              opacity: createMut.isPending ? 0.5 : 1,
            }}
          >
            <Text style={{ color: '#1a1a1a', fontWeight: 'bold' }}>
              {createMut.isPending ? 'Posting…' : 'Post announcement'}
            </Text>
          </Pressable>
        </View>
      )}

      {q.isLoading && <ActivityIndicator color={COLORS.accent} />}
      {q.error && <Text style={{ color: COLORS.error }}>Error: {q.error.message}</Text>}
      {!q.isLoading && (q.data?.length ?? 0) === 0 && (
        <Text style={{ color: COLORS.muted, textAlign: 'center', marginTop: 32 }}>
          No announcements yet.
        </Text>
      )}

      {(q.data ?? []).map((a: any) => (
        <View
          key={a.id}
          style={{
            padding: 12, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 6,
            borderLeftWidth: a.isPinned ? 3 : 0, borderLeftColor: COLORS.accent,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ color: COLORS.text, fontWeight: 'bold', flex: 1 }}>
              {a.isPinned ? '📌 ' : ''}{a.title}
            </Text>
            <Text style={{ color: COLORS.muted, fontSize: 10 }}>
              {AUDIENCE_LABEL[a.audience as Audience]}
            </Text>
          </View>
          <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>
            #{a.id} · {new Date(a.postedAt).toLocaleString()}
          </Text>
          <Text style={{ color: COLORS.text, fontSize: 13, marginTop: 8 }}>{a.body}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <Pressable
              onPress={() => togglePin(a.id, a.isPinned)}
              style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: COLORS.cardLight }}
            >
              <Text style={{ color: '#fff', fontSize: 11 }}>{a.isPinned ? 'Unpin' : 'Pin'}</Text>
            </Pressable>
            <Pressable
              onPress={() => confirmDelete(a.id, a.title)}
              style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: '#5d0a0a' }}
            >
              <Text style={{ color: '#fff', fontSize: 11 }}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
