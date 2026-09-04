/**
 * 認證閘門:把「查不出你是誰」和「你沒登入」分開。
 *
 * 原本 auth.me 設 retry:false,任何錯誤都讓 user 變成 null,守衛就把人踢到
 * /login。於是伺服器回 429(限流)、500、或網路抖一下,使用者就會莫名被登出
 * —— 在樣品屋展示到一半時,畫面會當著客戶的面跳回登入頁。
 *
 * 正確的保守做法:只有伺服器明確說「這個身分不成立」(401/403)才視為未登入;
 * 其餘一律是「暫時查不出來」,留在原畫面重試。
 */
import { describe, expect, it } from "vitest";

import {
  authGate,
  classifyAuthFailure,
  shouldBlockOnAuthLoading,
  shouldRetryAuth,
} from "../src/lib/auth-gate";

const err = (status: number | null, message = "") => ({
  data: status === null ? {} : { httpStatus: status },
  message,
});

describe("classifyAuthFailure", () => {
  it("401 / 403 是明確的未登入", () => {
    expect(classifyAuthFailure(err(401))).toBe("unauthenticated");
    expect(classifyAuthFailure(err(403))).toBe("unauthenticated");
  });

  it("429 是查不出來,不是未登入", () => {
    expect(classifyAuthFailure(err(429))).toBe("indeterminate");
  });

  it("5xx 是查不出來", () => {
    expect(classifyAuthFailure(err(500))).toBe("indeterminate");
    expect(classifyAuthFailure(err(502))).toBe("indeterminate");
    expect(classifyAuthFailure(err(503))).toBe("indeterminate");
  });

  it("網路錯誤(沒有 HTTP 狀態)是查不出來", () => {
    expect(classifyAuthFailure(err(null, "Failed to fetch"))).toBe("indeterminate");
    expect(classifyAuthFailure(new Error("Network request failed"))).toBe("indeterminate");
    expect(classifyAuthFailure(null)).toBe("indeterminate");
  });

  it("其他 4xx 保守地當作查不出來,不主動登出使用者", () => {
    expect(classifyAuthFailure(err(400))).toBe("indeterminate");
    expect(classifyAuthFailure(err(404))).toBe("indeterminate");
  });
});

describe("shouldRetryAuth", () => {
  it("暫時性錯誤會重試,但有次數上限", () => {
    expect(shouldRetryAuth(0, err(429))).toBe(true);
    expect(shouldRetryAuth(2, err(500))).toBe(true);
    expect(shouldRetryAuth(99, err(429))).toBe(false);
  });

  it("明確未登入時不重試 —— 重試一百次也還是沒登入", () => {
    expect(shouldRetryAuth(0, err(401))).toBe(false);
    expect(shouldRetryAuth(0, err(403))).toBe(false);
  });
});

describe("authGate", () => {
  const base = { isLoading: false, user: null, error: null, hasToken: true, pathname: "/showcase" };

  it("查詢進行中就等,不做任何跳轉", () => {
    expect(authGate({ ...base, isLoading: true })).toEqual({ action: "wait" });
  });

  it("認證成功後交給角色路由策略", () => {
    expect(authGate({ ...base, user: { role: "admin" } })).toEqual({ action: "allow" });
    expect(authGate({ ...base, user: { role: "resident" } })).toEqual({
      action: "redirect",
      target: "/",
    });
  });

  it("429 且本機有 token —— 留在原畫面,絕不踢回登入頁", () => {
    const decision = authGate({ ...base, error: err(429) });
    expect(decision.action).toBe("stay");
  });

  it("伺服器 500 同樣留在原畫面", () => {
    expect(authGate({ ...base, error: err(503) }).action).toBe("stay");
  });

  it("401 才是真的登出", () => {
    expect(authGate({ ...base, error: err(401) })).toEqual({
      action: "redirect",
      target: "/login",
    });
  });

  it("本機根本沒有 token 時,查不出來就是沒登入", () => {
    // 沒有憑證可驗,留在原畫面只會是一片空白 —— 這種情況導向登入頁才對。
    expect(authGate({ ...base, error: err(429), hasToken: false })).toEqual({
      action: "redirect",
      target: "/login",
    });
  });

  it("沒有錯誤也沒有使用者 = 未登入", () => {
    expect(authGate({ ...base, user: null, error: null })).toEqual({
      action: "redirect",
      target: "/login",
    });
  });

  it("已經在登入頁時不再重複導向", () => {
    expect(authGate({ ...base, pathname: "/login", user: null })).toEqual({ action: "allow" });
  });

  it("暫時性錯誤發生在登入頁時也不做事", () => {
    expect(authGate({ ...base, pathname: "/login", error: err(429) }).action).toBe("allow");
  });
});


describe("shouldBlockOnAuthLoading", () => {
  it("本機有 token 時不擋畫面 —— 直接渲染,讓路由與深連結留著", () => {
    // 重試會把 isLoading 拉長到十幾秒。若這段期間不渲染 navigator,使用者會盯著
    // 一片灰色 Loading,而且原本要去的 /showcase 也會掉回首頁。
    expect(shouldBlockOnAuthLoading({ isLoading: true, hasToken: true })).toBe(false);
  });

  it("完全沒有 token 的冷啟動才顯示整頁載入", () => {
    expect(shouldBlockOnAuthLoading({ isLoading: true, hasToken: false })).toBe(true);
  });

  it("查詢結束後一律不擋", () => {
    expect(shouldBlockOnAuthLoading({ isLoading: false, hasToken: false })).toBe(false);
    expect(shouldBlockOnAuthLoading({ isLoading: false, hasToken: true })).toBe(false);
  });
});
