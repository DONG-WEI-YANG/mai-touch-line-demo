/**
 * 樣品屋展示模式的四個情境。
 *
 * 對齊《智慧宅分階段導入規劃》階段 1「客戶／住戶會看到什麼」的四張卡。
 * 純資料 + 純函式,不 import React Native —— 展示頁的可執行性判定要能被單測
 * 釘死,而不是靠在客戶面前點一遍才發現演不出來。
 */

export type ShowcaseScenarioId =
  | "voice-booking"
  | "voice-device"
  | "mobile-handoff"
  | "line-push";

/** 情境的前置條件。 */
export type ShowcaseRequirement = "resident" | "hardware" | "line";

export type ShowcaseScenario = {
  id: ShowcaseScenarioId;
  /** 簡報上的標題,業務認得。 */
  title: string;
  /** 一句話講清楚客戶會感受到什麼。 */
  promise: string;
  /** 業務照著唸的話術。 */
  script: string;
  /** 客戶會看到的證據 —— 客戶問「這是真的嗎」時指給他看的東西。 */
  proof: string;
  /** 缺了就完全演不出來的條件。 */
  requires: ShowcaseRequirement[];
  /** 缺了還能演,但畫面必須誠實標示的條件。 */
  degradesWithout: ShowcaseRequirement[];
};

export const SHOWCASE_SCENARIOS: ShowcaseScenario[] = [
  {
    id: "voice-booking",
    title: "說一句話就訂到公設",
    promise: "客戶當場說完,管理室同步收到",
    script: "您對著這台平板說「幫我訂週六下午的健身房」就好,不用滑、不用找時段。",
    proof: "右側管理中心會即時跳出這筆預約與派出的工單 —— 這是真的寫進系統的紀錄。",
    requires: ["resident"],
    degradesWithout: [],
  },
  {
    id: "voice-device",
    title: "說一句話就開燈開冷氣",
    promise: "回到家不用找開關",
    script: "您說「打開客廳燈」「冷氣調到 26 度」,家裡就照做了。",
    proof: "設備狀態當場改變,管理中心也看得到這次操作。",
    requires: ["resident"],
    degradesWithout: ["hardware"],
  },
  {
    id: "mobile-handoff",
    title: "用自己的手機就能試",
    promise: "現場掃碼,回家路上還能繼續看",
    script: "掃這個碼,不用另外裝設備,您手機上就是同一套系統。",
    proof: "客戶手機上看到的預約,和這台平板上是同一筆。",
    requires: ["resident"],
    degradesWithout: [],
  },
  {
    id: "line-push",
    title: "加 LINE 就收得到社區訊息",
    promise: "長輩最熟悉的介面,不用學新東西",
    script: "公告、包裹到件都會推到 LINE,不必再開一個 App。",
    proof: "現場推一則示範公告,客戶的 LINE 當場收到。",
    requires: ["resident", "line"],
    degradesWithout: [],
  },
];

export type ShowcaseReadiness = {
  resident: boolean;
  hardware: boolean;
  line: boolean;
};

export type ShowcaseAvailability = {
  runnable: boolean;
  /** 演不出來的原因,顯示在情境卡上。 */
  blockedReason?: string;
  /** 演得出來但打了折扣,畫面必須誠實標示。 */
  degraded?: string;
};

const BLOCKED_REASON: Record<ShowcaseRequirement, string> = {
  resident: "尚未建立示範住戶,請先執行示範資料建置",
  hardware: "尚未連線現場硬體",
  line: "LINE 官方帳號尚未設定,無法推播,不以假畫面代替",
};

const DEGRADED_REASON: Record<ShowcaseRequirement, string> = {
  resident: "示範住戶缺席",
  hardware: "模擬設備:系統狀態會改變,但現場燈具不會動作",
  line: "LINE 未設定",
};

/**
 * 判定一個情境現在能不能演。
 *
 * 分界標準是「客戶看到的東西是不是真的發生了」:
 *  - 語音預約沒有硬體照樣是真的預約 → 照演
 *  - 語音開燈沒有硬體時燈不會亮,但系統狀態確實改變 → 照演,標示模擬設備
 *  - LINE 沒設定就推不出訊息,客戶手機不會響 → 擋下,絕不演假的
 */
export function scenarioAvailability(
  scenario: ShowcaseScenario,
  readiness: ShowcaseReadiness,
): ShowcaseAvailability {
  const missing = scenario.requires.filter((req) => !readiness[req]);
  if (missing.length > 0) {
    return { runnable: false, blockedReason: BLOCKED_REASON[missing[0]] };
  }

  const degradedBy = scenario.degradesWithout.filter((req) => !readiness[req]);
  if (degradedBy.length > 0) {
    return { runnable: true, degraded: DEGRADED_REASON[degradedBy[0]] };
  }

  return { runnable: true };
}

/**
 * 展示頁的全域阻擋訊息。
 *
 * 存在的理由是一個反覆出現的錯誤模式:**把「不知道」當成「否定」**。
 * 限流或斷線時 session 查詢會失敗,若沿用「尚未建立示範住戶」的訊息,業務會
 * 跑去執行一個根本不是問題的 seed 腳本,在客戶面前浪費時間。
 *
 * 回 null 代表沒有需要阻擋的理由(或還沒有足夠資訊下結論)。
 */
export function showcaseBlockReason(input: {
  sessionError: boolean;
  session: { ready: boolean; blockedReason?: string | null } | undefined;
}): string | null {
  if (input.sessionError) {
    return "連線異常,暫時取得不到展示狀態。系統會自動重試,請稍候再操作。";
  }
  if (!input.session) return null;
  if (input.session.ready) return null;
  return input.session.blockedReason ?? "展示模式尚未就緒";
}
