/**
 * 樣品屋示範資料的單一定義來源。
 *
 * 純資料,不碰 db —— scripts/seed-showcase.ts 負責寫入,測試負責驗證這份資料
 * 真的演得出四個情境(尤其是公設名稱要能被語音解析,見 buildFacilityMap)。
 *
 * 命名刻意用建案感的中文:業務在客戶面前唸出「頂樓恆溫泳池」和唸出
 * "Sky Infinity Pool" 是兩種產品。
 */
import { SHOWCASE_RESIDENT_EMAIL } from "./showcaseSession";

export const SHOWCASE_UNIT = {
  unitNumber: "A8-1",
  floor: 8,
  wing: "東翼",
  squareFootage: 2180,
} as const;

export const SHOWCASE_RESIDENT = {
  email: SHOWCASE_RESIDENT_EMAIL,
  openId: "showcase-resident",
  name: "王雅琳",
  role: "resident",
  tier: "Black",
} as const;

export type ShowcaseAmenitySeed = {
  name: string;
  category: "recreation" | "wellness" | "entertainment" | "business" | "dining" | "outdoor";
  capacity: number;
  openTime: string;
  closeTime: string;
  location: string;
};

/**
 * 六個公設。名稱必須能被 buildFacilityMap 解析成 gym / pool / lounge / bbq /
 * sauna / meeting_room,否則語音預約會當著客戶的面找不到對應公設。
 */
export const SHOWCASE_AMENITIES: ShowcaseAmenitySeed[] = [
  { name: "私人健身房", category: "wellness", capacity: 12, openTime: "06:00", closeTime: "23:00", location: "B1" },
  { name: "頂樓恆溫泳池", category: "recreation", capacity: 20, openTime: "07:00", closeTime: "22:00", location: "頂樓" },
  { name: "交誼廳", category: "entertainment", capacity: 30, openTime: "09:00", closeTime: "22:00", location: "2F" },
  { name: "燒烤露台", category: "outdoor", capacity: 16, openTime: "11:00", closeTime: "21:00", location: "頂樓" },
  { name: "三溫暖", category: "wellness", capacity: 8, openTime: "07:00", closeTime: "22:00", location: "B1" },
  { name: "會議室", category: "business", capacity: 10, openTime: "08:00", closeTime: "21:00", location: "3F" },
];

export type ShowcaseDeviceSeed = {
  name: string;
  type: "light" | "climate" | "curtain" | "security" | "media" | "power";
  status: string;
};

/** 樣品屋現場「說一句話就動起來」的那幾樣東西。 */
export const SHOWCASE_DEVICES: ShowcaseDeviceSeed[] = [
  { name: "客廳主燈", type: "light", status: "off" },
  { name: "主臥燈", type: "light", status: "off" },
  { name: "客廳空調", type: "climate", status: "off" },
  { name: "電動窗簾", type: "curtain", status: "off" },
  { name: "玄關門鎖", type: "security", status: "off" },
];
