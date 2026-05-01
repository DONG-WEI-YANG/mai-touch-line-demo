import { Redirect, Slot } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/use-auth';

export default function AdminLineLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
        <ActivityIndicator color="#C9A96E" />
        <Text style={{ color: '#999', marginTop: 8 }}>Loading...</Text>
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;

  const role = (user as Record<string, unknown>).role as string | undefined;
  if (role !== 'admin') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a', padding: 24 }}>
        <Text style={{ color: '#C9A96E', fontSize: 18, fontWeight: 'bold' }}>Forbidden</Text>
        <Text style={{ color: '#999', marginTop: 8 }}>Admin role required to access LINE admin dashboard</Text>
        <Text style={{ color: '#666', marginTop: 16, fontSize: 12 }}>Your role: {role ?? '(unknown)'}</Text>
      </View>
    );
  }
  return <Slot />;
}
