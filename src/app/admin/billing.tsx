import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { trpc } from '@/lib/trpc';

const COLORS = {
  bg: '#1a1a1a',
  card: '#252525',
  cardLight: '#2f2f2f',
  accent: '#C9A96E',
  text: '#fff',
  muted: '#888',
  error: '#ff6b6b',
  success: '#4ade80',
  warning: '#fbbf24',
};

function formatMoney(cents: number, currency = 'TWD') {
  // Display in major units. NT$ etc. don't typically use decimal subdivisions
  // in everyday context, so when the value is whole-units we omit the .00.
  const major = cents / 100;
  const fixed = Number.isInteger(major) ? `${major}` : major.toFixed(2);
  const symbol = currency === 'TWD' ? 'NT$' : currency;
  return `${symbol} ${fixed}`;
}

export default function AdminBillingPage() {
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
    onError: (err) => Alert.alert('Issue failed', err.message),
  });
  const markPaidMut = trpc.finance.markInvoicePaid.useMutation({
    onSuccess: () => utils.finance.invoicesList.invalidate(),
    onError: (err) => Alert.alert('Mark paid failed', err.message),
  });
  const deleteMut = trpc.finance.deleteInvoice.useMutation({
    onSuccess: () => utils.finance.invoicesList.invalidate(),
    onError: (err) => Alert.alert('Delete failed', err.message),
  });

  const recipientChoices = useMemo(() => {
    const all = (users.data ?? []) as any[];
    const residents = all.filter((u) => u.role === 'resident');
    if (!recipientFilter.trim()) return residents.slice(0, 10);
    const s = recipientFilter.trim().toLowerCase();
    return residents.filter(
      (u) => (u.name ?? '').toLowerCase().includes(s) || (u.email ?? '').toLowerCase().includes(s),
    ).slice(0, 10);
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

  const submitIssue = () => {
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
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={list.isFetching} onRefresh={() => list.refetch()} tintColor={COLORS.accent} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: 'bold' }}>帳單 (Billing)</Text>
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
            {filtered.length} of {list.data?.length ?? 0} · 不接金流,marked paid 即視為入帳
          </Text>
        </View>
        <Pressable
          onPress={() => setShowIssue((v) => !v)}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4,
                   backgroundColor: showIssue ? COLORS.muted : COLORS.accent }}
        >
          <Text style={{ color: showIssue ? '#fff' : '#1a1a1a', fontWeight: 'bold' }}>
            {showIssue ? 'Cancel' : '+ Issue'}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {(['open', 'all'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4,
                     backgroundColor: filter === f ? COLORS.accent : COLORS.card }}
          >
            <Text style={{ color: filter === f ? '#1a1a1a' : '#fff', fontSize: 12 }}>
              {f === 'open' ? '未付款' : '全部'}
            </Text>
          </Pressable>
        ))}
      </View>

      {showIssue && (
        <View style={{ padding: 12, marginBottom: 16, backgroundColor: COLORS.cardLight, borderRadius: 6 }}>
          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Recipient *</Text>
          {pickedRecipient ? (
            <Pressable
              onPress={() => setDraft({ ...draft, userId: 0 })}
              style={{ padding: 10, backgroundColor: COLORS.accent + '40', borderRadius: 4, marginBottom: 8 }}
            >
              <Text style={{ color: COLORS.text }}>
                ✓ {pickedRecipient.name ?? '(no name)'} · #{pickedRecipient.id}
              </Text>
              <Text style={{ color: COLORS.muted, fontSize: 11 }}>tap to change</Text>
            </Pressable>
          ) : (
            <>
              <TextInput
                value={recipientFilter}
                onChangeText={setRecipientFilter}
                placeholder="Search resident"
                placeholderTextColor={COLORS.muted}
                style={{ padding: 8, marginBottom: 6, color: COLORS.text, backgroundColor: COLORS.bg, borderRadius: 4 }}
              />
              {recipientChoices.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => setDraft({ ...draft, userId: u.id })}
                  style={{ padding: 8, marginBottom: 4, backgroundColor: COLORS.card, borderRadius: 4 }}
                >
                  <Text style={{ color: COLORS.text, fontSize: 13 }}>{u.name ?? '(no name)'}</Text>
                  <Text style={{ color: COLORS.muted, fontSize: 11 }}>
                    #{u.id} · Unit {u.unitId ?? '-'}
                  </Text>
                </Pressable>
              ))}
            </>
          )}

          <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 8, marginBottom: 4 }}>Description *</Text>
          <TextInput
            value={draft.description}
            onChangeText={(t) => setDraft({ ...draft, description: t })}
            placeholder="2026 年 5 月 管理費"
            placeholderTextColor={COLORS.muted}
            style={{ padding: 8, marginBottom: 8, color: COLORS.text, backgroundColor: COLORS.bg, borderRadius: 4 }}
          />

          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Amount (NT$) *</Text>
          <TextInput
            value={draft.amount}
            onChangeText={(t) => setDraft({ ...draft, amount: t })}
            placeholder="3500"
            placeholderTextColor={COLORS.muted}
            keyboardType="decimal-pad"
            style={{ padding: 8, marginBottom: 8, color: COLORS.text, backgroundColor: COLORS.bg, borderRadius: 4 }}
          />

          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Due date (YYYY-MM-DD)</Text>
          <TextInput
            value={draft.dueDate}
            onChangeText={(t) => setDraft({ ...draft, dueDate: t })}
            placeholder="2026-05-31"
            placeholderTextColor={COLORS.muted}
            style={{ padding: 8, marginBottom: 8, color: COLORS.text, backgroundColor: COLORS.bg, borderRadius: 4 }}
          />

          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Notes</Text>
          <TextInput
            value={draft.notes}
            onChangeText={(t) => setDraft({ ...draft, notes: t })}
            placeholder=""
            multiline
            placeholderTextColor={COLORS.muted}
            style={{ padding: 8, marginBottom: 8, color: COLORS.text, backgroundColor: COLORS.bg, borderRadius: 4, minHeight: 50 }}
          />

          <Pressable
            disabled={issueMut.isPending}
            onPress={submitIssue}
            style={{ paddingVertical: 10, borderRadius: 4, backgroundColor: COLORS.accent, alignItems: 'center', opacity: issueMut.isPending ? 0.5 : 1 }}
          >
            <Text style={{ color: '#1a1a1a', fontWeight: 'bold' }}>
              {issueMut.isPending ? 'Issuing…' : 'Issue invoice'}
            </Text>
          </Pressable>
        </View>
      )}

      {list.isLoading && <ActivityIndicator color={COLORS.accent} />}
      {filtered.map((i: any) => {
        const open = !i.paidAt;
        const overdue = open && i.dueDate && new Date(i.dueDate) < new Date();
        return (
          <View
            key={i.id}
            style={{ padding: 12, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 6,
                     borderLeftWidth: open ? 3 : 0,
                     borderLeftColor: overdue ? COLORS.error : COLORS.warning }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.text, fontWeight: 'bold', flex: 1 }}>{i.description}</Text>
              <Text style={{ color: open ? COLORS.warning : COLORS.success, fontWeight: 'bold' }}>
                {formatMoney(i.amountCents, i.currency)}
              </Text>
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>
              #INV-{i.id} · {i.userName ?? `User #${i.userId}`}
            </Text>
            <Text style={{ color: COLORS.muted, fontSize: 11 }}>
              Issued: {new Date(i.issuedAt).toLocaleDateString()}
              {i.dueDate ? ` · Due: ${i.dueDate}` : ''}
              {overdue ? ' · OVERDUE' : ''}
            </Text>
            {i.paidAt && (
              <Text style={{ color: COLORS.success, fontSize: 11, marginTop: 4 }}>
                ✓ Paid {new Date(i.paidAt).toLocaleDateString()} · {i.paidMethod}
              </Text>
            )}
            {open && (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {(['cash', 'transfer', 'autodebit', 'manual'] as const).map((m) => (
                  <Pressable
                    key={m}
                    disabled={markPaidMut.isPending}
                    onPress={() => markPaidMut.mutate({ id: i.id, method: m })}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
                             backgroundColor: COLORS.success + '30',
                             borderWidth: 1, borderColor: COLORS.success + '60' }}
                  >
                    <Text style={{ color: COLORS.success, fontSize: 11 }}>Mark paid · {m}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => Alert.alert('Delete', `Delete INV-${i.id}?`, [
                    { text: 'Cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate({ id: i.id }) },
                  ])}
                  style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: '#5d0a0a' }}
                >
                  <Text style={{ color: '#fff', fontSize: 11 }}>Del</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
