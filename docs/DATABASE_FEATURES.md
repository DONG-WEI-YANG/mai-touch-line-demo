# m'AI Touch - 數據庫功能總結

## 概覽

m'AI Touch 現在支持多種數據庫類型，提供靈活的數據存儲方案：

✅ **SQLite** - 開發環境，零配置啟動  
✅ **MySQL** - 生產環境，高性能  
✅ **PostgreSQL** - 生產環境，功能豐富

## 核心特性

### 1. 數據庫適配器系統

統一的數據庫接口，自動處理不同數據庫的差異：

```typescript
// 自動檢測並連接數據庫
const adapter = await dbManager.connect();

// 獲取數據庫實例
const db = dbManager.getDb();

// 獲取數據庫類型
const type = dbManager.getType(); // 'sqlite' | 'mysql' | 'postgres'
```

### 2. 自動遷移系統

支持多種數據庫的遷移文件：

```
migrations/
├── sqlite/           # SQLite 遷移
│   └── 0001_initial_schema.sql
├── mysql/            # MySQL 遷移
│   ├── 0001_absurd_zeigeist.sql
│   └── 0002_oauth_sessions.sql
└── postgres/         # PostgreSQL 遷移
    └── 0001_initial_schema.sql
```

### 3. 一鍵初始化

```bash
npm run db:init
```

自動完成：
- 數據庫連接
- 運行遷移
- 創建示例數據
- 驗證數據完整性

### 4. 環境配置

通過環境變量輕鬆切換數據庫：

```env
# SQLite（默認）
DB_TYPE=sqlite
SQLITE_FILENAME=./data/mai-touch.db

# MySQL
DB_TYPE=mysql
DATABASE_URL=mysql://user:password@host:3306/database

# PostgreSQL
DB_TYPE=postgres
DATABASE_URL=postgres://user:password@host:5432/database
```

## 文件結構

### 新增文件

```
src/server/database/
├── adapter.ts        # 數據庫適配器
└── migrate.ts        # 遷移工具

migrations/
├── sqlite/           # SQLite 遷移文件
├── mysql/            # MySQL 遷移文件（原有）
└── postgres/         # PostgreSQL 遷移文件

scripts/
└── init-db.ts        # 數據庫初始化腳本

docs/
├── DATABASE.md       # 數據庫配置指南
└── DATABASE_FEATURES.md  # 本文檔

DATABASE_SETUP.md     # 快速設置指南
```

### 更新文件

- `src/server/db.ts` - 使用新的數據庫適配器
- `package.json` - 添加數據庫依賴和腳本
- `.env.example` - 添加數據庫配置選項

## 使用場景

### 開發環境

使用 SQLite，無需額外配置：

```bash
# 1. 初始化數據庫
npm run db:init

# 2. 啟動服務器
npm run server
```

數據庫文件：`./data/mai-touch.db`

### 測試環境

使用獨立的 SQLite 數據庫：

```bash
# 設置測試數據庫
export SQLITE_FILENAME=./data/mai-touch-test.db

# 初始化測試數據庫
npm run db:init

# 運行測試
npm test
```

### 生產環境

使用 MySQL 或 PostgreSQL：

```bash
# 設置生產數據庫
export DB_TYPE=mysql
export DATABASE_URL=mysql://user:password@production-host:3306/mai_touch

# 運行遷移
npm run db:migrate

# 啟動服務器
npm run server
```

## 數據庫命令

### 初始化（推薦）

```bash
npm run db:init
```

包含遷移和示例數據。

### 僅遷移

```bash
npm run db:migrate
```

只運行遷移，不創建示例數據。

### 重置數據庫

```bash
npm run db:reset
```

⚠️ 刪除所有數據！僅用於開發。

### 回滾遷移

```bash
npm run db:rollback
```

回滾最後一次遷移。

## 示例數據

`npm run db:init` 創建的示例數據：

### 用戶（2個）
- Alexander Whitmore (admin) - alexander@example.com
- Victoria Chen (user) - victoria@example.com

### 設施（5個）
- Private Dining Room - 私人餐廳
- Infinity Pool - 無邊際泳池
- Wellness Spa - 水療中心
- Private Cinema - 私人影院
- Fitness Center - 健身中心

### 預約（1個）
- 明天的晚餐預約

### 工作訂單（1個）
- HVAC 維護請求

## 數據庫切換

輕鬆在不同數據庫之間切換：

```bash
# 切換到 SQLite
echo "DB_TYPE=sqlite" > .env
npm run db:init

# 切換到 MySQL
echo "DB_TYPE=mysql" > .env
echo "DATABASE_URL=mysql://..." >> .env
npm run db:init

# 切換到 PostgreSQL
echo "DB_TYPE=postgres" > .env
echo "DATABASE_URL=postgres://..." >> .env
npm run db:init
```

## 性能對比

| 特性 | SQLite | MySQL | PostgreSQL |
|------|--------|-------|------------|
| 設置難度 | ⭐ 極簡 | ⭐⭐⭐ 中等 | ⭐⭐⭐ 中等 |
| 性能 | ⭐⭐⭐ 良好 | ⭐⭐⭐⭐⭐ 優秀 | ⭐⭐⭐⭐⭐ 優秀 |
| 並發 | ⭐⭐ 有限 | ⭐⭐⭐⭐⭐ 優秀 | ⭐⭐⭐⭐⭐ 優秀 |
| 功能 | ⭐⭐⭐ 基礎 | ⭐⭐⭐⭐ 豐富 | ⭐⭐⭐⭐⭐ 最豐富 |
| 適用場景 | 開發/小型 | 生產/中大型 | 生產/複雜查詢 |

## 備份策略

### SQLite

```bash
# 每日備份
cp ./data/mai-touch.db ./data/backup-$(date +%Y%m%d).db
```

### MySQL

```bash
# 每日備份
mysqldump -u root -p mai_touch > backup-$(date +%Y%m%d).sql
```

### PostgreSQL

```bash
# 每日備份
pg_dump -U postgres mai_touch > backup-$(date +%Y%m%d).sql
```

## 監控和維護

### 檢查數據庫狀態

```typescript
import { dbManager } from './database/adapter';

// 獲取數據庫類型
const type = dbManager.getType();
console.log(`Database: ${type}`);

// 檢查連接
const adapter = dbManager.getAdapter();
if (adapter) {
  console.log('✓ Database connected');
}
```

### 查看數據統計

```typescript
import * as db from './db';

const stats = await db.getDashboardStats();
console.log('Users:', stats.totalUsers);
console.log('Bookings:', stats.totalBookings);
console.log('Work Orders:', stats.totalWorkOrders);
```

## 最佳實踐

1. **開發使用 SQLite** - 快速啟動，無需配置
2. **生產使用 MySQL/PostgreSQL** - 更好的性能和可擴展性
3. **定期備份** - 設置自動備份計劃
4. **監控性能** - 記錄慢查詢，優化索引
5. **使用連接池** - 避免頻繁創建連接
6. **參數化查詢** - 防止 SQL 注入
7. **事務處理** - 確保數據一致性

## 故障排除

### SQLite: "database is locked"

```bash
# 刪除鎖文件
rm ./data/mai-touch.db-shm
rm ./data/mai-touch.db-wal
```

### MySQL: "Access denied"

```sql
GRANT ALL PRIVILEGES ON mai_touch.* TO 'user'@'localhost';
FLUSH PRIVILEGES;
```

### PostgreSQL: "connection refused"

```bash
# 檢查服務狀態
sudo systemctl status postgresql
```

## 相關文檔

- [數據庫配置指南](./DATABASE.md) - 詳細配置說明
- [快速設置指南](../DATABASE_SETUP.md) - 快速開始
- [部署指南](./DEPLOYMENT.md) - 生產環境部署
- [開發指南](./DEVELOPMENT.md) - 開發環境設置

---

**最後更新**: 2026-02-15  
**版本**: 1.0.0