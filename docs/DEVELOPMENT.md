# m'AI Touch - 開發指南

## 🚀 快速開始

### 環境要求
- Node.js 18+
- npm 或 yarn
- MySQL 8.0+
- Expo CLI

### 安裝步驟

1. 克隆項目
```bash
git clone <repository-url>
cd m-ai-touch
```

2. 安裝依賴
```bash
npm install
```

3. 配置環境變量
```bash
cp .env.example .env
# 編輯 .env 文件，填入實際配置
```

4. 初始化數據庫
```bash
# 運行數據庫遷移
npm run db:migrate
```

5. 啟動開發服務器
```bash
# 啟動後端服務器
npm run dev:server

# 在另一個終端啟動前端
npm start
```

## 📱 開發工作流

### 前端開發
```bash
# 啟動 Expo 開發服務器
npm start

# iOS 模擬器
npm run ios

# Android 模擬器
npm run android

# Web 瀏覽器
npm run web
```

### 後端開發
```bash
# 啟動後端服務器（帶熱重載）
npm run dev:server

# 直接運行
npm run server
```

### 測試
```bash
# 運行所有測試
npm test

# 運行特定測試
npm test -- amenities.test.ts

# 測試覆蓋率
npm run test:coverage
```

## 🏗️ 架構說明

### 前端架構
- **框架**: React Native + Expo
- **路由**: Expo Router (文件系統路由)
- **狀態管理**: React Context + useReducer
- **API 調用**: tRPC + React Query
- **樣式**: StyleSheet (React Native)

### 後端架構
- **框架**: Express.js
- **API**: tRPC (類型安全)
- **數據庫**: MySQL + Drizzle ORM
- **身份驗證**: Cookie-based Session

### AI 功能
- **語音轉文字**: OpenAI Whisper API
- **對話生成**: OpenAI GPT API
- **NLP 分析**: 自定義意圖識別引擎

## 📝 編碼規範

### TypeScript
- 使用嚴格模式
- 明確定義類型，避免 `any`
- 使用接口定義數據結構

### React Native
- 使用函數組件和 Hooks
- 組件命名使用 PascalCase
- 文件名使用 kebab-case

### 命名約定
- 組件: `MyComponent.tsx`
- Hooks: `use-my-hook.ts`
- 工具函數: `my-utility.ts`
- 類型: `types.ts` 或 `my-types.ts`

## 🔧 常用命令

```bash
# 開發
npm start                 # 啟動 Expo
npm run server           # 啟動後端
npm run dev:server       # 啟動後端（熱重載）

# 測試
npm test                 # 運行測試
npm run test:watch       # 監視模式

# 構建
npm run build            # 構建生產版本

# 代碼檢查
npm run lint             # ESLint 檢查
npm run type-check       # TypeScript 類型檢查

# 數據庫
npm run db:migrate       # 運行遷移
npm run db:seed          # 填充測試數據
```

## 🐛 調試技巧

### 前端調試
- 使用 React Native Debugger
- Chrome DevTools (Web)
- Expo Go App (移動設備)

### 後端調試
- 使用 VS Code 調試器
- 添加 `console.log` 語句
- 查看服務器日誌

### API 調試
- 使用 Postman 或 Insomnia
- 檢查 tRPC 端點: `http://localhost:3000/api/trpc`
- 健康檢查: `http://localhost:3000/api/health`

## 📦 部署

### 前端部署
```bash
# 構建 Web 版本
npm run web:build

# 構建原生應用
eas build --platform ios
eas build --platform android
```

### 後端部署
```bash
# 構建 TypeScript
npm run build

# 啟動生產服務器
NODE_ENV=production npm start
```

## 🔐 安全注意事項

1. 永遠不要提交 `.env` 文件
2. 使用環境變量存儲敏感信息
3. 定期更新依賴包
4. 實施適當的輸入驗證
5. 使用 HTTPS 進行生產部署

## 📚 相關資源

- [Expo 文檔](https://docs.expo.dev/)
- [React Native 文檔](https://reactnative.dev/)
- [tRPC 文檔](https://trpc.io/)
- [Drizzle ORM 文檔](https://orm.drizzle.team/)
