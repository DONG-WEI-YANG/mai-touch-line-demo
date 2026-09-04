/**
 * 角色路由策略 —— 純函式,不 import expo-router,所以可以被單測窮舉。
 *
 * 抽出來的原因:原本這段判斷埋在 _layout.tsx 的 useEffect 裡,規則是
 * 「pathname 以 /admin 開頭就放行管理員」。於是任何不叫 /admin* 的員工共用
 * 路由都會被靜靜彈回儀表板 —— 樣品屋展示模式 /showcase 就是這樣被擋掉的,
 * 而且只有在瀏覽器裡點過才會發現。
 */
export type AppRole = "resident" | "admin" | "logistics" | undefined;

/** 員工共用、不在各自 /admin* 或 /logistics* 前綴底下的路由。 */
const STAFF_SHARED_ROUTES = ["/showcase"];

export function landingForRole(role: AppRole): string {
  if (role === "admin") return "/admin-dashboard";
  if (role === "logistics") return "/logistics-dashboard";
  return "/";
}

/**
 * 該把使用者導去哪裡?回 null 表示留在原地。
 */
export function redirectTarget({
  role,
  pathname,
}: {
  role: AppRole;
  pathname: string;
}): string | null {
  if (!role) return pathname === "/login" ? null : "/login";

  if (pathname === "/login") return landingForRole(role);

  if (STAFF_SHARED_ROUTES.includes(pathname)) {
    // 員工共用路由;住戶沒有理由進來。
    return role === "resident" ? "/" : null;
  }

  if (role === "admin") {
    return pathname === "/admin-dashboard" || pathname.startsWith("/admin") ? null : "/admin-dashboard";
  }

  if (role === "logistics") {
    return pathname === "/logistics-dashboard" || pathname.startsWith("/logistics")
      ? null
      : "/logistics-dashboard";
  }

  // 住戶:管理與物流的頁面不開放。
  if (pathname.startsWith("/admin") || pathname.startsWith("/logistics")) return "/";
  return null;
}
