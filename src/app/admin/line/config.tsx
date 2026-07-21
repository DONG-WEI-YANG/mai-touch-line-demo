import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Alert, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard, AdminButton } from '@/components/admin/admin-ui';
import { parseError } from '@/lib/error-utils';

export default function ConfigPage() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const q = trpc.lineAdmin.configList.useQuery();
  
  const setMut = trpc.lineAdmin.configSet.useMutation({
    onSuccess: () => {
      utils.lineAdmin.configList.invalidate();
      Alert.alert('Success', 'Configuration updated');
    },
    onError: (err) => Alert.alert('Error', parseError(err)),
  });

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="Runtime Config" 
        subtitle="Real-time system configuration updates"
      />

      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {q.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
        {q.error && <Text style={[styles.errorText, { color: colors.error }]}>Error: {q.error.message}</Text>}

        {q.data?.map((row) => (
          <ConfigRow
            key={row.key}
            row={row}
            onSave={(value) => setMut.mutate({ key: row.key, value })}
            isPending={setMut.isPending}
          />
        ))}
      </ScrollView>
    </ScreenContainer>
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

function ConfigRow({ row, onSave, isPending }: {
  row: ConfigRowData;
  onSave: (value: unknown) => void;
  isPending: boolean;
}) {
  const colors = useColors();
  const [draft, setDraft] = useState(row.value);
  const [isJsonValid, setIsJsonValid] = useState(true);

  useEffect(() => {
    setDraft(row.value);
  }, [row.value]);

  const dirty = draft !== row.value;

  const handleSave = useCallback(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
      onSave(parsed);
    } catch {
      setIsJsonValid(false);
      Alert.alert('Invalid JSON', 'Format error: Ensure strings have double quotes, and booleans/numbers are unquoted.');
    }
  }, [draft, onSave]);

  // Real-time JSON validation hint
  useEffect(() => {
    try {
      JSON.parse(draft);
      setIsJsonValid(true);
    } catch {
      setIsJsonValid(false);
    }
  }, [draft]);

  return (
    <AdminCard style={styles.configCard}>
      <View style={styles.cardHeader}>
        <Text style={[styles.configKey, { color: colors.primary }]}>{row.key}</Text>
        <View style={[styles.typeBadge, { backgroundColor: colors.background }]}>
          <Text style={[styles.typeText, { color: colors.muted }]}>{row.type.toUpperCase()}</Text>
        </View>
      </View>

      {row.description && (
        <Text style={[styles.configDesc, { color: colors.muted }]}>{row.description}</Text>
      )}

      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholderTextColor={colors.muted}
          multiline
          style={[
            styles.jsonInput,
            {
              color: colors.foreground,
              backgroundColor: colors.background,
              borderColor: !isJsonValid ? colors.error : dirty ? colors.primary : colors.border,
            }
          ]}
        />
      </View>

      <View style={styles.footerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.metaText, { color: colors.muted }]}>
            Updated: {new Date(row.updatedAt).toLocaleString()}
          </Text>
          {row.updatedBy && (
            <Text style={[styles.metaText, { color: colors.muted }]}>
              By: {row.updatedBy}
            </Text>
          )}
        </View>
        
        <AdminButton
          title={isPending ? "Saving..." : "Save"}
          onPress={handleSave}
          disabled={!dirty || isPending}
          type={!isJsonValid ? "danger" : "primary"}
          style={styles.saveBtn}
        />
      </View>
      
      {!isJsonValid && (
        <Text style={[styles.validationHint, { color: colors.error }]}>
          ⚠️ Invalid JSON format
        </Text>
      )}
    </AdminCard>
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
  configCard: {
    marginBottom: 16,
    paddingBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  configKey: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  configDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  inputRow: {
    marginBottom: 12,
  },
  jsonInput: {
    minHeight: 60,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    fontFamily: 'monospace',
    fontSize: 13,
    textAlignVertical: 'top',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '600',
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    minWidth: 80,
  },
  validationHint: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
});
