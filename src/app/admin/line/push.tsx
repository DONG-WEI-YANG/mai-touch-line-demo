import { useState } from 'react';
import { Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { trpc } from '@/lib/trpc';

const COLORS = { bg: '#1a1a1a', card: '#252525', accent: '#C9A96E', text: '#fff', muted: '#888' };

export default function PushPage() {
  const [lineUserId, setLineUserId] = useState('');
  const [text, setText] = useState('');

  const mut = trpc.lineAdmin.manualPush.useMutation({
    onSuccess: () => {
      Alert.alert('Sent', 'Message pushed (also written to audit log as outbound:debug)');
      setText('');
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const isValidUserId = /^U[0-9a-fA-F]{32}$/.test(lineUserId);
  const canSend = isValidUserId && text.trim().length > 0 && !mut.isPending;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
      <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
        Manual Push (Debug)
      </Text>
      <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16 }}>
        Sends a text message directly to a LINE userId. Logged with direction=outbound:debug.
      </Text>

      <Text style={{ color: COLORS.muted, fontSize: 12 }}>LINE userId (U + 32 hex)</Text>
      <TextInput
        value={lineUserId}
        onChangeText={setLineUserId}
        placeholder="U0123456789abcdef..."
        placeholderTextColor={COLORS.muted}
        autoCapitalize="none"
        style={{
          padding: 8,
          color: COLORS.text,
          borderColor: lineUserId && !isValidUserId ? '#ff6b6b' : COLORS.muted,
          borderWidth: 1,
          borderRadius: 4,
          marginBottom: 12,
        }}
      />

      <Text style={{ color: COLORS.muted, fontSize: 12 }}>Message text (max 500)</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={500}
        placeholder="Hello from admin..."
        placeholderTextColor={COLORS.muted}
        style={{
          minHeight: 80,
          padding: 8,
          color: COLORS.text,
          borderColor: COLORS.muted,
          borderWidth: 1,
          borderRadius: 4,
          marginBottom: 12,
        }}
      />

      <Pressable
        onPress={() => mut.mutate({ lineUserId, text })}
        disabled={!canSend}
        style={{
          padding: 12,
          borderRadius: 4,
          alignItems: 'center',
          backgroundColor: canSend ? COLORS.accent : COLORS.muted,
        }}
      >
        <Text style={{ color: '#1a1a1a', fontWeight: 'bold' }}>
          {mut.isPending ? 'Sending...' : 'Push'}
        </Text>
      </Pressable>

      <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 8 }}>
        Validation: userId must match LINE format (U + 32 hex chars).
      </Text>
    </ScrollView>
  );
}
