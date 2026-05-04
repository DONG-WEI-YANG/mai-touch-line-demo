import { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { trpc } from '@/lib/trpc';

const COLORS = { bg: '#1a1a1a', card: '#252525', accent: '#C9A96E', text: '#fff', muted: '#888', error: '#ff6b6b' };

type Direction = 'inbound' | 'outbound' | 'outbound:debug';

const VALID_DIRECTIONS: Direction[] = ['inbound', 'outbound', 'outbound:debug'];

function toDirection(s: string): Direction | undefined {
  return VALID_DIRECTIONS.includes(s as Direction) ? (s as Direction) : undefined;
}

export default function LogsPage() {
  const [intent, setIntent] = useState('');
  const [direction, setDirection] = useState('');
  const [lineUserId, setLineUserId] = useState('');

  const q = trpc.lineAdmin.logsList.useQuery(
    {
      limit: 100,
      ...(intent ? { intent } : {}),
      ...(toDirection(direction) ? { direction: toDirection(direction) } : {}),
      ...(lineUserId ? { lineUserId } : {}),
    },
    { refetchInterval: 30000 }
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
      <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
        LINE Message Log
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <FilterInput placeholder="intent" value={intent} onChange={setIntent} />
        <FilterInput placeholder="direction" value={direction} onChange={setDirection} />
        <FilterInput placeholder="lineUserId" value={lineUserId} onChange={setLineUserId} />
      </View>

      {q.isLoading && <Text style={{ color: COLORS.muted }}>Loading...</Text>}
      {q.error && <Text style={{ color: COLORS.error }}>Error: {q.error.message}</Text>}

      {q.data?.items.map((row) => (
        <View key={row.id} style={{ padding: 12, marginBottom: 4, backgroundColor: COLORS.card, borderRadius: 4 }}>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>
            #{row.id} | {row.createdAt} | {row.direction} | {row.intent ?? '-'}
          </Text>
          <Text style={{ color: COLORS.text, marginTop: 4 }}>
            {String(row.lineUserId).slice(0, 8)}: {String(row.content ?? '').slice(0, 200)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function FilterInput(props: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      placeholder={props.placeholder}
      placeholderTextColor={COLORS.muted}
      value={props.value}
      onChangeText={props.onChange}
      style={{
        flex: 1,
        padding: 8,
        color: COLORS.text,
        borderColor: COLORS.muted,
        borderWidth: 1,
        borderRadius: 4,
      }}
    />
  );
}
