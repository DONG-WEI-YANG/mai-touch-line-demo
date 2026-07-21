import { useState, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard, AdminField, AdminButton } from '@/components/admin/admin-ui';

interface LogRecord {
  id: number;
  lineUserId: string;
  direction: string;
  messageType: string;
  content: string | null;
  intent: string | null;
  sessionId: string | null;
  createdAt: string;
}

export default function LineLogsPage() {
  const colors = useColors();
  const [filter, setFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const q = trpc.lineAdmin.logsList.useQuery(
    { limit: 100 }, 
    { refetchInterval: autoRefresh ? 5000 : false }
  );

  const filtered = useMemo(() => {
    const all = (q.data?.items ?? []) as LogRecord[];
    if (!filter.trim()) return all;
    const s = filter.toLowerCase();
    return all.filter(l => 
      l.lineUserId.toLowerCase().includes(s) || 
      (l.content ?? '').toLowerCase().includes(s) || 
      (l.intent ?? '').toLowerCase().includes(s)
    );
  }, [q.data, filter]);

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="Live Traffic" 
        subtitle="Real-time inbound/outbound LINE message stream"
        rightElement={
          <AdminButton 
            title={autoRefresh ? 'Live ON' : 'Paused'} 
            type={autoRefresh ? 'success' : 'secondary'}
            onPress={() => setAutoRefresh(!autoRefresh)}
            style={{ paddingVertical: 8, paddingHorizontal: 12 }}
          />
        }
      />

      <View style={styles.filterBox}>
        <AdminField 
          label="" 
          value={filter} 
          onChangeText={setFilter} 
          placeholder="Filter by text or userId..." 
        />
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {q.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
        
        {filtered.length === 0 && !q.isLoading && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No logs found.</Text>
          </View>
        )}

        {filtered.map((log) => (
          <AdminCard key={log.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={[styles.userId, { color: colors.primary }]} numberOfLines={1}>
                {log.lineUserId}
              </Text>
              <Text style={[styles.timestamp, { color: colors.muted }]}>
                {new Date(log.createdAt).toLocaleTimeString()}
              </Text>
            </View>

            <View style={styles.messageRow}>
              <View style={[styles.indicator, { backgroundColor: colors.warning }]} />
              <Text style={[styles.messageText, { color: colors.foreground }]}>{log.content}</Text>
            </View>

            <View style={styles.replyRow}>
              <View style={[styles.indicator, { backgroundColor: colors.success }]} />
              <Text style={[styles.replyText, { color: colors.muted }]}>{log.intent}</Text>
            </View>

            <View style={styles.footerRow}>
              <Text style={[styles.metaText, { color: colors.muted }]}>
                ID: {log.id} • Session: {log.sessionId || 'N/A'}
              </Text>
            </View>
          </AdminCard>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 0,
  },
  filterBox: {
    paddingHorizontal: 16,
    marginBottom: -16,
  },
  logCard: {
    marginBottom: 12,
    padding: 12,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userId: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    flex: 1,
    marginRight: 10,
  },
  timestamp: {
    fontSize: 10,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  replyRow: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  indicator: {
    width: 3,
    borderRadius: 2,
    marginVertical: 2,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  replyText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  footerRow: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  metaText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
