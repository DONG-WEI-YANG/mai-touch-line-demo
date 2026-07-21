import { Redirect, Slot } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';

export default function AdminLineLayout() {
  const { user, loading } = useAuth();
  const colors = useColors();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Loading...</Text>
      </View>
    );
  }
  
  if (!user) return <Redirect href="/login" />;

  const role = (user as Record<string, unknown>).role as string | undefined;
  if (role !== 'admin') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.forbiddenTitle, { color: colors.primary }]}>Forbidden</Text>
        <Text style={[styles.forbiddenText, { color: colors.muted }]}>
          Admin role required to access LINE admin dashboard
        </Text>
        <Text style={[styles.roleInfo, { color: colors.muted + '80' }]}>
          Your current role: {role ?? '(unknown)'}
        </Text>
      </View>
    );
  }
  
  return <Slot />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  forbiddenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  forbiddenText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  roleInfo: {
    marginTop: 20,
    fontSize: 11,
    fontWeight: '600',
  },
});
