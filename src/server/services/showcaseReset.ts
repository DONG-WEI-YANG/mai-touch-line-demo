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

export type ShowcaseResetPolicy = {
  /** 示範住戶 id。解析不到(undefined)時一律不刪。 */
  residentUserId: number | undefined;
  /** 本場次起始時間 ISO。無效時一律不刪。 */
  sessionStartedAt: string;
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
 * 選出可以安全刪除的紀錄。兩道護欄必須同時成立:屬於示範住戶,且產生於本場次。
 */
export function selectShowcaseResetTargets(
  candidates: ShowcaseResetCandidate[],
  policy: ShowcaseResetPolicy,
): ShowcaseResetTarget[] {
  const { residentUserId } = policy;
  if (residentUserId === undefined || residentUserId === null) return [];

  const boundary = toMillis(policy.sessionStartedAt);
  if (boundary === null) return [];

  const targets: ShowcaseResetTarget[] = [];
  for (const candidate of candidates) {
    if (candidate.userId !== residentUserId) continue;
    const createdAt = toMillis(candidate.createdAt);
    if (createdAt === null || createdAt < boundary) continue;
    targets.push({ kind: candidate.kind, id: candidate.id });
  }
  return targets;
}
