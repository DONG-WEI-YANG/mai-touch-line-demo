/**
 * 樣品屋展示模式的伺服端門面。
 *
 * 刻意不含任何領域邏輯 —— 語音走 voice.staffCommand / staffCommit,設備走
 * iot.updateDevice,LINE 走 lineAdmin.scriptRun。這個 router 只負責展示頁自己
 * 需要的三件事:描述場次、聚合管理中心事件流、清掉本場次的痕跡。
 *
 * 全部 staffProcedure:接待中心平板以管理端身分登入,代示範住戶動作。
 * See docs/superpowers/specs/2026-09-05-showcase-mode-design.md
 */
import { z } from "zod";

import { router, staffProcedure } from "../_core/trpc";
import * as db from "../db";
import { hardwareGatewayService } from "../services/hardwareGatewayService";
import {
  countShowcaseResidue,
  selectShowcaseResetTargets,
  type ShowcaseResetCandidate,
} from "../services/showcaseReset";
import {
  SHOWCASE_RESIDENT_EMAIL,
  describeShowcaseHardware,
  showcaseSessionService,
} from "../services/showcaseSession";
import { buildShowcaseTimeline } from "../services/showcaseTimeline";
import { voiceAuditService } from "../services/voiceAuditService";

type ShowcaseResident = { id: number; name: string; unitNumber: string | null; unitId: number | null };

/**
 * 以固定 email 解析示範住戶。找不到就回 null —— 展示頁據此顯示「請先建立示範資料」。
 *
 * 兩段式查詢是必要的:getUserByEmail 只是 `SELECT * FROM users`,不 join units,
 * 所以拿不到房號;房號只有 getUserById 的 leftJoin 才有。平板頂端要顯示
 * 「代 王小姐 · A8-1」,少了房號業務就少一句可講的話。
 */
async function resolveResident(): Promise<ShowcaseResident | null> {
  const found = await db.getUserByEmail(SHOWCASE_RESIDENT_EMAIL);
  if (!found) return null;

  const withUnit = await db.getUserById(found.id as number);
  const user = withUnit ?? found;
  const unitNumber = (user as { unitNumber?: string | null }).unitNumber ?? null;

  return {
    id: found.id as number,
    name: (user.name ?? "示範住戶") as string,
    // getUserById 查無單位時回傳字串 "Unassigned",對展示頁而言等同沒有房號。
    unitNumber: unitNumber && unitNumber !== "Unassigned" ? unitNumber : null,
    unitId: ((user as { unitId?: number | null }).unitId ?? null) as number | null,
  };
}

/** 把預約與工單攤平成刪除/計數用的候選清單。 */
async function resetCandidates(): Promise<ShowcaseResetCandidate[]> {
  const [bookings, workOrders] = await Promise.all([db.getAllBookings(), db.getAllWorkOrders()]);
  return [
    ...(bookings as Array<Record<string, unknown>>).map((b) => ({
      kind: "booking" as const,
      id: b.id as number,
      userId: b.userId as number,
      createdAt: b.createdAt,
    })),
    ...(workOrders as Array<Record<string, unknown>>).map((w) => ({
      kind: "workOrder" as const,
      id: w.id as number,
      userId: w.userId as number,
      createdAt: w.createdAt,
    })),
  ];
}

async function amenityNames(): Promise<Map<number, string>> {
  const rows = await db.getAllAmenities();
  const map = new Map<number, string>();
  for (const row of rows as Array<{ id: number; name?: string | null }>) {
    if (row?.id != null) map.set(row.id, row.name ?? "");
  }
  return map;
}

export const showcaseRouter = router({
  /** 場次概況:何時開場、代哪一戶、現場設備是真是假、LINE 推得出去嗎。 */
  session: staffProcedure.query(async ({ ctx }) => {
    const resident = await resolveResident();
    const hardware = describeShowcaseHardware(hardwareGatewayService.getHealthInfo());
    // LINE 情境不容降級演出 —— 推不出去就是推不出去,寧可擋下也不演假畫面。
    const lineConfigured = Boolean(ctx.lineAdmin);
    const startedAt = showcaseSessionService.getStartedAt();
    // 先前場次留下、一般重置清不掉的紀錄。攤在畫面上,深層重置才不是盲按。
    const residue = resident
      ? countShowcaseResidue(await resetCandidates(), {
          residentUserId: resident.id,
          sessionStartedAt: startedAt,
        })
      : { bookings: 0, workOrders: 0, total: 0 };
    return {
      residue,
      startedAt: showcaseSessionService.getStartedAt(),
      resident: resident
        ? { id: resident.id, name: resident.name, unitNumber: resident.unitNumber }
        : null,
      hardware,
      line: { configured: lineConfigured },
      ready: resident !== null,
      blockedReason: resident
        ? undefined
        : `尚未建立示範住戶(${SHOWCASE_RESIDENT_EMAIL}),請先執行 npm run seed:showcase`,
    };
  }),

  /** 管理中心事件流。展示頁輪詢這支,讓客戶看見自己的話變成系統動作。 */
  timeline: staffProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(40) }).partial().optional())
    .query(async ({ input }) => {
      const resident = await resolveResident();
      if (!resident) return { events: [], startedAt: showcaseSessionService.getStartedAt() };

      const [bookings, workOrders, names] = await Promise.all([
        db.getAllBookings(),
        db.getAllWorkOrders(),
        amenityNames(),
      ]);

      const events = buildShowcaseTimeline(
        {
          bookings: (bookings as Array<Record<string, unknown>>).map((b) => ({
            id: b.id as number,
            userId: b.userId as number,
            amenityName: names.get(b.amenityId as number) ?? null,
            date: (b.date ?? null) as string | null,
            startTime: (b.startTime ?? null) as string | null,
            endTime: (b.endTime ?? null) as string | null,
            status: (b.status ?? null) as string | null,
            createdAt: b.createdAt,
          })),
          workOrders: (workOrders as Array<Record<string, unknown>>).map((w) => ({
            id: w.id as number,
            userId: w.userId as number,
            title: (w.title ?? null) as string | null,
            category: (w.category ?? null) as string | null,
            priority: (w.priority ?? null) as string | null,
            status: (w.status ?? null) as string | null,
            assignedTo: (w.assignedTo ?? null) as string | null,
            createdAt: w.createdAt,
          })),
          voiceAudit: voiceAuditService.getHistory(100),
        },
        {
          since: showcaseSessionService.getStartedAt(),
          residentUserId: resident.id,
          limit: input?.limit ?? 40,
        },
      );

      return { events, startedAt: showcaseSessionService.getStartedAt() };
    }),

  /** 示範住戶家中的設備,附帶「這是真是假」的誠實標示。 */
  devices: staffProcedure.query(async () => {
    const resident = await resolveResident();
    const hardware = describeShowcaseHardware(hardwareGatewayService.getHealthInfo());
    if (!resident?.unitId) return { devices: [], hardware };
    const devices = await db.getDevicesByUnit(resident.unitId);
    return { devices, hardware };
  }),

  /**
   * 清掉本場次的痕跡,讓下一組客戶從乾淨畫面開始。
   *
   * 破壞範圍由 selectShowcaseResetTargets 的兩道護欄決定(示範住戶 + 本場次),
   * 這裡只負責執行與計數。刪完把場次邊界推到現在。
   */
  reset: staffProcedure
    .input(z.object({ scope: z.enum(["session", "all"]).default("session") }).optional())
    .mutation(async ({ input }) => {
    const scope = input?.scope ?? "session";
    const resident = await resolveResident();
    const startedAt = showcaseSessionService.getStartedAt();

    const candidates: ShowcaseResetCandidate[] = await resetCandidates();

    const targets = selectShowcaseResetTargets(candidates, {
      residentUserId: resident?.id,
      sessionStartedAt: startedAt,
      scope,
    });

    let removedBookings = 0;
    let removedWorkOrders = 0;
    for (const target of targets) {
      if (target.kind === "booking") {
        await db.deleteBooking(target.id);
        removedBookings += 1;
      } else {
        await db.deleteWorkOrder(target.id);
        removedWorkOrders += 1;
      }
    }

    // 語音稽核是記憶體 ring buffer。深層重置要連先前場次的也清掉,所以把邊界
    // 推到 epoch;一般重置只清本場次。
    const voiceBoundary = scope === "all" ? new Date(0).toISOString() : startedAt;
    const voiceEvents = resident
      ? voiceAuditService.clearSince(voiceBoundary, { targetUserId: resident.id })
      : 0;

    const newStartedAt = showcaseSessionService.restart();

    return {
      scope,
      removed: { bookings: removedBookings, workOrders: removedWorkOrders, voiceEvents },
      startedAt: newStartedAt,
    };
  }),
});
