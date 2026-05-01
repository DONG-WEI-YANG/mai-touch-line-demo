import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { trpc } from '@/lib/trpc';

const COLORS = { bg: '#1a1a1a', card: '#252525', accent: '#C9A96E', text: '#fff', muted: '#888', error: '#ff6b6b' };

type ScriptId = 'facility' | 'repair' | 'visitor' | 'complaint';

export default function ScriptsPage() {
  const utils = trpc.useUtils();
  const q = trpc.lineAdmin.scriptsList.useQuery();
  const setEnabled = trpc.lineAdmin.scriptsSetEnabled.useMutation({
    onSuccess: () => utils.lineAdmin.scriptsList.invalidate(),
    onError: (err) => Alert.alert('Error', err.message),
  });
  const setSteps = trpc.lineAdmin.scriptsSetSteps.useMutation({
    onSuccess: () => utils.lineAdmin.scriptsList.invalidate(),
    onError: (err) => Alert.alert('Error', err.message),
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
      <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
        Demo Scripts
      </Text>

      {q.isLoading && <Text style={{ color: COLORS.muted }}>Loading...</Text>}
      {q.error && <Text style={{ color: COLORS.error }}>Error: {q.error.message}</Text>}

      {q.data?.map((s) => (
        <ScriptRow
          key={s.id}
          script={s}
          onToggle={(en) => setEnabled.mutate({ id: s.id as ScriptId, enabled: en })}
          onSaveSteps={(steps) => setSteps.mutate({ id: s.id as ScriptId, steps })}
        />
      ))}
    </ScrollView>
  );
}

function ScriptRow(props: {
  script: { id: string; enabled: number; stepsJson: string | null; updatedAt: string };
  onToggle: (enabled: boolean) => void;
  onSaveSteps: (steps: unknown[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.script.stepsJson ?? '[]');

  return (
    <View style={{ padding: 12, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: COLORS.accent, fontSize: 16, fontWeight: 'bold' }}>/demo {props.script.id}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => props.onToggle(!props.script.enabled)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 4,
              backgroundColor: props.script.enabled ? '#0a5d0a' : '#5d0a0a',
            }}
          >
            <Text style={{ color: '#fff' }}>{props.script.enabled ? 'enabled' : 'disabled'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setEditing((e) => !e)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, backgroundColor: COLORS.muted }}
          >
            <Text style={{ color: '#fff' }}>{editing ? 'cancel' : 'edit steps'}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>updated {props.script.updatedAt}</Text>

      {editing && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>steps JSON (array)</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            style={{
              minHeight: 120,
              padding: 8,
              color: COLORS.text,
              fontFamily: 'monospace',
              borderColor: COLORS.muted,
              borderWidth: 1,
              borderRadius: 4,
              marginTop: 4,
            }}
          />
          <Pressable
            onPress={() => {
              try {
                const arr = JSON.parse(draft);
                if (!Array.isArray(arr)) throw new Error('must be an array');
                props.onSaveSteps(arr);
                setEditing(false);
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'parse error';
                Alert.alert('Invalid JSON', msg);
              }
            }}
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 4,
              backgroundColor: COLORS.accent,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#1a1a1a', fontWeight: 'bold' }}>Save steps</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
