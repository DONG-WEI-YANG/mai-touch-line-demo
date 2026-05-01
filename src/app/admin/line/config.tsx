import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { trpc } from '@/lib/trpc';

const COLORS = { bg: '#1a1a1a', card: '#252525', accent: '#C9A96E', text: '#fff', muted: '#888', error: '#ff6b6b' };

export default function ConfigPage() {
  const utils = trpc.useUtils();
  const q = trpc.lineAdmin.configList.useQuery();
  const setMut = trpc.lineAdmin.configSet.useMutation({
    onSuccess: () => utils.lineAdmin.configList.invalidate(),
    onError: (err) => Alert.alert('Error', err.message),
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
      <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
        Runtime Config
      </Text>
      <Text style={{ color: COLORS.muted, marginBottom: 16, fontSize: 12 }}>
        Changes apply immediately — no redeploy needed.
      </Text>

      {q.isLoading && <Text style={{ color: COLORS.muted }}>Loading...</Text>}
      {q.error && <Text style={{ color: COLORS.error }}>Error: {q.error.message}</Text>}

      {q.data?.map((row) => (
        <ConfigRow
          key={row.key}
          row={row}
          onSave={(value) => setMut.mutate({ key: row.key, value })}
          isPending={setMut.isPending}
        />
      ))}
    </ScrollView>
  );
}

type ConfigRowData = {
  key: string;
  value: string;
  type: string;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

function ConfigRow(props: {
  row: ConfigRowData;
  onSave: (value: unknown) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState(props.row.value);
  useEffect(() => setDraft(props.row.value), [props.row.value]);

  const dirty = draft !== props.row.value;

  const handleSave = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      Alert.alert('Invalid JSON', 'Wrap strings in double quotes; numbers/booleans/arrays unquoted.');
      return;
    }
    props.onSave(parsed);
  };

  return (
    <View style={{ padding: 12, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 4 }}>
      <Text style={{ color: COLORS.accent, fontWeight: 'bold' }}>{props.row.key}</Text>
      {props.row.description && (
        <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>{props.row.description}</Text>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholderTextColor={COLORS.muted}
          style={{
            flex: 1,
            padding: 8,
            color: COLORS.text,
            borderColor: COLORS.muted,
            borderWidth: 1,
            borderRadius: 4,
          }}
        />
        <Pressable
          onPress={handleSave}
          disabled={!dirty || props.isPending}
          style={({ pressed }) => ({
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 4,
            backgroundColor: dirty ? COLORS.accent : COLORS.muted,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: '#1a1a1a', fontWeight: 'bold' }}>Save</Text>
        </Pressable>
      </View>
      <Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 4 }}>
        type={props.row.type} | updated {props.row.updatedAt}
        {props.row.updatedBy ? ` by ${props.row.updatedBy}` : ''}
      </Text>
    </View>
  );
}
