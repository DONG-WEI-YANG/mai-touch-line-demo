/**
 * LINE 官方帳號的加好友連結。
 *
 * 展示情境 4 需要一張加好友 QR 給客戶掃。原本這個連結只由 `LINE_BOT_BASIC_ID`
 * 環境變數決定 —— 沒設就沒有 QR,而且不會有任何錯誤,只是靜靜地少了一半的情境。
 * 實際踩到:生產環境 `line: ready` 但 `addFriendUrl: null`,現場才會發現。
 *
 * 這個值本來就能從 LINE 問出來(伺服器已經有 channel access token),所以改成
 * 「環境變數優先,沒有就問 LINE API」。少一個要人記得設的東西,就少一個上台前
 * 才發現的問題。
 */

/** 基本 ID 快取。它不會變,問到一次就夠;失敗不快取,恢復後要問得到。 */
let cachedBasicId: string | null = null;

export function resetLineBotIdentityCache(): void {
  cachedBasicId = null;
}

/**
 * 由基本 ID 組出加好友連結。空值回 null —— 拼不出正確連結時寧可不給,
 * 也不要讓客戶掃到一個開不起來的碼。
 */
export function buildAddFriendUrl(basicId: string | null | undefined): string | null {
  const trimmed = (basicId ?? "").trim();
  if (!trimmed) return null;
  // LINE 的 ti/p 連結需要 @ 前綴;有些地方會把它省略掉。
  const normalized = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  return `https://line.me/R/ti/p/${encodeURIComponent(normalized)}`;
}

export type BotInfo = { basicId?: string };

/**
 * 向 LINE 查詢 bot 身分。逾時 5 秒 —— 展示頁不該因為 LINE 慢而卡住。
 * 沒有 access token 時回 undefined,呼叫端據此完全不發請求。
 */
export function makeBotInfoFetcher(
  accessToken: string | undefined,
): (() => Promise<BotInfo>) | undefined {
  const token = (accessToken ?? "").trim();
  if (!token) return undefined;

  return async () => {
    const response = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      // 不要把 token 或回應內容寫進錯誤訊息。
      throw new Error(`LINE bot info failed (HTTP ${response.status})`);
    }
    return (await response.json()) as BotInfo;
  };
}

export async function resolveAddFriendUrl(deps: {
  envBasicId?: string;
  fetchBotInfo?: () => Promise<BotInfo>;
}): Promise<string | null> {
  const fromEnv = buildAddFriendUrl(deps.envBasicId);
  if (fromEnv) return fromEnv;

  if (cachedBasicId) return buildAddFriendUrl(cachedBasicId);
  if (!deps.fetchBotInfo) return null;

  try {
    const info = await deps.fetchBotInfo();
    const basicId = (info?.basicId ?? "").trim();
    if (!basicId) return null;
    cachedBasicId = basicId;
    return buildAddFriendUrl(basicId);
  } catch {
    // 查不到就沒有 QR —— 誠實地少一張圖,好過給一個掃不開的碼。不快取失敗。
    return null;
  }
}
