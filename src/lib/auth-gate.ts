/**
 * 認證閘門 —— 把「查不出你是誰」和「你沒登入」分開。
 *
 * 原本 `auth.me` 設 `retry: false`,任何錯誤都讓 user 變成 null,角色守衛就把人
 * 踢到 /login。於是伺服器回 429(限流)、5xx、或網路抖一下,使用者就會莫名被
 * 登出 —— 在樣品屋展示到一半時,畫面會當著客戶的面跳回登入頁。
 *
 * 這裡的原則與 showcaseReset 的刪除護欄一致:**不確定時採取保守行為**。
 * 只有伺服器明確說「這個身分不成立」才登出;其餘一律留在原畫面重試。
 */
import { redirectTarget, type AppRole } from "./route-access";

export type AuthFailureKind = "unauthenticated" | "indeterminate";

/** 重試上限 —— 展示現場的限流視窗通常幾十秒內就會鬆開。 */
const MAX_AUTH_RETRIES = 4;

function httpStatusOf(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { httpStatus?: unknown } }).data;
  const status = data?.httpStatus;
  return typeof status === "number" ? status : null;
}

/**
 * 這個錯誤代表「身分不成立」還是「暫時查不出來」?
 *
 * 刻意只把 401/403 當作未登入。其他 4xx(含 429)、5xx、網路錯誤全部歸為
 * 查不出來 —— 把不確定當成否定,代價是把已登入的使用者踢出去。
 */
export function classifyAuthFailure(error: unknown): AuthFailureKind {
  const status = httpStatusOf(error);
  if (status === 401 || status === 403) return "unauthenticated";
  return "indeterminate";
}

/** React Query 的 retry 判斷:暫時性錯誤才重試,且有次數上限。 */
export function shouldRetryAuth(failureCount: number, error: unknown): boolean {
  if (classifyAuthFailure(error) === "unauthenticated") return false;
  return failureCount < MAX_AUTH_RETRIES;
}

export type AuthGateInput = {
  isLoading: boolean;
  user: { role?: string } | null | undefined;
  error: unknown;
  /** 本機是否存有 token。沒有憑證可驗時,「查不出來」等同沒登入。 */
  hasToken: boolean;
  pathname: string;
};

export type AuthGateDecision =
  | { action: "wait" }
  | { action: "allow" }
  | { action: "stay"; reason: string }
  | { action: "redirect"; target: string };

export function authGate(input: AuthGateInput): AuthGateDecision {
  const { isLoading, user, error, hasToken, pathname } = input;

  if (isLoading) return { action: "wait" };

  if (user) {
    const target = redirectTarget({ role: user.role as AppRole, pathname });
    return target && target !== pathname
      ? { action: "redirect", target }
      : { action: "allow" };
  }

  // 已經在登入頁了,沒有別的地方好去。
  if (pathname === "/login") return { action: "allow" };

  if (error) {
    const kind = classifyAuthFailure(error);
    if (kind === "indeterminate" && hasToken) {
      // 有憑證但一時驗不了 —— 留在原畫面,別在客戶面前跳回登入頁。
      return { action: "stay", reason: "連線不穩,正在重新確認登入狀態" };
    }
  }

  return { action: "redirect", target: "/login" };
}

/**
 * 要不要用整頁的「Loading…」擋住畫面?
 *
 * 幾乎都不要。重試把 auth.me 的 isLoading 拉長到十幾秒,這段期間若不渲染
 * navigator,使用者會盯著一片灰色,而且深連結(例如直接開 /showcase)會在
 * navigator 掛載時掉回首頁 —— 展示現場重新整理一次就跑掉了。
 *
 * 只有「完全沒有 token 的冷啟動」才擋:那種情況沒有路由值得保留,而且終點
 * 多半就是登入頁。
 */
export function shouldBlockOnAuthLoading(input: {
  isLoading: boolean;
  hasToken: boolean;
}): boolean {
  return input.isLoading && !input.hasToken;
}
