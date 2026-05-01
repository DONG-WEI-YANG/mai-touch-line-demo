# LINE 互動 Demo + 雲端部署 — Design Spec

- **Date**: 2026-05-01
- **Owner**: ydw331@gmail.com
- **Status**: Draft (awaiting review)
- **Related**: `AI housekeeper demo.mp4` (端到端 walkthrough 參考)

---

## 0. 目的 & 範圍

把現有 m'AI Touch(豪華建築管理 App)的 AI Housekeeper 能力,以 **LINE 官方帳號 + Messaging API** 形式做出一個**永遠在線、可被外人試玩**的雲端互動 demo,涵蓋影片中的端到端 walkthrough(住戶下單 → AI 解析 → 工單建立 → 管家收到 → 完成回報)。

### 0.1 已確認的需求(brainstorming 結果)

| 項目 | 決定 |
|---|---|
| Surface | LINE Messaging API + 官方帳號(住戶在 LINE 聊天視窗對話) |
| Scope | **L (Large)** — 自由文字對話、3+ intent、Flex carousel、Push 通知、多語(zh/en/ja)、雙視角(住戶 + 管家) |
| 角色處理 | 單一官方帳號 + `/role` 指令切換 + `/demo` 自動腳本 |
| Backend mode | `DEPLOY_PROFILE=demo` → OpenAI-only;`=prod` → 既有 NLP service。**兩條互不干擾** |
| 部署平台 | Render(Free plan + cron-job.org keepalive) |
| Demo / Prod 分離 | 同 codebase × 兩個 Render service × 不同 env × 不同 DB 檔 |
| 第一版 ship 目標 | L scope 第一版,管家視角 + 4 個 demo 腳本(facility/repair/visitor/complaint) |

### 0.2 非目標(Out of scope,留給 v2)

- LIFF 內嵌 webview(本版純 Messaging API)
- LINE Login OAuth 整合到既有 web app(本版 demo 不需登入)
- 第二支獨立的「管家專用」LINE 官方帳號(本版用單帳號 + role 切換)
- Rich Menu 設計(v1.1)
- Production NLP service 的 Render 部署(prod 環境暫不動)
- Mobile App(Expo iOS/Android build)上架(不在本 spec)

---

## 1. 整體架構 & Request Flow

### 1.1 部署拓撲

```
                ┌───────────────────────────────────────────────┐
                │              Render (cloud)                    │
                │                                                │
   LINE         │  ┌────────────────────────────────────────┐   │
 Platform ──────┼─▶│  mai-touch-demo (Web Service, Free)    │   │
  webhook       │  │  DEPLOY_PROFILE=demo                   │   │
                │  │  ─ Express + tRPC + LINE handlers      │   │
                │  │  ─ SQLite: /var/data/mai-touch-demo.db │   │
                │  │  ─ AI: OpenAI gpt-4o-mini only         │   │
                │  └────────────────────────────────────────┘   │
                │                                                │
                │  ┌────────────────────────────────────────┐   │
                │  │  mai-touch-prod (現有,本 spec 不動)    │   │
                │  │  DEPLOY_PROFILE=prod                   │   │
                │  └────────────────────────────────────────┘   │
                └───────────────────────────────────────────────┘
                              ▲
                              │ same git repo, env-driven profile
                              │
                 cron-job.org ──GET /health every 14 min──┐
                                                          ▼
                                              (防 Render Free plan idle)
```

差異只在 env(`DEPLOY_PROFILE`、`DATABASE_URL`、`LINE_*`、`OPENAI_API_KEY`)。

### 1.2 單次訊息的 Request Flow

範例:住戶說「我想預約週六晚上 7 點的健身房」

```
[LINE Platform] ──webhook──▶ POST /line/webhook
        │
        ▼
src/server/line/webhook.ts
  (1) verify X-Line-Signature (HMAC-SHA256, channelSecret, timingSafeEqual)
  (2) res.status(200).send()                ◀─── ack <1s,避免 LINE retry
  (3) setImmediate(() => dispatch(events))
        │
        ▼
src/server/line/dispatcher.ts
  (4) lookup line_user → 取 role
  (5) /command? → command-handler
  (6) session in progress? → continue (slot filling)
  (7) else → resident.ts / housekeeper.ts 起新對話
        │
        ▼
src/server/line/handlers/resident.ts
  (8) ai.classify(text)  ◀── profile-aware
        ├─ demo: openai-intent.ts (gpt-4o-mini)
        └─ prod: nlp-bridge.ts (FastAPI)
  (9) intent='facility.book' → check missing slots
  (10) missing → session.set(state) + replyOrPush(quickReply)
  (11) all filled → confirm → tRPC: amenities.book(...)
  (12) replyOrPush(bookingDone)
  (13) push housekeeper users → workOrderCard
```

### 1.3 元件責任(每個都是單一目的、可獨立測試)

| 模組 | 職責 | 對外介面 | 依賴 |
|---|---|---|---|
| `webhook.ts` | HTTP 入口、驗簽、ack、enqueue | `POST /line/webhook` | `dispatcher` |
| `dispatcher.ts` | 路由 event → handler;指令 vs session vs 新對話 | `dispatch(events): Promise<void>` | `session-store`, handlers |
| `session-store.ts` | 多輪對話 state(in-memory `Map` + 30 分 TTL) | `get/set/clear/evictExpired(userId)` | — |
| `handlers/resident.ts` | 住戶意圖處理 → 呼叫 tRPC procedures | `handle(event, ctx)` | `ai/`, `flex/`, tRPC routers |
| `handlers/housekeeper.ts` | 管家視角:看工單、回覆、改狀態 | `handle(event, ctx)` | tRPC routers, `flex/` |
| `handlers/demo.ts` | `/demo` 腳本引擎 | `runScript(name, ctx)` / `continue(event, ctx)` | `flex/`, `line-client` |
| `handlers/command.ts` | `/help` `/role` `/lang` `/reset` 等指令 | `handleCommand(text, ctx)` | session-store, line_user table |
| `ai/openai-intent.ts` | Intent + slot extraction(demo) | `IntentClassifier` | OpenAI SDK |
| `ai/nlp-bridge.ts` | 同介面,prod profile | `IntentClassifier` | `NLP_SERVICE_URL` |
| `flex/` | Flex Message templates(純函式) | builders | — |
| `line-client.ts` | wrap LINE SDK,提供 `replyOrPush` | `reply/push/multicast` | `@line/bot-sdk` |
| `_core/profile.ts` | 讀 `DEPLOY_PROFILE` 並 `getAi()` factory | `getAi()` | env |

### 1.4 新增 npm 依賴

- `@line/bot-sdk` — LINE 官方 SDK
- `openai` — 官方 SDK(取代手刻 fetch)

其他全部復用既有 dependency(`express`, `express-rate-limit`, `zod`, `vitest`, ...)。

---

## 2. 資料模型 & Session 狀態機

### 2.1 新增 DB Schema(`migrations/006_line_integration.sql`)

```sql
-- 綁定 LINE userId ↔ 系統內 user / role
CREATE TABLE line_user (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id      TEXT    NOT NULL,
  line_user_id    TEXT    NOT NULL,                  -- "U" + 32 hex
  app_user_id     INTEGER REFERENCES users(id),      -- demo 可 NULL
  role            TEXT    NOT NULL DEFAULT 'resident', -- resident | housekeeper | admin
  display_name    TEXT,
  picture_url     TEXT,
  language        TEXT    DEFAULT 'zh-TW',           -- zh-TW | en | ja
  is_demo         INTEGER NOT NULL DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel_id, line_user_id)
);
CREATE INDEX idx_line_user_role ON line_user(role);

-- 對話 audit log
CREATE TABLE line_message_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id    TEXT    NOT NULL,
  direction       TEXT    NOT NULL,                  -- inbound | outbound
  message_type    TEXT    NOT NULL,                  -- text | flex | postback | image
  content         TEXT,                              -- JSON.stringify(message)
  intent          TEXT,
  session_id      TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_line_message_log_user_time ON line_message_log(line_user_id, created_at);
```

既有 `users`、`work_orders`、`amenity_bookings` 表**完全不動**。

### 2.2 Conversation State Machine(住戶端核心)

```
IDLE ──text/postback──▶ CLASSIFYING ──ai.classify()──┐
                                                      │
              ┌────────┬───────────────┬─────────────┤
              ▼        ▼               ▼             ▼
        small_talk facility_book repair_report visitor_notify
              │        │               │             │
        IDLE ◀┘        ▼               ▼             ▼
                 ┌──────────────────────────────────────┐
                 │ SLOT_FILLING (loop ask missing slots)│
                 │   ── all filled? ─ no ─┐            │
                 └────────┬───────────────┘            │
                       yes│       loop                  │
                          ▼                             │
                    CONFIRMING ──user "確認"──▶ EXECUTING
                          │                             │
                       cancel                           ▼
                          │                       NOTIFYING (push housekeeper)
                          ▼                             │
                         IDLE ◀───────────────────────  │
```

### 2.3 Session State 結構

```ts
type SessionState = {
  userId: string;
  role: 'resident' | 'housekeeper' | 'admin';
  step: 'IDLE' | 'CLASSIFYING' | 'SLOT_FILLING' | 'CONFIRMING' | 'EXECUTING';
  intent?: IntentName;
  slots: Record<string, unknown>;
  missingSlots: string[];
  language: 'zh-TW' | 'en' | 'ja';
  updatedAt: number;
  demoScriptId?: string;
  demoStep?: number;
};
```

存 `Map<lineUserId, SessionState>` in-memory。每次 dispatch 開頭跑 `evictExpired()`(idle > 30 分鐘清掉),不用 setInterval(避免 free tier 喚醒 bug)。

### 2.4 Demo Mode 腳本資料結構

```ts
type DemoScript = {
  id: 'facility' | 'repair' | 'visitor' | 'complaint';
  title: Record<Lang, string>;
  steps: DemoStep[];
};
type DemoStep =
  | { kind: 'bot_say'; message: FlexMessage | TextMessage; delayMs?: number }
  | { kind: 'wait_user'; expect: 'any' | 'postback'; postbackData?: string }
  | { kind: 'simulate_housekeeper'; message: string; delayMs: number }
  | { kind: 'side_effect'; trpcCall: { router: string; procedure: string; input: unknown } };
```

腳本檔放 `src/server/line/demo-scripts/*.ts` — 純資料,新增腳本不用改 dispatcher。

### 2.5 Demo SQLite Seed 策略

| 時機 | 動作 |
|---|---|
| Render service 第一次 boot(buildCommand) | `npm run db:init:demo` — 建表 + seed 6 假住戶 + 2 假管家 + 8 設施 + 3 筆既有工單 |
| 後續 deploy | **不 reset**(persistent disk 保留),只跑 pending migration |
| 簡報前手動 reset | LINE 輸入 `/demo reset`(role=admin)→ 重跑 seed |
| 防爆量 | demo profile 限 `line_user` ≤ 200 筆,LRU evict |

### 2.6 Schema 與既有 code 接點

- demo profile **不**為每個 LINE 使用者建 `users` 紀錄;business query 用 `line_user.id` 當 surrogate。
- `work_orders.created_by` / `amenity_bookings.user_id` 等 FK:demo 用固定 `seed_user.id=1` 當 owner,避開 FK 限制。
- 既有 tRPC procedure **完全不改** — handler 用 `appRouter.createCaller(ctx).amenities.book(...)` 呼叫。

---

## 3. AI 抽象層 & Profile 切換

### 3.1 介面契約

```ts
// src/server/line/ai/types.ts
export type Lang = 'zh-TW' | 'en' | 'ja';

export type IntentName =
  | 'facility.book' | 'facility.cancel' | 'facility.list'
  | 'repair.report'
  | 'visitor.notify'
  | 'complaint.file'
  | 'workorder.status'
  | 'small_talk' | 'unknown';

export type Slot = {
  date?: string;          // ISO 8601 (YYYY-MM-DD)
  time?: string;          // HH:mm 24h
  facility?: 'gym' | 'pool' | 'meeting_room' | 'lounge' | 'bbq' | 'sauna';
  duration_min?: number;
  location?: string;
  issue?: string;
  visitor_name?: string;
  visitor_count?: number;
  urgency?: 'low' | 'med' | 'high';
  language_detected?: Lang;
};

export type IntentResult = {
  intent: IntentName;
  confidence: number;     // 0..1
  slots: Slot;
  language: Lang;
  rephrase?: string;      // bot 用人話 echo 一次給使用者看
};

export interface IntentClassifier {
  classify(text: string, ctx: { userId: string; history?: string[] }): Promise<IntentResult>;
}
```

`confidence < 0.6` 的處理權交給 handler。`slots` 全 optional;state machine 自己決定哪些必填。介面不回 `next_question` — 那是 handler 的事。

### 3.2 Profile factory

```ts
// src/server/_core/profile.ts
let cached: IntentClassifier | null = null;

export function getAi(): IntentClassifier {
  if (cached) return cached;
  const profile = process.env.DEPLOY_PROFILE ?? 'prod';
  if (profile === 'demo') {
    const { OpenAIIntent } = require('../line/ai/openai-intent');
    cached = new OpenAIIntent({
      apiKey: requireEnv('OPENAI_API_KEY'),
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    });
  } else {
    const { NlpBridge } = require('../line/ai/nlp-bridge');
    cached = new NlpBridge({
      baseUrl: requireEnv('NLP_SERVICE_URL'),
      timeoutMs: 8000,
    });
  }
  return cached;
}
```

`require()` 而非 top-level `import` — demo profile 不會載入 prod 的 NLP bridge,反之亦然。

### 3.3 Demo profile 實作要點(`openai-intent.ts`)

- 用 OpenAI **structured output**(`response_format: {type:'json_schema', strict:true}`)。
- System prompt 寫死「不准虛構日期 / 時間;`small_talk` 是寒暄;`unknown` 是真的不懂」。
- 帶最後 4 句 history 讓 SLOT_FILLING 多輪能銜接。
- `temperature: 0.1`(分類不需要創意)。
- Output 仍經 `zod.parse()` 做 runtime validation 防 schema drift。

### 3.4 Prod profile 實作要點(`nlp-bridge.ts`)

- 適配既有 NLP service 的 `{intent_class, score, entities[], detected_lang}` shape → `IntentResult`。
- 8 秒 timeout(`AbortController`),失敗丟 `AiUnavailableError`。
- 此檔是**唯一**接觸 NLP service shape 的地方(adapter pattern boundary)。

### 3.5 成本 / 延遲(demo profile)

| 項目 | 估算 |
|---|---|
| 每次 classify token | system 250 + history 150 + user 30 + JSON output 120 ≈ **550** |
| `gpt-4o-mini` 單價 | input $0.15/1M、output $0.60/1M |
| 單次成本 | ≈ **$0.0001** |
| 月預期流量 | 觀眾 ~3000 次 |
| 月 OpenAI 成本 | **≈ $0.30** |
| p50 / p95 延遲 | ~600 ms / ~1.2 s(< LINE 30s reply token TTL) |
| Render Free instance | $0 |
| **Demo 全月總成本** | **< $1 USD**(不含 cron-job.org 免費方案) |

### 3.6 失敗模式

| 失敗 | 行為 |
|---|---|
| OpenAI 429 / 5xx | retry 1 → 失敗 → push「系統忙碌,請稍候再試」+ log error |
| Schema 驗證失敗 | log raw,回 `intent='unknown', confidence=0`,handler 走 clarification |
| Timeout (>8s) | abort,push「沒聽清楚,可以再說一次嗎?」 |
| `confidence < 0.6` | 不算失敗,handler 發 quick reply 給 3 個猜測選項讓使用者選 |

---

## 4. LINE 訊息設計

### 4.1 指令清單(全部 `/` 開頭,case-insensitive)

| 指令 | 對象 | 行為 |
|---|---|---|
| `/help` | 全部 | 列指令 + 當前 role + 當前語言 |
| `/role resident` / `/role housekeeper` / `/role admin` | 全部 | 切換角色(demo 公開可切;admin 限白名單) |
| `/lang zh` / `/lang en` / `/lang ja` | 全部 | 強制語言(覆蓋 AI 偵測) |
| `/demo facility|repair|visitor|complaint` | 全部 | 觸發對應自動腳本 |
| `/demo list` | 全部 | 列可用腳本 |
| `/demo stop` | 全部 | 中斷進行中腳本 |
| `/reset` | 自己 | 清自己 session state |
| `/demo reset` | role=admin | 重 seed 整個 demo DB(簡報前用) |
| `/whoami` | 全部 | 印 lineUserId 前 8 碼 + role + lang(debug) |

不認識的 `/xxx` → 不當指令,丟給 AI 當一般訊息處理。

### 4.2 Flex Message 模板(7 個,放 `src/server/line/flex/`)

| 模板 | 觸發場景 | 內容要點 |
|---|---|---|
| `welcome.ts` | follow event | logo + 介紹 + 「開始」「demo 列表」 quick reply |
| `facilityCarousel.ts` | 住戶說「想預約」未指定設施 | 6 卡 carousel,每卡:設施圖、名稱、開放時間、「預約」postback |
| `dateTimePicker.ts` | SLOT_FILLING 缺日期/時間 | LINE 原生 datetime picker action |
| `bookingConfirm.ts` | slots 齊備 | 摘要卡 + 「確認」「修改」「取消」postback |
| `bookingDone.ts` | tRPC 寫入成功 | 成功提示 + 工單編號 + 「再預約一次」 |
| `workOrderCard.ts` | 推給 housekeeper 的新工單 | 工單摘要 + 「接單」「轉派」「拒絕」postback |
| `workOrderStatus.ts` | 住戶查「我的工單」 | carousel 列最近 5 筆,狀態 badge |

**規範**:
- 主色 `#C9A96E`(theme.config.js 既有金色)、深底 `#1a1a1a`
- 每個模板是純 builder function `(input, lang) => FlexMessage` — 不接 ctx、不打 DB
- i18n 文字從 `flex/i18n.ts` 字典查

### 4.3 Postback Data 約定

格式:`querystring`(`act=...&slot=...&val=...`),`dispatcher.parsePostback()` 用 `URLSearchParams` 解一次再過 `zod` schema。**不**用 JSON(LINE postback data 上限 300 字元)。

範例:
- `act=book&fac=gym` — 從 carousel 選設施
- `slot=time&val=19:00` — quick reply 選時間
- `act=confirm&intent=facility.book` — 確認預約
- `act=accept&wo=WO-001` — 管家接單

### 4.4 Quick Reply

SLOT_FILLING 主力 UI(離散選擇)。例:問「幾點?」附 4 個 postback button + 1 個 datetime picker fallback。每訊息最多 13 個 QR button。

### 4.5 Demo 腳本範例 — `/demo facility`

```ts
export const facilityScript: DemoScript = {
  id: 'facility',
  title: { 'zh-TW': '預約健身房 walkthrough', en: 'Book a facility', ja: '施設予約デモ' },
  steps: [
    { kind: 'bot_say', message: textMsg('🎬 開始示範:住戶想預約健身房') },
    { kind: 'bot_say', message: textMsg('👤 住戶: 「想訂禮拜六晚上的健身房」'), delayMs: 1500 },
    { kind: 'bot_say', message: facilityCarousel('zh-TW'), delayMs: 1500 },
    { kind: 'wait_user', expect: 'postback', postbackData: 'act=book&fac=gym' },
    { kind: 'bot_say', message: dateTimePicker({ slot: 'time' }, 'zh-TW') },
    { kind: 'wait_user', expect: 'postback' },
    { kind: 'bot_say', message: bookingConfirm({ facility: 'gym', date: '2026-05-09', time: '19:00' }, 'zh-TW') },
    { kind: 'wait_user', expect: 'postback', postbackData: 'act=confirm' },
    { kind: 'side_effect', trpcCall: { router: 'amenities', procedure: 'book',
        input: { facility: 'gym', date: '2026-05-09', time: '19:00', userId: 1 } }},
    { kind: 'bot_say', message: bookingDone({ orderId: 'WO-DEMO-001' }, 'zh-TW') },
    { kind: 'simulate_housekeeper', message: '🛎️ (3 秒後) 管家端收到通知…', delayMs: 3000 },
    { kind: 'bot_say', message: workOrderCard({ /* ... */ }, 'zh-TW') },
    { kind: 'bot_say', message: textMsg('✅ Demo 完成!輸入 /demo list 查看其他腳本') },
  ],
};
```

腳本引擎邏輯:
- 開始 `session.demoScriptId` + `demoStep = 0`
- `bot_say` step:`replyOrPush()` 後 `await sleep(delayMs)`,`step++`
- `wait_user` step:不送訊息,等下個 webhook event
- `side_effect` step:**真的呼叫 tRPC**,DB 真的會多一筆工單(L scope 要求)
- `/demo stop` 或 30 分鐘 idle 自動清 `demoScriptId`

### 4.6 L scope 對應檢查

| L scope 要求 | 由哪個元件涵蓋 |
|---|---|
| 自由文字對話 | `handlers/resident.ts` + `ai/openai-intent.ts` |
| 3+ intent | `IntentName` enum 列 7 個 |
| Flex carousel | `flex/facilityCarousel.ts` + `workOrderStatus.ts` |
| Push 通知 | `line-client.push()` + dispatcher 在 EXECUTING 後 push housekeeper |
| 多語(zh/en/ja) | `Lang` 型別 + `flex/i18n.ts` + `IntentResult.language` + `/lang` 強制 |
| 雙視角(住戶 + 管家) | `/role` + `line_user.role` + `handlers/housekeeper.ts` |
| 端到端 walkthrough | `/demo {facility|repair|visitor|complaint}` 4 腳本 |

---

## 5. 錯誤處理、安全、測試、部署

### 5.1 安全

| 風險 | 防護 |
|---|---|
| 偽造 webhook | `webhook.ts` 第一行驗 `X-Line-Signature`(HMAC-SHA256),`crypto.timingSafeEqual` 比對。失敗 401 + log IP,不 dispatch |
| Replay attack | LINE 不重發成功(200)的 event;dispatcher 用 `webhookEventId` LRU(1000 筆)去重 |
| 環境變數外洩 | `.env` 已 gitignore;`.env.example` 只放 LINE_* 區塊不放真值;Render dashboard 設 env |
| OpenAI key 濫用 | demo profile rate limit:每 lineUserId **每分 10 訊息、每天 200 訊息**;超過回「demo 用量達上限」 |
| 全站 abuse | webhook 路徑 IP-based limit:每 IP 每秒 30 req(`express-rate-limit`,既有 dep) |
| 假指令越權(`/role admin`) | `admin` 需 env `DEMO_ADMIN_LINE_USERS` 白名單;預設只允許 resident/housekeeper |
| `/demo reset` 亂用 | 限 admin 白名單;清資料前先 push「3 秒後將清空,輸入 `/cancel` 取消」 |
| Postback data 注入 | `URLSearchParams` 嚴格 parse + `zod` schema(facility 限 enum、date 限 ISO);失敗丟掉 |

### 5.2 錯誤處理矩陣

| 錯誤源 | 偵測點 | 處理 | 對使用者顯示 |
|---|---|---|---|
| 簽章不對 | `webhook.ts` | 401, log, 不 dispatch | (無) |
| reply token 過期 | `line-client.replyOrPush()` | 自動切 push API | (無感) |
| OpenAI 429 / 5xx | `openai-intent.ts` | retry 1 次 → 仍失敗丟 `AiUnavailableError` | "系統忙碌,請稍候再試 🙏" |
| OpenAI schema parse fail | 同上 | log raw → return `intent='unknown', confidence=0` | handler 走 clarification |
| tRPC procedure throw | `handlers/*.ts` try-catch | log,分類 business / system | business → 業務訊息;system → "服務暫時異常" |
| Session state 損壞 | `dispatcher` JSON.parse | clear session,回 "對話已重置,請重新開始" | 同上 |
| Rate limit 觸發 | `line-client.ts` 前置 | 一次回覆,後續 silent drop | "已達 demo 用量上限" |
| Demo script 中斷 | `handlers/demo.ts` | catch → clear demoScriptId + push "Demo 已終止" | 同上 |

**核心原則**:
- handler 層 try-catch **絕不**吞錯;必先 `logger.error({err, lineUserId, intent})`。
- 系統錯誤回覆**不 leak stack trace**,但 log 完整保留。

### 5.3 測試策略

| 層 | 工具 | 範圍 | 覆蓋目標 |
|---|---|---|---|
| Unit | vitest | `flex/*` builders、`parsePostback`、`adaptNlpResponse`、`session-store` TTL | 80%+ |
| Unit + mock | vitest + `nock` | `openai-intent.classify()` mock OpenAI 回應 | happy path + 3 錯誤分支 |
| Integration | vitest + supertest | `POST /line/webhook` 餵假 LINE payload(含正確簽章) | 5 關鍵 flow |
| State machine | vitest | facility.book happy path 整條 | 1 happy + 1 cancel + 1 timeout |
| Demo script | vitest | 跑 `facility` 腳本,mock LINE client | 4 腳本各 1 個 |
| Smoke (manual) | LINE 真實帳號 + ngrok | 部署前手動完整跑一次 | 不自動化 |

**不寫**:LINE SDK 內部、OpenAI 真實呼叫、Render 部署 e2e。

測試檔放 `tests/line/*.test.ts`,沿用 `vitest.config.ts`。

### 5.4 部署 — Render `render.yaml`

```yaml
services:
  - type: web
    name: mai-touch-demo
    runtime: node
    plan: free
    region: singapore
    branch: main
    buildCommand: npm ci && npm run db:init:demo
    startCommand: npm run server
    envVars:
      - key: DEPLOY_PROFILE
        value: demo
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: DB_TYPE
        value: sqlite
      - key: SQLITE_FILENAME
        value: /var/data/mai-touch-demo.db
      - key: LINE_CHANNEL_SECRET
        sync: false
      - key: LINE_CHANNEL_ACCESS_TOKEN
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: OPENAI_MODEL
        value: gpt-4o-mini
      - key: BASE_URL
        value: https://mai-touch-demo.onrender.com
      - key: DEMO_ADMIN_LINE_USERS
        sync: false
    disk:
      name: demo-data
      mountPath: /var/data
      sizeGB: 1
    healthCheckPath: /health
```

**Cold start 對策(已決)**:Render Free plan + **cron-job.org 每 14 分鐘 GET `/health`** 維持 instance 不睡眠。

設定步驟(README 寫清楚):
1. cron-job.org 註冊免費帳號
2. Create cronjob → URL: `https://mai-touch-demo.onrender.com/health` → 每 14 分鐘
3. Notification: email on failure(任何時候 health 掛了會收信)

未來升級備案:Starter plan($7/mo)— 不睡眠、保證 first-request latency。本 spec 不採用。

### 5.5 LINE Developer Console 設定 checklist

部署後一次性手動操作(README 完整列):
1. https://developers.line.biz/console — 建 Provider + Messaging API channel
2. Channel basic settings → 抄 `Channel secret` → Render env `LINE_CHANNEL_SECRET`
3. Messaging API → Issue `Channel access token (long-lived)` → Render env `LINE_CHANNEL_ACCESS_TOKEN`
4. Messaging API → Webhook URL: `https://mai-touch-demo.onrender.com/line/webhook` → Verify
5. Messaging API → "Use webhook" ON
6. Messaging API → Auto-reply messages OFF
7. Messaging API → Greeting messages OFF
8. Channel basic → 加好友 QR code → 給簡報觀眾掃

### 5.6 健康檢查 & 觀測

新增 `GET /health`:
```json
{ "ok": true, "profile": "demo", "db": "ok", "ai_provider": "openai", "uptime_s": 3621 }
```
Render 用、cron-job.org 用、簡報前自我檢查用。

Log 用既有 `console.log`,不引入 Pino/Winston。重要 log 加 prefix:`[LINE]`、`[AI]`、`[DEMO]`,Render dashboard 搜尋方便。

---

## 6. 檔案異動總覽

### 新增

```
src/server/line/
├── webhook.ts
├── dispatcher.ts
├── session-store.ts
├── line-client.ts
├── handlers/
│   ├── resident.ts
│   ├── housekeeper.ts
│   ├── demo.ts
│   └── command.ts
├── ai/
│   ├── types.ts
│   ├── openai-intent.ts
│   └── nlp-bridge.ts
├── flex/
│   ├── i18n.ts
│   ├── welcome.ts
│   ├── facilityCarousel.ts
│   ├── dateTimePicker.ts
│   ├── bookingConfirm.ts
│   ├── bookingDone.ts
│   ├── workOrderCard.ts
│   └── workOrderStatus.ts
└── demo-scripts/
    ├── facility.ts
    ├── repair.ts
    ├── visitor.ts
    └── complaint.ts

src/server/_core/profile.ts
migrations/006_line_integration.sql
scripts/init-db-demo.ts
tests/line/*.test.ts (約 8-10 個 test 檔)
render.yaml
docs/LINE_INTEGRATION.md (operator guide)
```

### 修改

| 檔案 | 變更 |
|---|---|
| `src/server/index.ts` | mount `/line/webhook` route + `/health` route + `/line` rate limiter |
| `package.json` | 新增 `@line/bot-sdk`、`openai`;新增 script `db:init:demo` |
| `.env.example` | 新增 `LINE_*`、`DEPLOY_PROFILE`、`DEMO_ADMIN_LINE_USERS` 區塊 |
| `README.md` | 加「LINE Demo 部署」章節指向 `docs/LINE_INTEGRATION.md` |

### 不動

- `src/app/`(Expo 前端)
- `nlp-service/`(Python NLP)
- 既有 `src/server/routers/*`(tRPC procedures)
- 既有 migrations 001-005

---

## 7. 風險 & 取捨

| 風險 | 緩解 |
|---|---|
| Render Free plan idle 即使有 cron 仍偶爾 cold start | 接受 — 第一次喚醒 10s 觀眾可容忍;LINE webhook 有 retry,通常第二次就接到 |
| OpenAI 帳號被刷爆 | 雙層 rate limit(per-user + per-IP)+ OpenAI 後台設 spend cap $10/月硬上限 |
| SQLite 在 Render persistent disk 有併發限制 | demo 流量極低不構成問題;真要 scale 時切到 Render PostgreSQL |
| 單一 LINE 帳號 role 切換體驗較差(管家 / 住戶不能同時登入) | 接受 — L scope 已說明用 `/role` 切換;v2 再開第二支官方帳號 |
| `/demo` 腳本與真實對話交錯時 state 衝突 | 進入 `/demo` 即 lock session;期間住戶輸入只走腳本 dispatch;`/demo stop` 解鎖 |
| OpenAI 偵測語言錯誤 | `/lang` 強制覆蓋 + 把 `IntentResult.language` 寫進 `line_user.language` 持久化 |

---

## 8. Resolved Decisions

- [x] **LINE Provider**:**使用既有公司 LINE Provider**,在其下新建一支 Messaging API channel 作為 demo 專用(channel secret / access token 獨立,不混用 prod channel)。Phase 0 申請步驟需向公司 Provider admin 取得權限。
- [x] **cron-job.org 帳號 email**:`ydw331@gmail.com`(失敗通知收件人)。
- [x] **Demo banner**:啟用 — 每則 bot 文字 / Flex altText 前 prefix `🧪 [DEMO]`,實作於 `line-client.ts` 統一處理(handlers / flex builders 不需感知)。

---

## 10. Admin Dashboard(Runtime-Configurable Console)

### 10.1 動機 & 範圍

讓 demo 操作者(簡報前 / 簡報中)**不用改 code、不用 redeploy** 即可:
- 即時看 LINE 對話 log + 解析 intent
- 調整 rate limit、OpenAI model、信心門檻、demo banner 等
- 開關 / 編輯 demo 腳本
- 管理 LINE 使用者角色
- 看健康指標
- 手動推播訊息(debug)

### 10.2 架構決定

- **長在現有 Expo Router web app**(`src/app/admin/line/`),不另開 service。
- tRPC procedures 放 `src/server/routers/lineAdminRouter.ts`,沿用既有 `protectedProcedure` + role check(`role=admin`)。
- 動態設定**從 env 搬到 DB** — 新增 `runtime_config` key-value 表,啟動時 load,熱更新時 in-memory cache invalidate。
- 設計系統:沿用既有金色主題(`theme.config.js`)。

### 10.3 新增 DB Schema(`migrations/007_runtime_config_and_demo_scripts.sql`)

```sql
CREATE TABLE runtime_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,         -- JSON-encoded
  type        TEXT NOT NULL,         -- 'number' | 'string' | 'bool' | 'json'
  description TEXT,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by  TEXT
);

-- demo script enable / override
CREATE TABLE demo_script_config (
  id          TEXT PRIMARY KEY,      -- 'facility' | 'repair' | 'visitor' | 'complaint'
  enabled     INTEGER NOT NULL DEFAULT 1,
  steps_json  TEXT,                  -- 若 NULL → 用 code 內預設;否則 override
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 預設值 seed
INSERT INTO runtime_config (key, value, type, description) VALUES
  ('line.rateLimit.perMinute',        '10',       'number', 'Per-LINE-user messages allowed per minute'),
  ('line.rateLimit.perDay',           '200',      'number', 'Per-LINE-user messages allowed per day'),
  ('ai.openai.model',                 '"gpt-4o-mini"', 'string', 'OpenAI model for intent classification'),
  ('ai.openai.temperature',           '0.1',      'number', 'OpenAI temperature'),
  ('ai.confidenceThreshold',          '0.6',      'number', 'Below this triggers clarification'),
  ('demo.bannerEnabled',              'true',     'bool',   'Prefix bot replies with 🧪 [DEMO]'),
  ('demo.adminLineUserIds',           '[]',       'json',   'LINE user IDs allowed /role admin and /demo reset');
```

### 10.4 Dashboard 子頁(對應 A1-A6)

| 路徑 | 對應 | 內容 |
|---|---|---|
| `/admin/line/logs` | A1 | 即時 LINE log table + 篩選(user / 時間 / intent / direction) + 自動 refresh(5s polling) |
| `/admin/line/config` | A2 | 表單編輯 `runtime_config`,每行 inline edit + save,改完 server in-memory cache 失效 |
| `/admin/line/scripts` | A3 | List 4 腳本 + enable toggle + 「編輯 steps」JSON editor(monaco-react,只在這頁加載) |
| `/admin/line/users` | A4 | List `line_user`,可改 role / language / 踢人(soft delete `is_demo=1` 的可整批清) |
| `/admin/line/health` | A5 | 今日訊息數、OpenAI token 用量(從 `line_message_log` aggregate)、平均延遲、錯誤率 |
| `/admin/line/push` | A6 | 選 line_user → 輸入文字 → push 出去(debug only,有「DEBUG_PUSH」標記寫入 log) |

### 10.5 新增 tRPC procedures(`src/server/routers/lineAdminRouter.ts`)

```ts
export const lineAdminRouter = router({
  // A1
  logs: { list: protectedProcedure.query(...) },
  // A2
  config: {
    list: protectedProcedure.query(...),
    set:  protectedProcedure.input(z.object({ key: z.string(), value: z.unknown() })).mutation(...),
  },
  // A3
  scripts: {
    list: protectedProcedure.query(...),
    setEnabled: protectedProcedure.input(z.object({ id, enabled })).mutation(...),
    setSteps:   protectedProcedure.input(z.object({ id, steps })).mutation(...),
  },
  // A4
  users: {
    list:    protectedProcedure.query(...),
    setRole: protectedProcedure.mutation(...),
    purgeDemo: protectedProcedure.mutation(...),  // delete WHERE is_demo=1
  },
  // A5
  health: protectedProcedure.query(...),  // aggregate from line_message_log
  // A6
  manualPush: protectedProcedure.mutation(...),
});
```

所有 procedures 都需 `ctx.user.role === 'admin'`(既有 `protectedProcedure` 不夠,需新加 `adminProcedure`)。

### 10.6 Runtime Config 讀取

新增 `src/server/line/runtime-config.ts`:

```ts
let cache: Record<string, unknown> | null = null;

export async function loadConfig(): Promise<void> {
  const rows = await db.select().from(runtimeConfig);
  cache = Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.value)]));
}

export function get<T>(key: string, fallback: T): T {
  if (!cache) throw new Error('runtime-config not loaded');
  return (cache[key] as T) ?? fallback;
}

export function invalidate(): void {
  cache = null;
}
```

LINE 模組所有 `process.env.OPENAI_MODEL` 等讀取改成 `runtimeConfig.get(...)`。env 仍保留作為**首次部署的 seed 值**,DB 一旦寫入即覆蓋。

### 10.7 Auth(誰能進 dashboard)

- 沿用既有 `users.role` 機制;dashboard 路由用 `useAuth() + role==='admin'` 守衛。
- demo profile 的初始 admin user 由 `db:init:demo` seed:`email='admin@demo.local', password='demo-admin'`(README 寫死,部署後立刻改密碼)。

### 10.8 安全 / 防呆

| 風險 | 防護 |
|---|---|
| Config 改錯把 bot 弄掛(e.g., temperature=999) | 每個 key 在 procedure 用 `zod` schema 限值域;失敗回錯誤訊息不寫 DB |
| 手動 push 被濫發 | `manualPush` 每 admin 每分鐘上限 5 次;每筆寫 log + `direction='outbound:debug'` 可追溯 |
| Script JSON editor 出語法錯 | `setSteps` 用 `DemoStepSchema.array().parse(...)` 驗,失敗 422 |
| Config cache stale | mutation 後 server in-memory `invalidate()` + 用 `setTimeout(invalidate, 60_000)` 兜底 |

### 10.9 不做(留 v2)

- audit log signing / tamper-proof
- RBAC granular(只有 binary admin / non-admin)
- log 匯出 CSV / S3 long-term retention
- 多 admin 的協同編輯衝突偵測
- Webhook 設定本身可調(channel secret 仍走 env)

---

## 11. 後續步驟

設計確認後,進入 `superpowers:writing-plans` 產出步驟化實作計畫,計畫切成這幾個 phase:

1. **Phase 0** — 環境準備(LINE channel 申請、Render 建 service、env 設定)
2. **Phase 1** — Profile 切換骨架 + DB schema(006)+ `/health`
3. **Phase 2** — Webhook 接通(驗簽 + ack + echo bot)
4. **Phase 3** — AI 抽象層 + `openai-intent` 實作 + unit test
5. **Phase 4** — Resident handler + Flex 模板 + slot filling state machine
6. **Phase 5** — Housekeeper handler + push 通知
7. **Phase 6** — `/demo` 腳本引擎 + 4 個腳本
8. **Phase 7** — 多語 + 指令 + rate limit + 安全強化(讀 runtime_config)
9. **Phase 8** — 部署 + cron 設定 + manual smoke + 文件
10. **Phase 9** — Admin Dashboard:DB 007 migration + `runtime-config.ts` + `lineAdminRouter` + `src/app/admin/line/*` 6 個子頁
