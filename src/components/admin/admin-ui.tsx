import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ViewStyle, StyleProp } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';

/**
 * AdminCard - A standardized card for admin pages
 */
export function AdminCard({ children, style, title }: { children: React.ReactNode, style?: StyleProp<ViewStyle>, title?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {title && <Text style={[styles.cardTitle, { color: colors.primary }]}>{title}</Text>}
      {children}
    </View>
  );
}

/**
 * AdminButton - A standardized button for admin pages
 */
export function AdminButton({ 
  onPress, 
  title, 
  type = 'primary', 
  disabled = false, 
  style, 
  icon 
}: { 
  onPress: () => void, 
  title: string, 
  type?: 'primary' | 'secondary' | 'danger' | 'success', 
  disabled?: boolean, 
  style?: StyleProp<ViewStyle>,
  icon?: string
}) {
  const colors = useColors();
  
  const getBgColor = () => {
    if (disabled) return colors.muted + '40';
    switch (type) {
      case 'primary': return colors.primary;
      case 'secondary': return colors.surface;
      case 'danger': return colors.error;
      case 'success': return colors.success;
      default: return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.muted;
    if (type === 'secondary') return colors.foreground;
    return '#000'; // Primary/Danger/Success buttons usually have dark text on gold/red/green
  };

  const getBorderColor = () => {
    if (type === 'secondary') return colors.border;
    return 'transparent';
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { 
          backgroundColor: getBgColor(), 
          borderColor: getBorderColor(),
          borderWidth: type === 'secondary' ? 1 : 0,
          opacity: pressed ? 0.7 : 1 
        },
        style
      ]}
    >
      {icon && <IconSymbol name={icon} size={16} color={getTextColor()} />}
      <Text style={[styles.buttonText, { color: getTextColor() }]}>{title}</Text>
    </Pressable>
  );
}

/**
 * AdminField - A standardized input field for admin pages
 */
export function AdminField({ 
  label, 
  value, 
  onChangeText, 
  multiline = false, 
  keyboardType = 'default',
  placeholder 
}: { 
  label: string, 
  value: string, 
  onChangeText: (t: string) => void, 
  multiline?: boolean, 
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'email-address' | 'phone-pad',
  placeholder?: string
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.background,
            borderColor: colors.border,
            minHeight: multiline ? 80 : 44,
            textAlignVertical: multiline ? 'top' : 'center',
          }
        ]}
      />
    </View>
  );
}

/**
 * AdminHeader - A standardized header for admin pages
 */
export function AdminHeader({ title, subtitle, rightElement }: { title: string, subtitle?: string, rightElement?: React.ReactNode }) {
  const colors = useColors();
  const router = useRouter();
  
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <View style={styles.headerTitleRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={colors.primary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>{title}</Text>
        </View>
        {subtitle && <Text style={[styles.headerSubtitle, { color: colors.muted }]}>{subtitle}</Text>}
      </View>
      {rightElement}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderRadius: 8,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 32, // Align with title text (back button + gap)
  },
});
