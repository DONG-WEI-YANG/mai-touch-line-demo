import { useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { trpc } from '@/lib/trpc';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { AdminHeader, AdminCard, AdminButton, AdminField } from '@/components/admin/admin-ui';

type Audience = 'all' | 'resident' | 'staff';
const AUDIENCES: Audience[] = ['all', 'resident', 'staff'];

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: '所有人',
  resident: '住戶',
  staff: '員工',
};

export default function AdminAnnouncementsPage() {
  const colors = useColors();
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
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="公告管理" 
        subtitle={`${q.data?.length ?? 0} notices · pinned items appear first`}
        rightElement={
          <AdminButton 
            title={showCompose ? 'Cancel' : '+ Compose'} 
            type={showCompose ? 'secondary' : 'primary'}
            onPress={() => setShowCompose(!showCompose)}
            style={{ paddingVertical: 8 }}
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {showCompose && (
          <AdminCard title="New Announcement" style={{ marginBottom: 24 }}>
            <AdminField label="Title *" value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} placeholder="e.g. 12/25 大廳清潔施工" />
            <AdminField label="Body *" value={draft.body} onChangeText={(t) => setDraft({ ...draft, body: t })} multiline placeholder="正文..." />
            
            <Text style={[styles.label, { color: colors.muted }]}>Audience</Text>
            <View style={styles.audienceRow}>
              {AUDIENCES.map((a) => (
                <Pressable
                  key={a}
                  onPress={() => setDraft({ ...draft, audience: a })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: draft.audience === a ? colors.primary : colors.surface,
                      borderColor: draft.audience === a ? colors.primary : colors.border,
                    }
                  ]}
                >
                  <Text style={[styles.chipText, { color: draft.audience === a ? '#000' : colors.foreground }]}>
                    {AUDIENCE_LABEL[a]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <AdminButton
              title={draft.isPinned ? '📌 Pinned' : 'Pin to top? (off)'}
              type={draft.isPinned ? 'success' : 'secondary'}
              onPress={() => setDraft({ ...draft, isPinned: !draft.isPinned })}
              style={{ marginBottom: 12 }}
            />

            <AdminButton
              title={createMut.isPending ? 'Posting…' : 'Post announcement'}
              onPress={submitCreate}
              disabled={createMut.isPending}
            />
          </AdminCard>
        )}

        {q.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
        {q.error && <Text style={{ color: colors.error, textAlign: 'center' }}>Error: {q.error.message}</Text>}
        {!q.isLoading && (q.data?.length ?? 0) === 0 && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 32 }}>
            No announcements yet.
          </Text>
        )}

        {(q.data ?? []).map((a: any) => (
          <AdminCard 
            key={a.id} 
            style={[
              styles.announcementCard as any, 
              { borderLeftWidth: a.isPinned ? 4 : 0, borderLeftColor: colors.primary }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  {a.isPinned ? '📌 ' : ''}{a.title}
                </Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  #{a.id} · {new Date(a.postedAt).toLocaleString()} · {AUDIENCE_LABEL[a.audience as Audience]}
                </Text>
              </View>
            </View>
            
            <Text style={[styles.body, { color: colors.foreground }]}>{a.body}</Text>
            
            <View style={styles.actionRow}>
              <AdminButton 
                title={a.isPinned ? 'Unpin' : 'Pin'} 
                type="secondary" 
                onPress={() => togglePin(a.id, a.isPinned)}
                style={styles.smallButton}
              />
              <AdminButton 
                title="Delete" 
                type="danger" 
                onPress={() => confirmDelete(a.id, a.title)}
                style={styles.smallButton}
              />
            </View>
          </AdminCard>
        ))}
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
  audienceRow: {
    flexDirection: 'row',
    gap: 8,
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
  announcementCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  meta: {
    fontSize: 11,
    marginTop: 4,
  },
  body: {
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
});
