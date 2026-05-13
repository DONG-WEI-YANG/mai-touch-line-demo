# m'AI Touch — Demo Script (LINE ⇄ Web 整合演示)

> 一切都在**一個後端**：`https://mai-touch-line-us.onrender.com`（Render Oregon）。
> 舊的 `mai-touch-demo.onrender.com`（新加坡）已停用 —— 連不到 Gemini，且每次都讓人混淆，確認 Oregon 正常後可刪除。

---

## 0. 角色入口

| 角色 | 入口 | 說明 |
|---|---|---|
| 住戶（管理層 / 客戶體驗） | `https://mai-touch-web.vercel.app/?token=w6bbjyh9XCY34kwhz6N4OEK85OJGqvgt` | 通用「住戶」persona（種子資料）。**注意：這不是 LINE 用戶那一個帳號** |
| 物業（派工 dashboard） | `https://mai-touch-web.vercel.app/?token=OsBQV3Qrq48yd5uo39yBUE0LtnhNcEIi` | 看設施預約 + 工單，**可推進工單狀態**（會即時推播給住戶 LINE） |
| 管理員（系統後台） | `https://mai-touch-web.vercel.app/?token=Vvd_0qkIlQICNT2uDLgxlWeeuQw1iNzV` | 總覽；`/admin/work-orders` 可指派/篩選 |
| 住戶（LINE） | 加 LINE bot `@679ntrul`（"maitouchdemo"）好友 | bot 會私訊一條「您的專屬住戶後台:`<url>`」—— 開**那個** URL 才看得到自己用 LINE 報的單（per-LINE-user 帳號，刻意跟通用住戶 token 分開） |

> Demo 角色 token 是刻意公開的（已內嵌在 web bundle）。`ADMIN_DASHBOARD_TOKEN`（server-rendered `/admin/line/*` 用）才是 server-side secret，不在這裡。

---

## 1. Demo 前檢查清單

- [ ] **keepalive 在跑** —— GitHub → repo → Actions → `keep-render-warm` → Run workflow（先手動叫醒一次）。Render Free 閒置 15 分鐘會休眠，休眠時 LINE webhook 撞冷啟動會被丟掉（LINE 預設不重送）→ bot 不回。
- [ ] **LINE「Webhook redelivery」開啟**（LINE Developers Console → Messaging API → Webhook settings）—— 冷啟動 / 部署空窗的安全網。dispatcher 已有事件去重。
- [ ] **Webhook URL = `https://mai-touch-line-us.onrender.com/line/webhook`**，「Use webhook」開啟，按 Verify 是 Success。
- [ ] **`/health` 秒回**（不是 Render 轉圈頁）：`curl https://mai-touch-line-us.onrender.com/health` → `{"ok":true,...}`。
- [ ] （演管家流才需要）**設一支管家 LINE 帳號**：第二支 LINE 加 bot 好友 → 用管理員 token 呼叫 `lineAdmin.usersSetRole`（`{lineUserId, role:"housekeeper"}`），或開 `/admin/line/users` 改角色。
- [ ] **web app 是最新版** —— `logistics-dashboard` 的狀態按鈕是新加的；若 Vercel 沒自動部署，在 repo 根目錄跑 `npx vercel --prod --yes`。

> ⚠️ 每次 `git push`（→ Render 自動部署）都會**重建 SQLite**（種子資料回來、LINE 建立的單和綁定消失）。Demo 前別 push。

---

## 2. 主線：LINE 報修 → 派工 → 住戶即時收到

1. **住戶（LINE）**：傳「12 樓水龍頭壞了」（或「我要報修…」）。
   bot 回 → `✅ 報修已送出,單號 WO-N`。（AI 在 Oregon 跑 Gemini，會正確分類成 maintenance。）
2. **物業（web）**：開派工 dashboard → 「工單」區出現 **#WO-N**，申報人顯示「LINE Resident」，徽章「待處理」。
3. **物業**：點工單卡上的 **「→ 處理中」**。
   - 卡片徽章變「處理中」
   - 跳出「已更新，住戶已收到 LINE 通知 📲」
4. **住戶（LINE）**：LINE 立刻收到 → `工單 #WO-N「…」狀態更新:處理中`。 ← **這就是 demo 的關鍵畫面：跨通道即時連動**
5. **物業**：處理完點 **「→ 已完成」** → 住戶 LINE 再收到 `…狀態更新:已完成`。
6. **管理員（web）**：開系統後台 → 看到 #WO-N 與所有單；`/admin/work-orders` 可篩 `in_progress`、指派管家。

## 3. 支線 A：管家在 LINE 上接單（需先設管家帳號）

1. 住戶在 LINE 報修建立 WO-N 後，bot 自動把 **WO-N 的 Flex 卡** 推給所有 housekeeper 角色的 LINE 用戶。
2. **管家（LINE）**：在卡片上按 **「Accept」** → bot 回確認、工單狀態 → 處理中、**住戶 LINE 收到狀態更新推播**。按「Reject」→ 狀態 → 已關閉。
3. 物業 / 管理員 dashboard 重整 → 看到狀態已變。

## 4. 支線 B：設施預約（LINE 引導式）

1. **住戶（LINE）**：傳「我想預約週六晚上 7 點的健身房」→ bot 用 Flex 走 設施輪播 → 日期/時間 picker → 確認卡 → 點「確認」→ `✅ 已預約,單號 BK-N`。
2. **物業（web）**：「設施預約」區出現 #BK-N，狀態「待確認」。
3. （管家流同 A，卡片 wo = BK-N，Accept → 預約「已確認」）

## 5. 支線 C：住戶自己的專屬後台

- 加 bot 好友時 bot 私訊的那個 `<url>` → 開它 → 看到**自己用 LINE 報的所有單**（這個帳號跟通用住戶 token 是兩個 persona，刻意分開，比較像真實系統）。

---

## 6. 觀測 / Debug

| 想看 | 怎麼看 |
|---|---|
| 健康狀態 | `GET https://mai-touch-line-us.onrender.com/health` |
| LINE 訊息紀錄 | `lineAdmin.logsList`（用管理員 token，tRPC GET，input 要 superjson 包：`?input={"json":{"limit":50}}`）；或 `/admin/line/logs?token=<ADMIN_DASHBOARD_TOKEN>` |
| 今日訊息量 / uptime | `lineAdmin.health`（管理員 token） |
| 工單清單（含申報人） | `workOrders.listAll`（物業或管理員 token） |
| LINE webhook 設定 | `GET https://api.line.me/v2/bot/channel/webhook/endpoint`（需 channel access token）；`POST .../webhook/test` 測一發 |
| Render log | `GET https://api.render.com/v1/logs?ownerId=tea-d7qebifavr4c73ejmsc0&resource=srv-d81bh0gg4nts739bt1v0&...`（需 Render API key）；grep `[LINE]` / `[workOrders.update] LINE push-back failed` |

**常見狀況**
- *bot 完全不回* → Oregon 休眠了，冷啟動把 webhook 吃掉。確認 keepalive 在跑；開 LINE webhook redelivery。
- *物業看到單但住戶 LINE 沒收到狀態更新* → 該工單的申報人不是 LINE 綁定用戶（例如用通用住戶 token 在 web 建的單，owner 是種子用戶、無 LINE 綁定）；或 push 失敗 → 看 Render log。
- *web 上看不到 LINE 報的單* → 確認 web app 的 tRPC base 指向 `mai-touch-line-us`（跟 LINE webhook 同一個後端）；確認沒有人把 webhook 切回新加坡。
