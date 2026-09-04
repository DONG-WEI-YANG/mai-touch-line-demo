/**
 * 加好友連結的來源。
 *
 * 原本只讀 LINE_BOT_BASIC_ID 環境變數 —— 沒設就沒有加好友 QR,展示情境 4 少一半。
 * 而這個值本來就能從 LINE API 問出來(伺服器已經有 channel access token),多一個
 * 要人記得設的環境變數本身就是缺陷:忘了設不會有任何錯誤,只是 QR 靜靜不見。
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  buildAddFriendUrl,
  resetLineBotIdentityCache,
  resolveAddFriendUrl,
} from "../../src/server/services/lineBotIdentity";

beforeEach(() => {
  resetLineBotIdentityCache();
});

describe("buildAddFriendUrl", () => {
  it("組出 LINE 的加好友連結", () => {
    expect(buildAddFriendUrl("@679ntrul")).toBe("https://line.me/R/ti/p/%40679ntrul");
  });

  it("基本 ID 沒有 @ 時補上 —— LINE 的連結需要它", () => {
    expect(buildAddFriendUrl("679ntrul")).toBe("https://line.me/R/ti/p/%40679ntrul");
  });

  it("空值回 null,不給客戶掃一個壞的碼", () => {
    expect(buildAddFriendUrl("")).toBeNull();
    expect(buildAddFriendUrl(null)).toBeNull();
    expect(buildAddFriendUrl(undefined)).toBeNull();
    expect(buildAddFriendUrl("   ")).toBeNull();
  });
});

describe("resolveAddFriendUrl", () => {
  it("環境變數有設就直接用,不打 LINE API", async () => {
    const fetchBotInfo = vi.fn();
    const url = await resolveAddFriendUrl({ envBasicId: "@abc", fetchBotInfo });
    expect(url).toBe("https://line.me/R/ti/p/%40abc");
    expect(fetchBotInfo).not.toHaveBeenCalled();
  });

  it("環境變數沒設時向 LINE API 問", async () => {
    const fetchBotInfo = vi.fn().mockResolvedValue({ basicId: "@679ntrul" });
    const url = await resolveAddFriendUrl({ envBasicId: "", fetchBotInfo });
    expect(url).toBe("https://line.me/R/ti/p/%40679ntrul");
    expect(fetchBotInfo).toHaveBeenCalledTimes(1);
  });

  it("問到的結果會快取 —— 基本 ID 不會變,不必每次開畫面都打一次", async () => {
    const fetchBotInfo = vi.fn().mockResolvedValue({ basicId: "@679ntrul" });
    await resolveAddFriendUrl({ envBasicId: "", fetchBotInfo });
    await resolveAddFriendUrl({ envBasicId: "", fetchBotInfo });
    expect(fetchBotInfo).toHaveBeenCalledTimes(1);
  });

  it("LINE API 失敗時回 null,不丟例外把整個展示頁弄壞", async () => {
    const fetchBotInfo = vi.fn().mockRejectedValue(new Error("401 unauthorized"));
    await expect(resolveAddFriendUrl({ envBasicId: "", fetchBotInfo })).resolves.toBeNull();
  });

  it("失敗不會被永久快取 —— 之後恢復了要問得到", async () => {
    const fetchBotInfo = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ basicId: "@later" });
    expect(await resolveAddFriendUrl({ envBasicId: "", fetchBotInfo })).toBeNull();
    expect(await resolveAddFriendUrl({ envBasicId: "", fetchBotInfo })).toBe(
      "https://line.me/R/ti/p/%40later",
    );
  });

  it("API 回應裡沒有 basicId 時回 null", async () => {
    const fetchBotInfo = vi.fn().mockResolvedValue({});
    expect(await resolveAddFriendUrl({ envBasicId: "", fetchBotInfo })).toBeNull();
  });

  it("沒有 token 也沒有環境變數時回 null,不會去打一個必定失敗的請求", async () => {
    const url = await resolveAddFriendUrl({ envBasicId: "", fetchBotInfo: undefined });
    expect(url).toBeNull();
  });
});
