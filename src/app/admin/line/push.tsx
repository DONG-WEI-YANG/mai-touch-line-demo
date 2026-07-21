import { useState } from 'react';
import { Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard, AdminButton, AdminField } from '@/components/admin/admin-ui';
import { parseError } from '@/lib/error-utils';

export default function ManualPushPage() {
  const colors = useColors();
  const [lineUserId, setLineUserId] = useState('');
  const [text, setText] = useState('');

  const pushMut = trpc.lineAdmin.manualPush.useMutation({
    onSuccess: () => {
      Alert.alert('Success', 'Message sent successfully');
      setText('');
    },
    onError: (err) => Alert.alert('Push Failed', parseError(err)),
  });

  const handlePush = () => {
    if (!lineUserId.trim()) { Alert.alert('Validation', 'LINE User ID is required'); return; }
    if (!text.trim()) { Alert.alert('Validation', 'Message text is required'); return; }
    
    pushMut.mutate({ lineUserId: lineUserId.trim(), text: text.trim() });
  };

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="Manual Push" 
        subtitle="Direct gateway for developer debugging"
      />

      <ScrollView contentContainerStyle={styles.container}>
        <AdminCard title="Direct Message Dispatch">
          <Text style={[styles.warningText, { color: colors.warning }]}>
            ⚠️ This tool bypasses AI and normal business logic. Use with caution.
          </Text>

          <AdminField 
            label="LINE USER ID *" 
            value={lineUserId} 
            onChangeText={setLineUserId} 
            placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
          />
          
          <AdminField 
            label="MESSAGE CONTENT *" 
            value={text} 
            onChangeText={setText} 
            multiline 
            placeholder="Type raw text to send..." 
          />

          <AdminButton
            title={pushMut.isPending ? "Sending..." : "Send Message"}
            onPress={handlePush}
            disabled={pushMut.isPending}
            style={{ marginTop: 8 }}
          />
        </AdminCard>

        <AdminCard title="Common Recipient IDs" style={{ marginTop: 16 }}>
          <Text style={[styles.helperText, { color: colors.muted }]}>
            You can find these IDs in the LINE Users or Live Logs pages.
          </Text>
        </AdminCard>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  warningText: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  helperText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
