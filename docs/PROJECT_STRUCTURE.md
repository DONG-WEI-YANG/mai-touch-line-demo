# m'AI Touch - 項目結構

## 📁 根目錄結構

```
m-ai-touch/
├── src/                    # 源代碼目錄
│   ├── app/               # 應用頁面 (Expo Router)
│   ├── components/        # 可重用組件
│   ├── hooks/            # 自定義 React Hooks
│   ├── lib/              # 工具函數和業務邏輯
│   └── server/           # 後端服務器代碼
├── tests/                 # 測試文件
├── docs/                  # 文檔
├── assets/               # 靜態資源（圖片等）
├── migrations/           # 數據庫遷移文件
├── .kiro/               # Kiro AI 配置
├── package.json         # 項目依賴
├── tsconfig.json        # TypeScript 配置
└── README.md            # 項目說明
```

## 📱 前端結構 (src/)

### app/ - 應用頁面
- `index.tsx` - 首頁 (AI 對話界面)
- `services.tsx` - 服務列表
- `activity.tsx` - 活動記錄
- `settings.tsx` - 設置頁面
- `my-bookings.tsx` - 我的預約
- `amenities/[id].tsx` - 設施詳情頁
- `_layout.tsx` - 根佈局

### components/ - 組件
- `ui/` - 基礎 UI 組件
- `screen-container.tsx` - 屏幕容器
- `icon-symbol.tsx` - 圖標組件
- `audio-waveform.tsx` - 音頻波形
- `routing-suggestion-card.tsx` - 路由建議卡片

### hooks/ - 自定義 Hooks
- `use-auth.ts` - 身份驗證
- `use-voice-recording.ts` - 語音錄製
- `use-colors.ts` - 主題顏色

### lib/ - 工具庫
- `amenities.ts` - 設施數據
- `calendar-utils.ts` - 日曆工具
- `engine.ts` - NLP 引擎
- `language-preference.ts` - 語言偏好
- `llm.ts` - LLM 集成
- `store.ts` - 狀態管理
- `trpc.ts` - tRPC 客戶端
- `types.ts` - TypeScript 類型
- `voice-router.ts` - 語音路由
- `voiceTranscription.ts` - 語音轉文字
- `app-context.tsx` - 應用上下文

## 🖥️ 後端結構 (src/server/)

### 核心文件
- `index.ts` - 服務器入口
- `routers.ts` - tRPC 路由定義
- `schema.ts` - 數據庫模式
- `db.ts` - 數據庫操作
- `admin.ts` - 管理員路由
- `audit-log.ts` - 審計日誌
- `auto-scaler.ts` - 自動擴展
- `scheduler.ts` - 任務調度
- `storage.ts` - 文件存儲
- `relations.ts` - 數據關聯

## 📊 數據庫表結構

### users - 用戶表
- 用戶基本信息
- 登錄方式
- 角色權限

### amenities - 設施表
- 設施名稱、描述
- 分類、容量
- 開放時間

### bookings - 預約表
- 用戶預約記錄
- 日期時間
- 狀態管理

### work_orders - 工作訂單表
- 維修請求
- 安全問題
- 禮賓服務

### chat_messages - 聊天記錄表
- 對話歷史
- 多語言支持

## 🧪 測試結構 (tests/)

- `amenities.test.ts` - 設施功能測試
- `calendar-utils.test.ts` - 日曆工具測試
- `language-preference.test.ts` - 語言偏好測試
- `nlp-engine.test.ts` - NLP 引擎測試
- `store.test.ts` - 狀態管理測試

## 📚 文檔結構 (docs/)

- `design.md` - 設計文檔
- `DOCS.md` - API 文檔
- `todo.md` - 待辦事項
- `ui-review-notes.txt` - UI 審查筆記
- `PROJECT_STRUCTURE.md` - 本文檔

## 🎨 資源結構 (assets/)

- 圖片文件
- 圖標資源
- 預覽截圖
