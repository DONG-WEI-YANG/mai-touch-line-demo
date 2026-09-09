import { useSyncExternalStore } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { dialogStore } from '@/lib/alert';
import { useColors } from '@/hooks/use-colors';

export function AlertHost() {
  const dialog = useSyncExternalStore(dialogStore.subscribe, dialogStore.getSnapshot, () => null);
  const colors = useColors();
  if (!dialog) return null;
  return <Modal transparent animationType="fade" visible onRequestClose={() => {
    const cancel = dialog.buttons.findIndex(button => button.style === 'cancel');
    if (cancel >= 0) dialogStore.dismiss(cancel);
    else if (dialog.options?.cancelable) dialogStore.dismiss();
  }}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#00000070' }}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 440, maxHeight: '85%', backgroundColor: colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border }}>
        <ScrollView><Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '600', color: colors.foreground }}>{dialog.title}</Text>
        {!!dialog.message && <Text style={{ marginTop: 12, fontSize: 16, lineHeight: 25, color: colors.muted }}>{dialog.message}</Text>}</ScrollView>
        <View style={{ gap: 10, marginTop: 24 }}>{dialog.buttons.map((button, index) => <Pressable key={index} accessibilityRole="button" onPress={() => dialogStore.dismiss(index)} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: button.style === 'cancel' ? colors.surface : button.style === 'destructive' ? colors.error : colors.primary }}>
          <Text style={{ fontWeight: '600', color: button.style === 'cancel' ? colors.foreground : '#FFFFFF' }}>{button.text ?? '確定'}</Text>
        </Pressable>)}</View>
      </View>
    </View>
  </Modal>;
}
