/**
 * 全域查詢重試政策。
 *
 * 原本寫在 _layout.tsx 裡,規則是「4xx 一律不重試」—— 用意是止住 403 洗版
 * (管理員在角色導向生效前會短暫打到住戶專用 procedure)。但 429 也是 4xx,
 * 而它恰恰是最該重試的一種:限流視窗過去就好了。展示模式的時間軸輪詢撞到
 * 限流時會靜靜停住,畫面就凍在客戶面前。
 *
 * 抽成純函式才測得到 —— 這種「某個狀態碼落錯分類」的錯誤在畫面上看起來只是
 * 「怎麼沒更新」,不會有任何紅字。
 */

/** 限流的重試次數上限。伺服器的視窗通常幾十秒,退避重試幾次就會過去。 */
const MAX_THROTTLE_RETRIES = 3;

function httpStatusOf(error: unknown): number {
  if (!error || typeof error !== "object") return 0;
  const e = error as { data?: { httpStatus?: number }; status?: number };
  return e.data?.httpStatus ?? e.status ?? 0;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = httpStatusOf(error);

  // 限流:等一下就會過去,值得重試。
  if (status === 429) return failureCount < MAX_THROTTLE_RETRIES;

  // 其餘 4xx:權限、驗證、找不到 —— 重試一百次也一樣。
  if (status >= 400 && status < 500) return false;

  // 5xx 與網路錯誤:給一次機會。
  return failureCount < 1;
}
