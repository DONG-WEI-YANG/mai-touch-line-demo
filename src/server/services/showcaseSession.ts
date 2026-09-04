/**
 * 樣品屋展示場次。
 *
 * 兩個職責:
 *  1. 記住「這一場」從何時開始 —— `showcase.reset` 的時間護欄,只清這條線之後
 *     產生的紀錄,絕不回頭碰正式資料。
 *  2. 誠實描述硬體連線狀態 —— 樣品屋現場多半還沒接真設備,展示頁必須明示
 *     「模擬設備」。沿用本專案既有原則:絕不把未驗證的健康狀態報成成功。
 */
import type { HardwareGatewayHealthInfo } from "./hardwareGatewayService";

/** 示範住戶的固定識別。seed 與 reset 共用這一個常數,不靠 id 硬編碼。 */
export const SHOWCASE_RESIDENT_EMAIL = "showcase.resident@demo.local";

export type ShowcaseHardwareStatus = {
  connected: boolean;
  label: "已連線" | "模擬設備";
  reason: string;
};

/**
 * 只有「閘道位址已設定 + 非空跑 + 轉接器解析得出來」三者同時成立才算已連線。
 * 任何一項不確定就退回模擬 —— 寧可低報,不可虛報。
 */
export function describeShowcaseHardware(
  health: HardwareGatewayHealthInfo | null | undefined,
): ShowcaseHardwareStatus {
  const simulated = (reason: string): ShowcaseHardwareStatus => ({
    connected: false,
    label: "模擬設備",
    reason,
  });

  if (!health?.config) {
    return simulated("尚未取得硬體閘道狀態,畫面上的設備僅為系統內狀態");
  }
  const { baseUrlConfigured, dryRun, adapterResolved } = health.config;
  if (!baseUrlConfigured) {
    return simulated("尚未設定硬體閘道位址,設備狀態僅存在系統內,現場燈具不會動作");
  }
  if (dryRun) {
    return simulated("硬體閘道為空跑模式,指令不會送到現場設備");
  }
  if (!adapterResolved) {
    return simulated("硬體通訊協定尚未解析成功,指令不會送到現場設備");
  }
  return {
    connected: true,
    label: "已連線",
    reason: "指令會實際送到現場設備",
  };
}

type Deps = { now?: () => Date };

export class ShowcaseSessionService {
  private readonly now: () => Date;
  private startedAt: string;

  constructor(deps: Deps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.startedAt = this.now().toISOString();
  }

  getStartedAt(): string {
    return this.startedAt;
  }

  /** 重新開場:把重置的時間護欄推到現在,讓下一場從乾淨的視窗開始。 */
  restart(): string {
    this.startedAt = this.now().toISOString();
    return this.startedAt;
  }
}

export const showcaseSessionService = new ShowcaseSessionService();
