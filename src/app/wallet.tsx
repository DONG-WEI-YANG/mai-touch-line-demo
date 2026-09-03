import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { formatCurrencyCents } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";

export default function WalletScreen() {
  const colors = useColors();
  const { t, state } = useApp();
  const router = useRouter();

  const { data: wallet, isLoading } = trpc.finance.myWallet.useQuery();
  const { data: transactions = [] } = trpc.finance.history.useQuery();

  return (
    <ScreenContainer edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("wallet.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Black Card */}
        <View style={styles.cardContainer}>
          <View style={[styles.blackCard, { shadowColor: colors.primary }]}>
            <View style={styles.cardHeader}>
              <IconSymbol name="brain" size={24} color="#FFD700" />
              <Text style={styles.cardBrand}>m'AI WEALTH</Text>
            </View>
            
            <View style={styles.cardBody}>
              <Text style={styles.cardLabel}>{t("wallet.balance")}</Text>
              {isLoading ? (
                <ActivityIndicator color="#FFD700" />
              ) : (
                <Text style={styles.cardBalance}>{formatCurrencyCents(wallet?.balance ?? 0)}</Text>
              )}
            </View>

            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.cardLabel}>{t("wallet.points")}</Text>
                <Text style={styles.cardPoints}>{wallet?.points || 0} PTS</Text>
              </View>
              <IconSymbol name="wifi" size={24} color="rgba(255,255,255,0.5)" />
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/bills" as never)}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primary + "20" }]}>
              <IconSymbol name="doc.text.fill" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.actionText, { color: colors.foreground }]}>{t("wallet.pay_fee")}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.55 }]}
            disabled
            accessibilityState={{ disabled: true }}
          >
            <View style={[styles.actionIcon, { backgroundColor: "#5B9A6F20" }]}>
              <IconSymbol name="plus.circle.fill" size={24} color="#5B9A6F" />
            </View>
            <Text style={[styles.actionText, { color: colors.foreground }]}>{t("wallet.topup")}</Text>
            <Text style={[styles.actionHint, { color: colors.muted }]}>
              {state.language === "zh" ? "尚未設定付款服務" : "Payment provider not configured"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* History */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t("wallet.history")}</Text>
        
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ color: colors.muted }}>{t("wallet.no_history")}</Text>
          </View>
        ) : (
          <View style={styles.txList}>
            {transactions.map((tx: any) => (
              <View key={tx.id} style={[styles.txItem, { borderBottomColor: colors.border }]}>
                <View style={[styles.txIcon, { backgroundColor: colors.surface }]}>
                  <IconSymbol 
                    name={tx.type === "payment" ? "arrow.up.right" : "arrow.down.left"} 
                    size={16} 
                    color={tx.type === "payment" ? colors.error : colors.success} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.txDesc, { color: colors.foreground }]}>{tx.description}</Text>
                  <Text style={[styles.txDate, { color: colors.muted }]}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.amount < 0 ? colors.foreground : colors.success }]}>
                  {tx.amount > 0 ? "+" : ""}{formatCurrencyCents(tx.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  content: { padding: 20 },
  cardContainer: { alignItems: "center", marginBottom: 30 },
  blackCard: {
    width: "100%",
    height: 200,
    backgroundColor: "#1A1A1A",
    borderRadius: 24,
    padding: 24,
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardBrand: { color: "#FFD700", fontWeight: "800", letterSpacing: 2 },
  cardBody: { marginTop: 10 },
  cardLabel: { color: "#888", fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  cardBalance: { color: "#FFF", fontSize: 32, fontWeight: "700", marginTop: 4 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  cardPoints: { color: "#FFD700", fontSize: 16, fontWeight: "700", marginTop: 2 },
  actionsGrid: { flexDirection: "row", gap: 16, marginBottom: 32 },
  actionBtn: { flex: 1, padding: 16, borderRadius: 20, borderWidth: 1, alignItems: "center", gap: 10 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  actionText: { fontWeight: "700", fontSize: 14 },
  actionHint: { fontSize: 10, textAlign: "center" },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 16 },
  emptyState: { alignItems: "center", padding: 40, opacity: 0.6 },
  txList: { gap: 0 },
  txItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 0.5, gap: 16 },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txDesc: { fontSize: 15, fontWeight: "600" },
  txDate: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "700" },
});
