/**
 * 智慧家庭摘要 —— 純函式,由真實設備狀態推導。
 *
 * 存在的理由是一個被移除的假資料:原本畫面寫死「22.5°C • Perfect Ambiance」,
 * 不論實際有沒有空調、開著還是關著。示範現場客戶把冷氣關掉、畫面還說
 * Perfect Ambiance,一次就砸了整套系統的可信度。
 *
 * 所以這裡的規則是:沒有空調就回 null,呼叫端不畫那張卡 —— 寧可少一張卡,
 * 不可編一個溫度。
 */
export type DeviceLike = {
  id: number;
  name: string;
  type: string;
  status: string;
};

export type DeviceSummary = {
  total: number;
  activeCount: number;
  /** 第一台空調的真實狀態;沒有空調時為 null。 */
  climate: { name: string; status: string } | null;
};

export function summarizeDevices(devices: DeviceLike[]): DeviceSummary {
  const climate = devices.find((device) => device.type === "climate") ?? null;
  return {
    total: devices.length,
    activeCount: devices.filter((device) => device.status !== "off").length,
    climate: climate ? { name: climate.name, status: climate.status } : null,
  };
}
