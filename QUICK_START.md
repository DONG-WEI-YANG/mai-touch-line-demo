# m'AI Touch - 快速開始指南

## ⚡ 5 分鐘快速啟動

### 1️⃣ 環境準備
確保已安裝：
- Node.js 18+
- MySQL 8.0+
- Git

### 2️⃣ 克隆和安裝
```bash
# 克隆項目
git clone <repository-url>
cd m-ai-touch

# Windows 用戶
npm run setup

# Linux/Mac 用戶
bash scripts/setup.sh
```

### 3️⃣ 配置環境
編輯 `.env` 文件：
```env
DATABASE_URL=mysql://user:password@localhost:3306/mai_touch
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
```

### 4️⃣ 啟動服務

**終端 1 - 後端:**
```bash
npm run dev:server
```

**終端 2 - 前端:**
```bash
npm start
```

### 5️⃣ 訪問應用
- iOS: 按 `i` 打開 iOS 模擬器
- Android: 按 `a` 打開 Android 模擬器
- Web: 按 `w` 在瀏覽器中打開
- 手機: 掃描 QR 碼使用 Expo Go

## 📱 常用命令

```bash
# 開發
npm start              # 啟動 Expo
npm run dev:server     # 啟動後端（熱重載）

# 測試
npm test              # 運行測試

# 類型檢查
npm run type-check    # TypeScript 檢查

# 清理
npm run clean         # 清理依賴和構建文件
```

## 🔍 項目結構速覽

```
m-ai-touch/
├── src/
│   ├── app/          # 📱 前端頁面
│   ├── components/   # 🧩 UI 組件
│   ├── hooks/        # 🪝 自定義 Hooks
│   ├── lib/          # 🛠️ 工具函數
│   └── server/       # 🖥️ 後端 API
├── tests/            # 🧪 測試文件
├── docs/             # 📚 文檔
├── assets/           # 🎨 資源文件
└── migrations/       # 🗄️ 數據庫遷移
```

## 🎯 核心功能

1. **AI 對話** - 與 Digital Brain 智能交互
2. **語音輸入** - 多語言語音識別
3. **設施預約** - 便捷的設施預訂系統
4. **工作訂單** - 維修和服務請求管理
5. **活動追蹤** - 實時查看服務狀態

## 📚 詳細文檔

- [開發指南](docs/DEVELOPMENT.md) - 完整開發流程
- [API 文檔](docs/API.md) - API 端點說明
- [項目結構](docs/PROJECT_STRUCTURE.md) - 目錄結構
- [設計文檔](docs/design.md) - UI/UX 設計

## 🆘 遇到問題？

1. 檢查 [項目狀態](docs/STATUS.md) 查看已知問題
2. 查看 [開發指南](docs/DEVELOPMENT.md) 的故障排除部分
3. 確保所有環境變量正確配置
4. 檢查 MySQL 數據庫是否正常運行

## 🚀 下一步

- 查看 [下一步計劃](docs/NEXT_STEPS.md) 了解開發路線圖
- 閱讀 [設計文檔](docs/design.md) 了解 UI/UX 規範
- 開始開發你的第一個功能！

---

**提示**: 首次運行可能需要下載依賴，請耐心等待。
