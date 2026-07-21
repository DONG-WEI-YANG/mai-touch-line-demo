import { useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard, AdminButton } from '@/components/admin/admin-ui';
import { parseError } from '@/lib/error-utils';

export default function LineScriptsPage() {
  const colors = useColors();
  const q = trpc.lineAdmin.scriptsList.useQuery();
  const [runningId, setRunningId] = useState<string | null>(null);

  const runMut = trpc.lineAdmin.scriptRun.useMutation({
    onSuccess: (res) => {
      setRunningId(null);
      Alert.alert('Script Executed', res.message || 'The script completed successfully.');
    },
    onError: (err) => {
      setRunningId(null);
      Alert.alert('Execution Failed', parseError(err));
    },
  });

  const handleRun = (id: string, name: string) => {
    Alert.alert(
      'Run Script',
      `Are you sure you want to execute "${name}"? This will send automated messages and update database state.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Run Now', style: 'destructive', onPress: () => {
          setRunningId(id);
          runMut.mutate({ id });
        }},
      ]
    );
  };

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="Demo Scripts" 
        subtitle="Automated flows for testing and demonstration"
      />

      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {q.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
        {q.error && <Text style={[styles.errorText, { color: colors.error }]}>Error: {q.error.message}</Text>}

        {q.data?.map((script) => (
          <AdminCard key={script.id} style={styles.scriptCard}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.scriptName, { color: colors.foreground }]}>{script.name}</Text>
                <Text style={[styles.scriptId, { color: colors.muted }]}>ID: {script.id}</Text>
              </View>
              <View style={[styles.categoryBadge, { backgroundColor: colors.background }]}>
                <Text style={[styles.categoryText, { color: colors.muted }]}>
                  {script.category.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={[styles.description, { color: colors.muted }]}>
              {script.description}
            </Text>

            <View style={styles.stepsBox}>
              <Text style={[styles.stepsTitle, { color: colors.foreground }]}>STEPS ({script.steps.length}):</Text>
              {script.steps.map((step, idx) => (
                <Text key={idx} style={[styles.stepItem, { color: colors.muted }]} numberOfLines={1}>
                  {idx + 1}. {step}
                </Text>
              ))}
            </View>

            <AdminButton
              title={runningId === script.id ? "Running..." : "Execute Script"}
              onPress={() => handleRun(script.id, script.name)}
              disabled={!!runningId}
              type={runningId === script.id ? "secondary" : "primary"}
              style={styles.runBtn}
            />
          </AdminCard>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
  },
  scriptCard: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  scriptName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scriptId: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  stepsBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 16,
    gap: 4,
  },
  stepsTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepItem: {
    fontSize: 11,
    fontWeight: '600',
  },
  runBtn: {
    paddingVertical: 12,
  },
});
