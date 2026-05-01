import { View, Text, ScrollView } from 'react-native';
import { trpc } from '@/lib/trpc';

const COLORS = { bg: '#1a1a1a', card: '#252525', accent: '#C9A96E', text: '#fff', muted: '#888' };

export default function HealthPage() {
  const q = trpc.lineAdmin.health.useQuery(undefined, { refetchInterval: 30000 });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
      <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
        Health Metrics (today)
      </Text>

      {q.isLoading && <Text style={{ color: COLORS.muted }}>Loading...</Text>}

      {q.data ? (
        <View style={{ gap: 8 }}>
          <Metric label="Messages today" value={String(q.data.todayCount)} />
          <Metric label="Errors today" value={String(q.data.errorCount)} />
          <Metric label="Error rate" value={(q.data.errorRate * 100).toFixed(2) + '%'} />
          <Metric label="Server uptime" value={formatUptime(q.data.uptimeS)} />
          {/* TODO(v2): openaiTokensToday requires additional log columns */}
          <Metric label="OpenAI tokens (today)" value={String(q.data.openaiTokensToday) + ' (placeholder — v2)'} />
          {/* TODO(v2): avgLatencyMs requires per-request timing columns */}
          <Metric label="Avg latency (ms)" value={String(q.data.avgLatencyMs) + ' (placeholder — v2)'} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ padding: 12, backgroundColor: COLORS.card, borderRadius: 4 }}>
      <Text style={{ color: COLORS.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: 'bold' }}>{value}</Text>
    </View>
  );
}

function formatUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
