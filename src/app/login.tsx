import { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { setStoredToken } from '../lib/trpc';
import { useAuth } from '../hooks/use-auth';

const COLORS = { bg: '#1a1a1a', card: '#252525', accent: '#C9A96E', text: '#fff', muted: '#888' };

const QUICK_BUTTONS = [
  { label: 'Admin',     env: 'EXPO_PUBLIC_DEMO_ADMIN_TOKEN' },
  { label: 'Logistics', env: 'EXPO_PUBLIC_DEMO_LOGISTICS_TOKEN' },
  { label: 'Resident',  env: 'EXPO_PUBLIC_DEMO_RESIDENT_TOKEN' },
];

export default function LoginScreen() {
  const [token, setToken] = useState('');
  const { refresh } = useAuth();

  const submit = useCallback(async (t: string) => {
    const trimmed = t.trim();
    if (!trimmed) { Alert.alert('Token required'); return; }
    setStoredToken(trimmed);
    await refresh();
    router.replace('/');
  }, [refresh]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ padding: 32 }}>
      <Text style={{ color: COLORS.accent, fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
        m'AI Touch — Staff Login
      </Text>
      <Text style={{ color: COLORS.muted, marginBottom: 24 }}>
        Paste your access token, or use a quick-login below (demo only).
      </Text>

      <View style={{ backgroundColor: COLORS.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>Token</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder="paste token here"
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
          style={{ padding: 10, color: COLORS.text, borderColor: COLORS.muted, borderWidth: 1, borderRadius: 4, fontFamily: 'monospace' }}
        />
        <Pressable
          onPress={() => submit(token)}
          style={{ marginTop: 12, padding: 12, backgroundColor: COLORS.accent, borderRadius: 4, alignItems: 'center' }}
        >
          <Text style={{ color: '#1a1a1a', fontWeight: 'bold' }}>Sign in</Text>
        </Pressable>
      </View>

      <View style={{ backgroundColor: COLORS.card, padding: 16, borderRadius: 8 }}>
        <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>Quick demo logins</Text>
        {QUICK_BUTTONS.map(b => {
          const v = (process.env as Record<string, string | undefined>)[b.env];
          return (
            <Pressable
              key={b.env}
              disabled={!v}
              onPress={() => v && submit(v)}
              style={{ marginBottom: 8, padding: 10, borderRadius: 4,
                       backgroundColor: v ? COLORS.muted : '#444', opacity: v ? 1 : 0.5 }}
            >
              <Text style={{ color: '#fff' }}>{b.label}{v ? '' : ' (env not set)'}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
