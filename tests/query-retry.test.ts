/**
 * 全域查詢重試政策。
 *
 * 原本是「4xx 一律不重試」—— 用意是止住 403 洗版(管理員在角色導向前短暫打到
 * 住戶專用 procedure)。但 429 也是 4xx,而它恰恰是最該重試的一種:限流視窗
 * 過去就好了。展示模式的時間軸輪詢撞到限流時會靜靜停住,畫面就凍在那裡。
 */
import { describe, expect, it } from "vitest";

import { shouldRetryQuery } from "../src/lib/query-retry";

const err = (status: number) => ({ data: { httpStatus: status } });

describe("shouldRetryQuery", () => {
  it("429 會重試 —— 限流是暫時的", () => {
    expect(shouldRetryQuery(0, err(429))).toBe(true);
    expect(shouldRetryQuery(1, err(429))).toBe(true);
  });

  it("429 的重試次數仍有上限,不會無限打", () => {
    expect(shouldRetryQuery(10, err(429))).toBe(false);
  });

  it("403 / 401 不重試 —— 權限不會自己變好", () => {
    expect(shouldRetryQuery(0, err(403))).toBe(false);
    expect(shouldRetryQuery(0, err(401))).toBe(false);
  });

  it("400 / 404 不重試", () => {
    expect(shouldRetryQuery(0, err(400))).toBe(false);
    expect(shouldRetryQuery(0, err(404))).toBe(false);
  });

  it("5xx 重試一次", () => {
    expect(shouldRetryQuery(0, err(503))).toBe(true);
    expect(shouldRetryQuery(1, err(503))).toBe(false);
  });

  it("網路錯誤(無狀態碼)重試一次", () => {
    expect(shouldRetryQuery(0, new Error("Failed to fetch"))).toBe(true);
    expect(shouldRetryQuery(1, null)).toBe(false);
  });
});
