# Google Smart Home（Cloud-to-Cloud）裝置控制 — 營運設定

> **範圍**:讓住戶用 Google 音箱「Hey Google, 開健身房冷氣」控制**智慧裝置**。
> 這是 Google 音箱唯一還支援的「連到你們後端」路徑,**只能做裝置控制,不能做語音預約**
> (語音預約走自建收音 pipeline,見 `docs/superpowers/specs/2026-07-12-voice-booking-design.md`)。

## 程式碼位置

- 意圖處理(純函式、已單測):`src/server/services/googleSmartHome.ts`
- Fulfillment webhook:`app.ts` 的 `POST /google/smarthome`
- 身份解析:沿用 `createContext`(Bearer token → 使用者),與 tRPC 同一套

Google 會對 webhook 送三種 intent,皆以 OnOff trait 為主:

| Intent | 行為 |
|---|---|
| `SYNC` | 回傳該住戶的裝置清單(以 `unitId` 撈 `getDevicesByUnit`) |
| `QUERY` | 回報各裝置 on/off(由 `status` 推導) |
| `EXECUTE` | 執行 OnOff → `updateDeviceStatus` + `hardwareGatewayService.dispatchDeviceCommand` |

裝置型別對應:`light→LIGHT`、`climate→AC_UNIT`、`curtain→BLINDS`、`power→OUTLET`、
`media→TV`、`security→SECURITYSYSTEM`、其他→`SWITCH`。

## 你(營運/開發)需在外部完成的設定

程式碼已就緒,但 Google 端需要以下**一次性設定**,無法由程式自動完成:

1. **Actions on Google / Google Home Console**
   - 建立 Smart Home Action。
   - Fulfillment URL 填:`https://<你的網域>/google/smarthome`(需 HTTPS)。

2. **OAuth 帳號連結(Account Linking)**
   - Google 要求 OAuth2:授權端點 + Token 端點。可沿用既有 `registerOAuthRoutes`(`src/server/oauth.ts`)擴充。
   - 連結成功後,Google 會在每次 webhook 帶 `Authorization: Bearer <access_token>`。
   - 目前 `createContext` 解析順序:① env demo token ② `web_tokens` 表個人 token。
     正式上線請讓帳號連結發出的 token 落在其中一種(建議寫入 `web_tokens`,綁到該住戶 `user_id`)。

3. **測試**
   - Console 的 Test Suite 或實機:「Hey Google, sync my devices」→ 應觸發 SYNC。
   - 「Hey Google, turn on <裝置名>」→ 應觸發 EXECUTE,DB 狀態改變且硬體閘道收到派送。

## 限制(務必向客戶說清楚)

- **沒有語音預約**:Google 不給逐字稿/參數,只能觸發固定的裝置指令。
- 裝置需先存在於 `devices` 表且綁到住戶 `unitId`,SYNC 才看得到。
- `willReportState: false`:目前不做主動 Report State(Google 會用 QUERY 拉取);未來要即時同步再加 HomeGraph Report State。
