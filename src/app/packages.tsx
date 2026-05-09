import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';

export default function PackagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const pending = trpc.packages.myPending.useQuery();
  const all = trpc.packages.myAll.useQuery();

  return (
    <ScreenContainer edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface,
                   alignItems: 'center', justifyContent: 'center' }}
        >
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: '700' }}>包裹</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>
            {pending.data?.length ?? 0} 待領取 · 領取時請出示 PIN
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={pending.isFetching || all.isFetching}
            onRefresh={() => { pending.refetch(); all.refetch(); }}
            tintColor={colors.primary}
          />
        }
      >
        {pending.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />}

        {(pending.data?.length ?? 0) > 0 && (
          <>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 }}>
              待領取 PENDING
            </Text>
            {(pending.data ?? []).map((p: any) => (
              <View
                key={p.id}
                style={{
                  padding: 16, borderRadius: 16, borderWidth: 0.5,
                  borderColor: colors.warning + '60',
                  backgroundColor: colors.surface, marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700' }}>
                    {p.courier ?? 'Package'} · #PKG-{p.id}
                  </Text>
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 4,
                    borderRadius: 8, backgroundColor: colors.warning + '20',
                  }}>
                    <Text style={{ color: colors.warning, fontWeight: 'bold', fontFamily: 'monospace' }}>
                      PIN {p.pickupPin}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                  📍 {p.storageLocation ?? '前台'}
                </Text>
                {p.sender && (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>From: {p.sender}</Text>
                )}
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Arrived: {new Date(p.arrivedAt).toLocaleString()}
                </Text>
                {p.notes && (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>
                    {p.notes}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        {!pending.isLoading && (pending.data?.length ?? 0) === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <IconSymbol name="checkmark.circle.fill" size={48} color={colors.success} />
            <Text style={{ color: colors.muted, fontSize: 16, marginTop: 12 }}>
              沒有待領取的包裹
            </Text>
          </View>
        )}

        {(all.data ?? []).filter((p: any) => p.pickedUpAt).length > 0 && (
          <>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 24, marginBottom: 8 }}>
              歷史 HISTORY
            </Text>
            {(all.data ?? []).filter((p: any) => p.pickedUpAt).map((p: any) => (
              <View
                key={p.id}
                style={{
                  padding: 12, borderRadius: 12, borderWidth: 0.5,
                  borderColor: colors.border,
                  backgroundColor: colors.surface, marginBottom: 8, opacity: 0.7,
                }}
              >
                <Text style={{ color: colors.foreground, fontSize: 14 }}>
                  {p.courier ?? 'Package'} · #PKG-{p.id}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                  ✓ {new Date(p.pickedUpAt).toLocaleDateString()} by {p.pickedUpBy}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
