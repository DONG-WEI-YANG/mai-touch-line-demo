/**
 * 展示模式「管理中心」事件流。
 *
 * 純函式,不碰 db、不碰時鐘 —— 呼叫端(showcase router)負責撈資料,這裡只負責
 * 把三種來源正規化成同一種事件、過濾出本場次本住戶的紀錄、依時間排序。
 *
 * 之所以要獨立成純函式:展示頁的右欄是整套簡報最關鍵的說服畫面(客戶說完話,
 * 管理室當場跳出工單),它的排序、去重、壞資料處理必須能被單測釘死,而不是
 * 埋在 router 裡靠人工點擊驗證。
 */

export type ShowcaseEventKind = "voice" | "booking" | "workOrder";
export type ShowcaseEventTone = "info" | "success" | "warning";

export type ShowcaseEvent = {
  /** `${kind}:${sourceId}` — 跨來源唯一,用來去重與當 React key。 */
  id: string;
  kind: ShowcaseEventKind;
  /** ISO 8601。 */
  at: string;
  title: string;
  detail?: string;
  tone: ShowcaseEventTone;
};

type Timestamped = { createdAt?: unknown; timestamp?: unknown };

export type ShowcaseBookingRow = Timestamped & {
  id: number;
  userId?: number | null;
  amenityName?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string | null;
};

export type ShowcaseWorkOrderRow = Timestamped & {
  id: number;
  userId?: number | null;
  title?: string | null;
  category?: string | null;
  priority?: string | null;
  status?: string | null;
  assignedTo?: string | null;
};

export type ShowcaseVoiceRow = Timestamped & {
  id: number;
  actorUserId?: number | null;
  targetUserId?: number | null;
  source?: string | null;
  phase?: string | null;
  intent?: string | null;
  outcome?: string | null;
  transcript?: string | null;
  ref?: string | null;
  error?: string | null;
};

export type ShowcaseTimelineSources = {
  bookings?: ShowcaseBookingRow[];
  workOrders?: ShowcaseWorkOrderRow[];
  voiceAudit?: ShowcaseVoiceRow[];
};

export type ShowcaseTimelineOptions = {
  /** 本場次起始時間;早於此的紀錄不顯示。省略則不做時間過濾。 */
  since?: string | Date;
  /** 示範住戶;其他住戶的紀錄不顯示。省略則不做身分過濾。 */
  residentUserId?: number;
  limit?: number;
};

/** 中文標籤 —— 業務要照著唸給客戶聽,所以不用 enum 原文。 */
const INTENT_LABEL: Record<string, string> = {
  "facility.book": "預約公設",
  "facility.cancel": "取消預約",
  "facility.list": "查詢公設",
  "repair.report": "報修",
  "visitor.notify": "訪客通知",
  "complaint.file": "反映問題",
  "workorder.status": "查詢進度",
};

const CATEGORY_LABEL: Record<string, string> = {
  maintenance: "維修",
  security: "保全",
  concierge: "禮賓",
  housekeeping: "清潔",
  laundry: "送洗",
  vehicle: "車輛",
  other: "其他",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "最速件",
  high: "急件",
  medium: "一般",
  low: "低",
};

/** 無法解析的時間戳回 null,呼叫端據此丟棄該筆 —— 一筆壞資料不該讓整個看板空白。 */
function toIso(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function eventTime(row: Timestamped): string | null {
  return toIso(row.createdAt ?? row.timestamp);
}

function bookingEvent(row: ShowcaseBookingRow): ShowcaseEvent | null {
  const at = eventTime(row);
  if (!at) return null;
  const facility = row.amenityName?.trim() || "公設";
  const when = [row.date, [row.startTime, row.endTime].filter(Boolean).join("–")]
    .filter(Boolean)
    .join(" ");
  return {
    id: `booking:${row.id}`,
    kind: "booking",
    at,
    title: `預約成立 · ${facility}`,
    detail: when || undefined,
    tone: row.status === "cancelled" ? "warning" : "success",
  };
}

/**
 * 剝掉工單標題開頭的內部意圖標記(commitVoiceProposal 會寫成 "[repair] 浴室漏水")。
 * 那是給後台看的分類前綴 —— 出現在接待中心的客戶面前只會像個沒做完的系統。
 * 只處理開頭,標題中間的方括號是人寫的內容,留著。
 */
function stripInternalPrefix(title: string): string {
  return title.replace(/^\s*\[[^\]]*\]\s*/, "").trim();
}

function workOrderEvent(row: ShowcaseWorkOrderRow): ShowcaseEvent | null {
  const at = eventTime(row);
  if (!at) return null;
  const category = CATEGORY_LABEL[row.category ?? ""] ?? row.category ?? "";
  const priority = PRIORITY_LABEL[row.priority ?? ""] ?? "";
  const detail = [
    row.assignedTo ? `派給 ${row.assignedTo}` : "待指派",
    priority,
  ]
    .filter(Boolean)
    .join(" · ");
  const label = row.title ? stripInternalPrefix(row.title) : "";
  return {
    id: `workOrder:${row.id}`,
    kind: "workOrder",
    at,
    title: `工單派出${category ? ` · ${category}` : ""}${label ? `:${label}` : ""}`,
    detail: detail || undefined,
    tone: row.priority === "urgent" || row.priority === "high" ? "warning" : "info",
  };
}

function voiceEvent(row: ShowcaseVoiceRow): ShowcaseEvent | null {
  const at = eventTime(row);
  if (!at) return null;
  const intent = INTENT_LABEL[row.intent ?? ""] ?? row.intent ?? "語音指令";
  const heading = row.phase === "commit" ? "語音確認" : "收到語音";
  const detail = row.error?.trim() || row.transcript?.trim() || row.ref?.trim() || undefined;
  const tone: ShowcaseEventTone =
    row.outcome === "rejected" || row.outcome === "unclear"
      ? "warning"
      : row.outcome === "committed"
        ? "success"
        : "info";
  return {
    id: `voice:${row.id}`,
    kind: "voice",
    at,
    title: `${heading} · ${intent}`,
    detail,
    tone,
  };
}

/**
 * 把三種來源併成一條事件流。
 *
 * 過濾順序刻意是「先比對身分、再比對時間、最後排序」—— 身分是硬性護欄
 * (絕不顯示其他住戶的資料),時間只是場次視窗。
 */
export function buildShowcaseTimeline(
  sources: ShowcaseTimelineSources,
  options: ShowcaseTimelineOptions = {},
): ShowcaseEvent[] {
  const sinceMs = options.since ? new Date(options.since).getTime() : null;
  const boundary = sinceMs !== null && !Number.isNaN(sinceMs) ? sinceMs : null;
  const resident = options.residentUserId;

  const owns = (rowUserId: number | null | undefined): boolean =>
    resident === undefined || rowUserId === resident;

  const collected: ShowcaseEvent[] = [];

  for (const row of sources.bookings ?? []) {
    if (!owns(row.userId)) continue;
    const event = bookingEvent(row);
    if (event) collected.push(event);
  }
  for (const row of sources.workOrders ?? []) {
    if (!owns(row.userId)) continue;
    const event = workOrderEvent(row);
    if (event) collected.push(event);
  }
  for (const row of sources.voiceAudit ?? []) {
    // 員工代住戶操作時,擁有者是 targetUserId 而非按下麥克風的 actorUserId。
    if (!owns(row.targetUserId ?? row.actorUserId)) continue;
    const event = voiceEvent(row);
    if (event) collected.push(event);
  }

  const seen = new Set<string>();
  const deduped: ShowcaseEvent[] = [];
  for (const event of collected) {
    if (seen.has(event.id)) continue;
    if (boundary !== null && new Date(event.at).getTime() < boundary) continue;
    seen.add(event.id);
    deduped.push(event);
  }

  deduped.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const limit = options.limit;
  return limit && limit > 0 ? deduped.slice(0, limit) : deduped;
}
