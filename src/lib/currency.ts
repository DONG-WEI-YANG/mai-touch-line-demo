/** Database financial amounts are stored as integer cents. */
export function formatCurrencyCents(amountCents: number, currency = "TWD"): string {
  const amount = Number.isFinite(amountCents) ? amountCents / 100 : 0;
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
