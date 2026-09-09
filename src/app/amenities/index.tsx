import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';

export default function AmenitiesScreen() {
  const colors = useColors();
  const router = useRouter();
  const query = trpc.amenities.list.useQuery();
  const amenities = query.data?.filter(amenity => amenity.isActive);
  return (
    <ScreenContainer edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/services')}>
          <Text style={{ color: colors.primary, paddingVertical: 12 }}>返回服務</Text>
        </Pressable>
        <Text accessibilityRole="header" style={{ color: colors.foreground, fontSize: 28, fontWeight: '700' }}>公設預約</Text>
        <Text style={{ color: colors.muted }}>選擇公設，查看開放時間並預約時段。</Text>
        {query.isLoading ? <ActivityIndicator accessibilityLabel="讀取公設中" color={colors.primary} />
          : query.isError ? <View style={{ gap: 12 }}>
            <Text style={{ color: colors.error }}>無法讀取公設，請重試。</Text>
            <Pressable accessibilityRole="button" onPress={() => void query.refetch()}><Text style={{ color: colors.primary, paddingVertical: 12 }}>重新讀取</Text></Pressable>
          </View>
          : !amenities?.length ? <Text style={{ color: colors.muted }}>目前沒有開放預約的公設。</Text>
          : amenities.map(amenity => (
            <Pressable key={amenity.id} accessibilityRole="link" accessibilityLabel={`預約${amenity.name}`}
              onPress={() => router.push(`/amenities/${amenity.id}`)}
              style={{ padding: 20, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: '600' }}>{amenity.name}</Text>
              {!!amenity.description && <Text style={{ color: colors.muted }}>{amenity.description}</Text>}
              <Text style={{ color: colors.muted }}>{amenity.openTime}–{amenity.closeTime} · 每時段 {amenity.slotDurationMinutes} 分鐘 · 容量 {amenity.capacity} 人</Text>
              <Text style={{ color: colors.primary }}>查看與預約 →</Text>
            </Pressable>
          ))}
      </ScrollView>
    </ScreenContainer>
  );
}
