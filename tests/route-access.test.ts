/**
 * 角色路由策略。
 *
 * 原本這段邏輯埋在 _layout.tsx 的 useEffect 裡,判斷式是「pathname 以 /admin
 * 開頭就放行」—— 於是任何不叫 /admin* 的員工共用路由(例如樣品屋展示模式
 * /showcase)都會被彈回儀表板,而且只有在瀏覽器裡點過才會發現。
 */
import { describe, expect, it } from "vitest";

import { landingForRole, redirectTarget } from "../src/lib/route-access";

describe("landingForRole", () => {
  it("各角色有各自的著陸頁", () => {
    expect(landingForRole("admin")).toBe("/admin-dashboard");
    expect(landingForRole("logistics")).toBe("/logistics-dashboard");
    expect(landingForRole("resident")).toBe("/");
    expect(landingForRole(undefined)).toBe("/");
  });
});

describe("redirectTarget", () => {
  it("未登入一律導向登入頁", () => {
    expect(redirectTarget({ role: undefined, pathname: "/" })).toBe("/login");
    expect(redirectTarget({ role: undefined, pathname: "/showcase" })).toBe("/login");
  });

  it("已登入時不停在登入頁", () => {
    expect(redirectTarget({ role: "admin", pathname: "/login" })).toBe("/admin-dashboard");
    expect(redirectTarget({ role: "resident", pathname: "/login" })).toBe("/");
  });

  it("管理員待在 /admin* 底下不動", () => {
    expect(redirectTarget({ role: "admin", pathname: "/admin-dashboard" })).toBeNull();
    expect(redirectTarget({ role: "admin", pathname: "/admin/bookings" })).toBeNull();
  });

  it("管理員闖進住戶頁會被帶回儀表板", () => {
    expect(redirectTarget({ role: "admin", pathname: "/wallet" })).toBe("/admin-dashboard");
  });

  it("展示模式對管理員與物流都放行 —— 它是員工共用路由", () => {
    expect(redirectTarget({ role: "admin", pathname: "/showcase" })).toBeNull();
    expect(redirectTarget({ role: "logistics", pathname: "/showcase" })).toBeNull();
  });

  it("住戶進不了展示模式", () => {
    expect(redirectTarget({ role: "resident", pathname: "/showcase" })).toBe("/");
  });

  it("物流待在 /logistics* 底下不動", () => {
    expect(redirectTarget({ role: "logistics", pathname: "/logistics-dashboard" })).toBeNull();
  });

  it("住戶在自己的頁面自由移動", () => {
    for (const path of ["/", "/wallet", "/my-bookings", "/voice-booking"]) {
      expect(redirectTarget({ role: "resident", pathname: path })).toBeNull();
    }
  });

  it("住戶闖進管理頁會被帶回首頁", () => {
    expect(redirectTarget({ role: "resident", pathname: "/admin/bookings" })).toBe("/");
  });
});
