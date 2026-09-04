/**
 * 錯誤狀態下的自我修復輪詢間隔。
 *
 * React Query 的 retry 次數用完後會停在 error 狀態,不會再自己嘗試。對展示頁
 * 來說那等於:限流視窗過去了、伺服器早就恢復了,畫面卻還是死的,業務得當著
 * 客戶的面重新整理 —— 而畫面上那句「系統會自動重試」就成了假承諾。
 *
 * 所以只在 error 狀態下開一個慢速輪詢,成功後立刻關掉,不留背景流量。
 * 間隔刻意放慢:這類錯誤多半是限流,猛打只會把限流視窗延長。
 */
const RECOVERY_INTERVAL_MS = 6000;

export function recoveryRefetchInterval(status: string): number | false {
  return status === "error" ? RECOVERY_INTERVAL_MS : false;
}
