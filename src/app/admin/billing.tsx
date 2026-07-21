import { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, RefreshControl, StyleSheet, Pressable } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader, AdminCard, AdminButton, AdminField } from '@/components/admin/admin-ui';
import { parseError } from '@/lib/error-utils';

function formatMoney(cents: number, currency = 'TWD') {
  const major = cents / 100;
  const fixed = Number.isInteger(major) ? `${major}` : major.toFixed(2);
  const symbol = currency === 'TWD' ? 'NT$' : currency;
  return `${symbol} ${fixed}`;
}

export default function AdminBillingPage() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const list = trpc.finance.invoicesList.useQuery();
  const users = trpc.admin.users.useQuery();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [showIssue, setShowIssue] = useState(false);
  const [draft, setDraft] = useState({
    userId: 0, description: '', amount: '', dueDate: '', notes: '',
  });
  const [recipientFilter, setRecipientFilter] = useState('');

  const issueMut = trpc.finance.issueInvoice.useMutation({
    onSuccess: () => {
      utils.finance.invoicesList.invalidate();
      setDraft({ userId: 0, description: '', amount: '', dueDate: '', notes: '' });
      setRecipientFilter('');
      setShowIssue(false);
      Alert.alert('Issued', 'Invoice created');
    },
    onError: (err) => Alert.alert('Issue failed', parseError(err)),
  });

  const markPaidMut = trpc.finance.markInvoicePaid.useMutation({
    onSuccess: () => utils.finance.invoicesList.invalidate(),
    onError: (err) => Alert.alert('Mark paid failed', parseError(err)),
  });

  const deleteMut = trpc.finance.deleteInvoice.useMutation({
    onSuccess: () => utils.finance.invoicesList.invalidate(),
    onError: (err) => Alert.alert('Delete failed', parseError(err)),
  });

  const recipientChoices = useMemo(() => {
    const all = (users.data ?? []) as any[];
    const residents = all.filter((u) => u.role === 'resident');
    if (!recipientFilter.trim()) return residents.slice(0, 5);
    const s = recipientFilter.trim().toLowerCase();
    return residents.filter(
      (u) => (u.name ?? '').toLowerCase().includes(s) || (u.email ?? '').toLowerCase().includes(s),
    ).slice(0, 5);
  }, [users.data, recipientFilter]);

  const pickedRecipient = useMemo(
    () => (users.data as any[] | undefined)?.find((u) => u.id === draft.userId),
    [users.data, draft.userId],
  );

  const filtered = useMemo(() => {
    if (!list.data) return [];
    if (filter === 'open') return (list.data as any[]).filter((i) => !i.paidAt);
    return list.data as any[];
  }, [list.data, filter]);

  const submitIssue = useCallback(() => {
    if (!draft.userId) { Alert.alert('Validation', 'Pick a recipient'); return; }
    if (!draft.description.trim()) { Alert.alert('Validation', 'Description required'); return; }
    const amount = parseFloat(draft.amount.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Validation', 'Enter a positive amount');
      return;
    }
    issueMut.mutate({
      userId: draft.userId,
      description: draft.description.trim(),
      amountCents: Math.round(amount * 100),
      currency: 'TWD',
      dueDate: draft.dueDate || undefined,
      notes: draft.notes || undefined,
    });
  }, [draft, issueMut]);

  const confirmDelete = useCallback((id: number) => {
    Alert.alert('Delete invoice', `Permanently delete INV-${id}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate({ id }) },
    ]);
  }, [deleteMut]);

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="帳單管理" 
        subtitle={`${filtered.length} of ${list.data?.length ?? 0} invoices`}
        rightElement={
          <AdminButton 
            title={showIssue ? 'Cancel' : '+ Issue'} 
            type={showIssue ? 'secondary' : 'primary'}
            onPress={() => setShowIssue(!showIssue)}
            style={{ paddingVertical: 8 }}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={list.isFetching} onRefresh={() => list.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.filterRow}>
          {(['open', 'all'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                { backgroundColor: filter === f ? colors.primary : colors.surface, borderColor: colors.border }
              ]}
            >
              <Text style={[styles.filterChipText, { color: filter === f ? '#000' : colors.foreground }]}>
                {f === 'open' ? '未付款' : '全部'}
              </Text>
            </Pressable>
          ))}
        </View>

        {showIssue && (
          <AdminCard title="Issue New Invoice" style={styles.composeCard}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>RECIPIENT *</Text>
            {pickedRecipient ? (
              <Pressable
                onPress={() => setDraft({ ...draft, userId: 0 })}
                style={[styles.pickedRecipient, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
              >
                <Text style={[styles.pickedRecipientText, { color: colors.foreground }]}>
                  ✓ {pickedRecipient.name ?? '(no name)'} · #{pickedRecipient.id}
                </Text>
                <Text style={[styles.tapToChange, { color: colors.primary }]}>Tap to change</Text>
              </Pressable>
            ) : (
              <View style={styles.recipientPicker}>
                <AdminField 
                  label="" 
                  value={recipientFilter} 
                  onChangeText={setRecipientFilter} 
                  placeholder="Search resident..." 
                />
                <View style={styles.choicesRow}>
                  {recipientChoices.map((u) => (
                    <Pressable
                      key={u.id}
                      onPress={() => setDraft({ ...draft, userId: u.id })}
                      style={[styles.choiceItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                      <Text style={[styles.choiceName, { color: colors.foreground }]}>{u.name ?? '(no name)'}</Text>
                      <Text style={[styles.choiceMeta, { color: colors.muted }]}>#{u.id} · {u.unitId ? `Unit ${u.unitId}` : 'No Unit'}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <AdminField label="Description *" value={draft.description} onChangeText={(t) => setDraft({ ...draft, description: t })} placeholder="e.g. 2026年5月管理費" />
            <AdminField label="Amount (NT$) *" value={draft.amount} onChangeText={(t) => setDraft({ ...draft, amount: t })} keyboardType="decimal-pad" placeholder="0.00" />
            <AdminField label="Due Date (YYYY-MM-DD)" value={draft.dueDate} onChangeText={(t) => setDraft({ ...draft, dueDate: t })} placeholder="2026-05-31" />
            <AdminField label="Notes" value={draft.notes} onChangeText={(t) => setDraft({ ...draft, notes: t })} multiline placeholder="Optional notes..." />

            <AdminButton
              title={issueMut.isPending ? 'Issuing…' : 'Issue Invoice'}
              onPress={submitIssue}
              disabled={issueMut.isPending}
            />
          </AdminCard>
        )}

        {list.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
        
        {filtered.map((i: any) => {
          const open = !i.paidAt;
          const overdue = open && i.dueDate && new Date(i.dueDate) < new Date();
          return (
            <AdminCard 
              key={i.id} 
              style={[
                styles.invoiceCard, 
                { borderLeftWidth: open ? 4 : 0, borderLeftColor: overdue ? colors.error : colors.warning }
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.invoiceTitle, { color: colors.foreground }]}>{i.description}</Text>
                  <Text style={[styles.invoiceMeta, { color: colors.muted }]}>
                    #INV-{i.id} · {i.userName ?? `User #${i.userId}`}
                  </Text>
                </View>
                <Text style={[styles.amountText, { color: open ? colors.warning : colors.success }]}>
                  {formatMoney(i.amountCents, i.currency)}
                </Text>
              </View>

              <View style={styles.detailsRow}>
                <Text style={[styles.detailText, { color: colors.muted }]}>
                  Issued: {new Date(i.issuedAt).toLocaleDateString()}
                  {i.dueDate ? ` · Due: ${i.dueDate}` : ''}
                  {overdue ? ' · OVERDUE' : ''}
                </Text>
              </View>

              {i.paidAt && (
                <View style={[styles.paidBadge, { backgroundColor: colors.success + '15' }]}>
                  <Text style={[styles.paidText, { color: colors.success }]}>
                    ✓ Paid {new Date(i.paidAt).toLocaleDateString()} via {i.paidMethod}
                  </Text>
                </View>
              )}

              {open && (
                <View style={styles.actionRow}>
                  <View style={styles.paymentMethods}>
                    {(['cash', 'transfer', 'manual'] as const).map((m) => (
                      <Pressable
                        key={m}
                        disabled={markPaidMut.isPending}
                        onPress={() => markPaidMut.mutate({ id: i.id, method: m })}
                        style={[styles.payBtn, { borderColor: colors.success + '40', backgroundColor: colors.success + '10' }]}
                      >
                        <Text style={[styles.payBtnText, { color: colors.success }]}>{m}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <AdminButton 
                    title="Del" 
                    type="danger" 
                    onPress={() => confirmDelete(i.id)} 
                    style={styles.delBtn}
                  />
                </View>
              )}
            </AdminCard>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  composeCard: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  pickedRecipient: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickedRecipientText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tapToChange: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  recipientPicker: {
    marginBottom: 8,
  },
  choicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -8,
    marginBottom: 16,
  },
  choiceItem: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: '48%',
  },
  choiceName: {
    fontSize: 13,
    fontWeight: '600',
  },
  choiceMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  invoiceCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  invoiceMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
  },
  detailsRow: {
    marginTop: 8,
  },
  detailText: {
    fontSize: 12,
  },
  paidBadge: {
    marginTop: 12,
    padding: 8,
    borderRadius: 6,
  },
  paidText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  paymentMethods: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  payBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  payBtnText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  delBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});
