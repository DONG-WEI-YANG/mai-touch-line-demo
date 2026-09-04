/**
 * 展示模式重置的選取邏輯。
 *
 * 這是整個展示模式唯一會刪資料的地方,所以刻意抽成不碰 db 的純函式:
 * 「哪些該刪」可以被測試釘死,「怎麼刪」才交給 router。
 *
 * 設計原則是**保守失敗**:任何一項條件無法確定(住戶歸屬不明、時間戳壞掉、
 * 示範住戶解析不到),就保留該筆資料。留下垃圾只是畫面雜一點,誤刪正式資料
 * 是不可逆的。
 */

export type ShowcaseResetKind = "booking" | "workOrder";

export type ShowcaseResetCandidate = {
  kind: ShowcaseResetKind;
  id: number;
  userId?: number | null;
  createdAt?: unknown;
};

export type ShowcaseResetTarget = {
  kind: ShowcaseResetKind;
  id: number;
};

/**
 * 刪除範圍。
 *
 * `session`(預設)只清本場次 —— 保守,但上一場的紀錄會累積下來。
 * `all` 連先前場次一併清掉 —— 給「開新的一天」用,但同一台伺服器上若有同事
 * 正在演,他的場次也會被清掉。所以這是明示的選項,不是預設值,而且 UI 必須
 * 先把即將刪除的筆數顯示出來(見 countShowcaseResidue)。
 *
 * 兩者共同的硬性護欄:永遠只碰示範住戶,絕不因 scope 而鬆開。
 */
export type ShowcaseResetScope = "session" | "all";

export type ShowcaseResetPolicy = {
  /** 示範住戶 id。解析不到(undefined)時一律不刪。 */
  residentUserId: number | undefined;
  /** 本場次起始時間 ISO。scope 為 session 時無效值一律不刪。 */
  sessionStartedAt: string;
  /** 預設 session。 */
  scope?: ShowcaseResetScope;
};

export type ShowcaseResidue = {
  bookings: number;
  workOrders: number;
  total: number;
};

function toMillis(value: unknown): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/**
 * 選出可以安全刪除的紀錄。
 *
 * scope "session"(預設):兩道護欄必須同時成立 —— 屬於示範住戶,且產生於本場次。
 * scope "all":只保留「屬於示範住戶」那一道。
 */
export function selectShowcaseResetTargets(
  candidates: ShowcaseResetCandidate[],
  policy: ShowcaseResetPolicy,
): ShowcaseResetTarget[] {
  const { residentUserId } = policy;
  // 護欄一:示範住戶。這道在任何 scope 下都成立。
  if (residentUserId === undefined || residentUserId === null) return [];

  const scope = policy.scope ?? "session";
  const owned = candidates.filter((c) => c.userId === residentUserId);

  if (scope === "all") {
    // 深層重置刻意不看時間 —— 連時間戳壞掉的紀錄都要清得掉,否則它們會永遠
    // 卡在資料庫裡:本場次認不出它們,一般重置也就永遠碰不到。
    return owned.map((c) => ({ kind: c.kind, id: c.id }));
  }

  // 護欄二(僅 session):本場次。時間無法確定就保留。
  const boundary = toMillis(policy.sessionStartedAt);
  if (boundary === null) return [];

  const targets: ShowcaseResetTarget[] = [];
  for (const candidate of owned) {
    const createdAt = toMillis(candidate.createdAt);
    if (createdAt === null || createdAt < boundary) continue;
    targets.push({ kind: candidate.kind, id: candidate.id });
  }
  return targets;
}

/**
 * 數出「屬於示範住戶、但不屬於本場次」的紀錄 —— 也就是一般重置清不掉的殘留。
 *
 * 存在的理由是把破壞性動作的後果先攤開來:深層重置按下去會刪幾筆,按之前
 * 就要看得到。時間戳壞掉的紀錄也算殘留,因為本場次認不出它們。
 */
export function countShowcaseResidue(
  candidates: ShowcaseResetCandidate[],
  policy: ShowcaseResetPolicy,
): ShowcaseResidue {
  const { residentUserId } = policy;
  if (residentUserId === undefined || residentUserId === null) {
    return { bookings: 0, workOrders: 0, total: 0 };
  }

  const boundary = toMillis(policy.sessionStartedAt);
  let bookings = 0;
  let workOrders = 0;

  for (const candidate of candidates) {
    if (candidate.userId !== residentUserId) continue;
    const createdAt = toMillis(candidate.createdAt);
    const inThisSession = boundary !== null && createdAt !== null && createdAt >= boundary;
    if (inThisSession) continue;
    if (candidate.kind === "booking") bookings += 1;
    else workOrders += 1;
  }

  return { bookings, workOrders, total: bookings + workOrders };
}
