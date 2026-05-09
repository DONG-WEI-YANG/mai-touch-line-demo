import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';

export default function AnnouncementsScreen() {
  const colors = useColors();
  const router = useRouter();
  const q = trpc.announcements.list.useQuery();

  return (
    <ScreenContainer edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: colors.surface,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: '700' }}>
            社區公告
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>
            {q.data?.length ?? 0} announcements · 釘選顯示在最上
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {q.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />}
        {q.error && (
          <Text style={{ color: colors.error, padding: 16 }}>{q.error.message}</Text>
        )}
        {!q.isLoading && (q.data?.length ?? 0) === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 80 }}>
            <IconSymbol name="bell" size={48} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 16, marginTop: 12 }}>
              目前沒有公告
            </Text>
          </View>
        )}

        {(q.data ?? []).map((a: any) => (
          <View
            key={a.id}
            style={{
              padding: 16,
              borderRadius: 16,
              borderWidth: 0.5,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              marginBottom: 12,
              borderLeftWidth: a.isPinned ? 4 : 0.5,
              borderLeftColor: a.isPinned ? colors.primary : colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              {a.isPinned && (
                <Text style={{ marginRight: 6 }}>📌</Text>
              )}
              <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '700', flex: 1 }}>
                {a.title}
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
              {new Date(a.postedAt).toLocaleString()}
              {a.audience !== 'all' ? ` · ${a.audience}` : ''}
            </Text>
            <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 21 }}>
              {a.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}
