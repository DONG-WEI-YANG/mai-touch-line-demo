import { View, Text, ScrollView, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard } from '@/components/admin/admin-ui';

export default function LineHealthPage() {
  const colors = useColors();
  const q = trpc.lineAdmin.health.useQuery();

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="LINE 健康狀態" 
        subtitle="Gateway 性能與流量指標"
      />

      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {q.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
        
        {q.data && (
          <>
            <View style={styles.statsGrid}>
              <AdminCard style={styles.statCard}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>今日訊息量</Text>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{q.data.todayCount}</Text>
              </AdminCard>
              <AdminCard style={styles.statCard}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>系統錯誤率</Text>
                <Text style={[styles.statValue, { color: q.data.errorRate > 0.1 ? colors.error : colors.success }]}>
                  {(q.data.errorRate * 100).toFixed(1)}%
                </Text>
              </AdminCard>
            </View>

            <AdminCard title="系統指標">
              <View style={styles.modelRow}>
                <Text style={[styles.modelName, { color: colors.foreground }]}>運行時間</Text>
                <Text style={[styles.modelCount, { color: colors.muted }]}>{Math.floor(q.data.uptimeS / 3600)}h {Math.floor((q.data.uptimeS % 3600) / 60)}m</Text>
              </View>
              <View style={styles.modelRow}>
                <Text style={[styles.modelName, { color: colors.foreground }]}>平均延遲</Text>
                <Text style={[styles.modelCount, { color: colors.muted }]}>{q.data.avgLatencyMs}ms</Text>
              </View>
              <View style={styles.modelRow}>
                <Text style={[styles.modelName, { color: colors.foreground }]}>今日 Token 消耗</Text>
                <Text style={[styles.modelCount, { color: colors.muted }]}>{q.data.openaiTokensToday}</Text>
              </View>
            </AdminCard>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    width: 80,
  },
  barWrap: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    width: 30,
    textAlign: 'right',
  },
  modelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  modelName: {
    fontSize: 13,
    fontWeight: '600',
  },
  modelCount: {
    fontSize: 12,
  },
});
