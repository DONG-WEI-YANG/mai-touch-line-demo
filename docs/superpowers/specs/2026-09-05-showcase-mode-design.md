# 樣品屋展示模式（Showcase Mode）設計

> 對應《智慧宅分階段導入規劃》**階段 1 · 樣品屋開賣**。
> 目標讀者：實作者。目標使用者：接待中心的銷售／代銷人員。

## 問題

階段 1 的銷售承諾是四個畫面：說一句話訂到公設（且管理室同步收到）、說一句話開燈開冷氣、
客戶用自己手機掃碼試用、加 LINE 收得到社區訊息。

系統其實已經做得到這四件事，但**分散在四個不同的畫面與兩種身分**：
`voice-booking.tsx`（住戶身分）、`smart-home.tsx`（住戶身分）、`admin/work-orders.tsx`（管理身分）、
`admin/line/scripts.tsx`（管理身分）。業務要在客戶面前演完，必須切換登入身分、在四個頁面之間跳。

最關鍵的說服瞬間 ——「客戶說完話，管理室當場跳出工單」—— 現在**無法在同一個視野裡呈現**。

## 目標

1. 一台接待中心平板、一個身分登入，從頭演到尾。
2. 客戶問「這是真的嗎」時業務答得出來：所有動作寫入正式資料表，走正式 router。
3. 演完可一鍵回復乾淨，不汙染正式資料。
4. 視覺與《分階段導入規劃》《系統方案規劃》兩份簡報同一個品牌世界。

## 非目標

- 不做新的業務邏輯。展示頁**一行領域邏輯都不寫**，只負責排版與編排既有 procedure。
- 不做階段 2–4 的情境（車牌辨識、包裹櫃、電梯連動）—— 那些硬體尚未進場。
- 不改 LINE 既有流程，只重用 `lineAdmin.scriptRun`。

## 架構

### 身分策略：員工代住戶

展示頁以**管理端 token 登入**，透過既有的 `voice.staffCommand` / `voice.staffCommit`
（`staffProcedure`，員工代指定住戶送出語音指令）代表一位「示範住戶」動作。

如此一來左欄的住戶動作與右欄的管理室視角共用同一個 session，不需要在平板上維護兩份登入態。
這條路徑本來就是為了物業櫃檯代客申請而存在的，展示模式只是它的第二個消費者。

### 新增元件

| 檔案 | 職責 |
|---|---|
| `src/server/services/showcaseSession.ts` | 記錄本場次起始時間、解析示範住戶、判定設備連線真偽 |
| `src/server/services/showcaseTimeline.ts` | **純函式**：把 bookings / work orders / voice audit 併成一條依時間排序的事件流 |
| `src/server/routers/showcase.ts` | `session` / `timeline` / `reset` / `seed`，全部 `staffProcedure` |
| `src/lib/showcase-scenarios.ts` | 四個情境的定義與狀態機（純資料 + 純函式，可單測） |
| `src/app/showcase.tsx` | 展示頁本體（左住戶／右管理室分割） |
| `src/components/showcase/*` | 深藍×金視覺 primitives（Stage、Panel、TimelineFeed、ScenarioTabs） |
| `scripts/seed-showcase.ts` | 樣品屋示範資料（社區、住戶、公設、設備、管家） |

### 資料流（情境 1 · 語音訂公設）

```
業務按住麥克風
  → voice.staffCommand({ audioBase64, targetUserId: 示範住戶 })
      → transcribeAudio (真 Whisper)  → buildVoiceProposal (真 classifier)
      → voiceAuditService.record(phase: "command")
  → 左欄顯示提案卡「週六 14:00 健身房，2 小時」，業務點確認
  → voice.staffCommit({ intent, slots, targetUserId })
      → commitVoiceProposal → bookings 真的寫入 + work_orders 真的派出
      → voiceAuditService.record(phase: "commit", outcome: "committed")
  → 右欄 showcase.timeline（2 秒輪詢）撈出新事件，逐條浮現
```

其餘三個情境同理：情境 2 走 `iot.updateDevice`，情境 3 產生含 demo token 的深連結 QR，
情境 4 呼叫 `lineAdmin.scriptRun`。

## 關鍵設計決定

### 1. 公設名稱的中英對照（阻擋性）

`buildFacilityMap`（`src/server/_core/voiceCommand.ts:257`）以英文關鍵字比對公設名稱，
把 `gym / pool / meeting_room / lounge / bbq / sauna` 對到 amenity id。
中文名稱（「私人健身房」）會得到空 map，語音預約當場失敗。

**決定**：擴充 `buildFacilityMap` 支援中文同義詞（健身房、泳池、游泳池、會議室、
交誼廳、燒烤、烤肉、三溫暖、蒸氣室…），並保留英文比對。建商日後自行改名也不會靜默壞掉。

### 2. `iot.updateDevice` 的授權守門（既有 bug）

該 procedure 標為 `residentProcedure`，但 handler 內的 `canControl` 明確允許
`admin` / `logistics`。守門在前，那段管理員分支是永遠執行不到的死碼。

**決定**：改為 `protectedProcedure`，授權完全交由 handler 既有的 `canControl` 判斷 ——
那正是原作者寫下的意圖。同時補上住戶不得控制他戶設備的回歸測試。

### 3. 重置的邊界

`showcase.reset` 必須只清掉**本場次**產生的紀錄，而且只能碰示範住戶的資料。
兩道護欄同時成立才刪除：

- `userId === 示範住戶 id`（由 `showcase.resident@demo.local` 解析而得）
- `createdAt >= 本場次起始時間`（由 `showcaseSession` 服務持有）

任何一道不成立就不刪。此策略的細節（跨場次殘留要不要一併清、失敗時如何回報）
在實作時交由專案負責人決定。

### 4. 設備真偽必須誠實標示

`hardwareGatewayService` 沒設定時，設備狀態只是資料庫欄位，燈不會真的亮。
展示頁**必須**在該情況下顯示「模擬設備」，不得讓客戶誤以為現場硬體已連線。
有 gateway 時自動切換為「已連線」。這條規則沿用專案既有原則：絕不把未驗證的健康狀態報成成功。

## 視覺

沿用簡報 palette：底 `#0b1220`、卡面 `#13223d`、香檳金 `#c9a961`、次要金 `#d9c48f`、
正文 `#e8edf7`、次要文字 `#9fb0cc`。卡片半透明 + 金色細框 + 柔和陰影，大量留白。

Phase B 將 `use-colors.ts` 的深色主題由現行「純黑 #0F0F0F + 亮金 #FFD700」
換為同一組深藍×香檳金，讓住戶端各頁與展示頁、簡報成為同一個品牌世界。

## 測試策略

純函式優先，避免依賴 React Native 渲染：

- `showcaseTimeline`：合併排序、去重、空資料、壞時間戳
- `showcase-scenarios`：狀態機轉換（idle → listening → proposed → committed → failed）
- `buildFacilityMap`：中英文對照、同一公設多關鍵字、無匹配
- `showcase` router：staff-only 授權、reset 雙護欄、timeline 形狀
- `iot.updateDevice`：admin 可控、住戶不可控他戶

## 分期

- **Phase A**：`/showcase` 展示頁 + showcase router + 兩個既有 bug 修正
- **Phase B**：深藍×金 palette 統一、移除假資料、`voice-booking` / `smart-home` 補完
- **Phase C**：樣品屋示範資料 seed + 一鍵重置串接
