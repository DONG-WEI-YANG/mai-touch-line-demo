import { useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';

export default function ParkingScreen() {
  const colors = useColors();
  const router = useRouter();
  const utils = trpc.useUtils();
  const my = trpc.parking.myAssignments.useQuery();
  const [showVisitor, setShowVisitor] = useState(false);
  const [draft, setDraft] = useState({ plate: '', driver: '' });

  const requestVisitor = trpc.parking.requestVisitor.useMutation({
    onSuccess: (r) => {
      utils.parking.myAssignments.invalidate();
      Alert.alert('車位已分配', `車位:${r.spotLabel}\n請告知您的訪客`);
      setDraft({ plate: '', driver: '' });
      setShowVisitor(false);
    },
    onError: (err) => Alert.alert('Request failed', err.message),
  });
  const release = trpc.parking.release.useMutation({
    onSuccess: () => utils.parking.myAssignments.invalidate(),
    onError: (err) => Alert.alert('Release failed', err.message),
  });

  return (
    <ScreenContainer edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface,
                   alignItems: 'center', justifyContent: 'center' }}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: '700' }}>停車</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>
            您的車位 + 訪客請求
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={my.isFetching} onRefresh={() => my.refetch()} tintColor={colors.primary} />}
      >
        {my.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />}

        {(my.data ?? []).length > 0 && (
          <>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 }}>
              當前 ACTIVE
            </Text>
            {(my.data ?? []).map((a: any) => (
              <View
                key={a.id}
                style={{
                  padding: 16, borderRadius: 16, borderWidth: 0.5,
                  borderColor: colors.border,
                  backgroundColor: colors.surface, marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700' }}>
                    {a.spotLabel}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{a.spotType}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
                  🚗 {a.vehiclePlate}
                </Text>
                {a.driverName && (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{a.driverName}</Text>
                )}
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                  Started: {new Date(a.startAt).toLocaleString()}
                </Text>
                {a.purpose === 'visitor' && (
                  <TouchableOpacity
                    onPress={() => Alert.alert('Release', `End assignment for ${a.spotLabel}?`, [
                      { text: 'Cancel' },
                      { text: 'Release', style: 'destructive',
                        onPress: () => release.mutate({ assignmentId: a.id }) },
                    ])}
                    style={{
                      marginTop: 12, paddingVertical: 8, borderRadius: 8,
                      borderWidth: 1, borderColor: colors.error,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.error, fontSize: 13, fontWeight: '600' }}>
                      Release spot
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        {!my.isLoading && (my.data ?? []).length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <IconSymbol name="car" size={48} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>
              您目前沒有使用中的車位
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => setShowVisitor((v) => !v)}
          style={{
            marginTop: 16,
            paddingVertical: 12, borderRadius: 12,
            backgroundColor: showVisitor ? colors.muted : colors.primary,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: showVisitor ? '#fff' : colors.background, fontWeight: '700' }}>
            {showVisitor ? 'Cancel' : '+ 訪客車位請求'}
          </Text>
        </Pressable>

        {showVisitor && (
          <View style={{
            marginTop: 12, padding: 16, borderRadius: 12,
            backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border,
          }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>車牌 *</Text>
            <TextInput
              value={draft.plate}
              onChangeText={(t) => setDraft({ ...draft, plate: t })}
              placeholder="ABC-1234"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              style={{
                padding: 10, marginBottom: 10, color: colors.foreground,
                backgroundColor: colors.background, borderRadius: 8,
              }}
            />
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>司機 / 訪客姓名</Text>
            <TextInput
              value={draft.driver}
              onChangeText={(t) => setDraft({ ...draft, driver: t })}
              placeholder="(選填)"
              placeholderTextColor={colors.muted}
              style={{
                padding: 10, marginBottom: 12, color: colors.foreground,
                backgroundColor: colors.background, borderRadius: 8,
              }}
            />
            <Pressable
              disabled={requestVisitor.isPending}
              onPress={() => {
                if (!draft.plate.trim()) { Alert.alert('Validation', '請輸入車牌'); return; }
                requestVisitor.mutate({
                  vehiclePlate: draft.plate.trim(),
                  driverName: draft.driver || undefined,
                });
              }}
              style={{
                paddingVertical: 12, borderRadius: 8,
                backgroundColor: colors.primary, alignItems: 'center',
                opacity: requestVisitor.isPending ? 0.5 : 1,
              }}
            >
              <Text style={{ color: colors.background, fontWeight: '700' }}>
                {requestVisitor.isPending ? '請求中…' : '送出請求'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
