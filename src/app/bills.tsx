import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';

function formatMoney(cents: number, currency = 'TWD') {
  const major = cents / 100;
  const fixed = Number.isInteger(major) ? `${major}` : major.toFixed(2);
  const symbol = currency === 'TWD' ? 'NT$' : currency;
  return `${symbol} ${fixed}`;
}

export default function BillsScreen() {
  const colors = useColors();
  const router = useRouter();
  const all = trpc.finance.myInvoices.useQuery();
  const unpaid = trpc.finance.myUnpaid.useQuery();

  return (
    <ScreenContainer edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface,
                   alignItems: 'center', justifyContent: 'center' }}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: '700' }}>帳單</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>
            未繳:{unpaid.data?.summary.openCount ?? 0} 筆 ·{' '}
            {formatMoney(unpaid.data?.summary.openCents ?? 0)}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={all.isFetching || unpaid.isFetching}
            onRefresh={() => { all.refetch(); unpaid.refetch(); }}
            tintColor={colors.primary}
          />
        }
      >
        {all.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />}

        {(unpaid.data?.invoices.length ?? 0) > 0 && (
          <>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 }}>
              待繳 OPEN
            </Text>
            {(unpaid.data?.invoices ?? []).map((i: any) => {
              const overdue = i.dueDate && new Date(i.dueDate) < new Date();
              return (
                <View
                  key={i.id}
                  style={{
                    padding: 16, borderRadius: 16, borderWidth: 0.5,
                    borderColor: overdue ? colors.error : colors.warning + '60',
                    backgroundColor: colors.surface, marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700', flex: 1 }}>
                      {i.description}
                    </Text>
                    <Text style={{ color: overdue ? colors.error : colors.warning, fontSize: 18, fontWeight: '700' }}>
                      {formatMoney(i.amountCents, i.currency)}
                    </Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                    #INV-{i.id} · 開立 {new Date(i.issuedAt).toLocaleDateString()}
                  </Text>
                  {i.dueDate && (
                    <Text style={{ color: overdue ? colors.error : colors.muted, fontSize: 12 }}>
                      到期日 {i.dueDate}{overdue ? ' · 已逾期' : ''}
                    </Text>
                  )}
                  {i.notes && (
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>
                      {i.notes}
                    </Text>
                  )}
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                    💡 請洽管理處繳費 · 完成後系統會更新狀態
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {!all.isLoading && (unpaid.data?.invoices.length ?? 0) === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <IconSymbol name="checkmark.circle.fill" size={48} color={colors.success} />
            <Text style={{ color: colors.muted, fontSize: 16, marginTop: 12 }}>
              沒有待繳帳單
            </Text>
          </View>
        )}

        {(all.data ?? []).filter((i: any) => i.paidAt).length > 0 && (
          <>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 24, marginBottom: 8 }}>
              歷史 HISTORY
            </Text>
            {(all.data ?? []).filter((i: any) => i.paidAt).map((i: any) => (
              <View
                key={i.id}
                style={{
                  padding: 12, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border,
                  backgroundColor: colors.surface, marginBottom: 8, opacity: 0.7,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>
                    {i.description}
                  </Text>
                  <Text style={{ color: colors.success, fontSize: 14 }}>
                    {formatMoney(i.amountCents, i.currency)}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                  ✓ {new Date(i.paidAt).toLocaleDateString()} · {i.paidMethod}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
