# m'AI Touch - 數據庫配置指南

## 概覽

m'AI Touch 支持多種數據庫類型，可以根據不同環境選擇合適的數據庫：

- **SQLite** - 開發環境，快速啟動，無需額外配置
- **MySQL** - 生產環境，高性能，適合大規模部署
- **PostgreSQL** - 生產環境，功能豐富，適合複雜查詢

## 快速開始

### 使用 SQLite（推薦用於開發）

1. 設置環境變量：
```bash
DB_TYPE=sqlite
SQLITE_FILENAME=./data/mai-touch.db
```

2. 運行遷移：
```bash
npm run db:migrate
```

3. 啟動服務器：
```bash
npm run server
```

SQLite 數據庫文件會自動創建在 `./data/mai-touch.db`。

### 使用 MySQL

1. 安裝 MySQL 服務器

2. 創建數據庫：
```sql
CREATE DATABASE mai_touch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. 設置環境變量：
```bash
DB_TYPE=mysql
DATABASE_URL=mysql://user:password@localhost:3306/mai_touch
```

或使用獨立配置：
```bash
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=mai_touch
```

4. 運行遷移：
```bash
npm run db:migrate
```

### 使用 PostgreSQL

1. 安裝 PostgreSQL 服務器

2. 創建數據庫：
```sql
CREATE DATABASE mai_touch;
```

3. 設置環境變量：
```bash
DB_TYPE=postgres
DATABASE_URL=postgres://user:password@localhost:5432/mai_touch
```

或使用獨立配置：
```bash
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=mai_touch
```

4. 運行遷移：
```bash
npm run db:migrate
```

## 數據庫遷移

### 應用遷移

```bash
npm run db:migrate
```

這會自動檢測數據庫類型並應用相應的遷移文件。

### 回滾遷移

```bash
npm run db:rollback
```

⚠️ 注意：回滾功能僅用於開發環境。

### 重置數據庫

```bash
npm run db:reset
```

⚠️ 警告：這會刪除所有數據！僅用於開發環境。

## 遷移文件結構

```
migrations/
├── sqlite/           # SQLite 遷移文件
│   └── 0001_initial_schema.sql
├── mysql/            # MySQL 遷移文件（使用原有的）
│   ├── 0001_absurd_zeigeist.sql
│   └── 0002_oauth_sessions.sql
└── postgres/         # PostgreSQL 遷移文件（待創建）
```

每種數據庫類型都有獨立的遷移文件，因為 SQL 語法可能有所不同。

## 數據庫適配器

系統使用數據庫適配器模式，自動處理不同數據庫的差異：

```typescript
import { dbManager } from './database/adapter';

// 連接數據庫（自動檢測類型）
const adapter = await dbManager.connect();

// 獲取數據庫實例
const db = dbManager.getDb();

// 獲取數據庫類型
const type = dbManager.getType(); // 'sqlite' | 'mysql' | 'postgres'
```

## 環境配置

### 開發環境

使用 SQLite，無需額外配置：

```env
DB_TYPE=sqlite
SQLITE_FILENAME=./data/mai-touch.db
```

### 測試環境

使用獨立的 SQLite 數據庫：

```env
DB_TYPE=sqlite
SQLITE_FILENAME=./data/mai-touch-test.db
```

### 生產環境

使用 MySQL 或 PostgreSQL：

```env
DB_TYPE=mysql
DATABASE_URL=mysql://user:password@production-host:3306/mai_touch

# 或
DB_TYPE=postgres
DATABASE_URL=postgres://user:password@production-host:5432/mai_touch
```

## 連接池配置

### MySQL 連接池

```typescript
// 在 adapter.ts 中配置
const connection = await mysql.createConnection({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  // 連接池配置
  connectionLimit: 10,
  queueLimit: 0,
  waitForConnections: true,
});
```

### PostgreSQL 連接池

```typescript
// 在 adapter.ts 中配置
const client = postgres(connectionString, {
  max: 10,              // 最大連接數
  idle_timeout: 20,     // 空閒超時（秒）
  connect_timeout: 10,  // 連接超時（秒）
});
```

## 性能優化

### SQLite 優化

```sql
-- 啟用 WAL 模式（提高並發性能）
PRAGMA journal_mode = WAL;

-- 設置緩存大小（KB）
PRAGMA cache_size = -64000;

-- 啟用外鍵約束
PRAGMA foreign_keys = ON;
```

### MySQL 優化

```sql
-- 設置字符集
SET NAMES utf8mb4;

-- 優化查詢緩存
SET GLOBAL query_cache_size = 67108864;
SET GLOBAL query_cache_type = 1;
```

### PostgreSQL 優化

```sql
-- 設置工作內存
SET work_mem = '64MB';

-- 設置共享緩衝區
SET shared_buffers = '256MB';
```

## 備份和恢復

### SQLite 備份

```bash
# 備份
cp ./data/mai-touch.db ./data/mai-touch-backup-$(date +%Y%m%d).db

# 恢復
cp ./data/mai-touch-backup-20260215.db ./data/mai-touch.db
```

### MySQL 備份

```bash
# 備份
mysqldump -u root -p mai_touch > backup-$(date +%Y%m%d).sql

# 恢復
mysql -u root -p mai_touch < backup-20260215.sql
```

### PostgreSQL 備份

```bash
# 備份
pg_dump -U postgres mai_touch > backup-$(date +%Y%m%d).sql

# 恢復
psql -U postgres mai_touch < backup-20260215.sql
```

## 故障排除

### SQLite 文件鎖定

如果遇到 "database is locked" 錯誤：

1. 確保沒有其他進程正在使用數據庫
2. 啟用 WAL 模式：`PRAGMA journal_mode = WAL;`
3. 增加超時時間：`PRAGMA busy_timeout = 5000;`

### MySQL 連接失敗

1. 檢查 MySQL 服務是否運行
2. 驗證用戶名和密碼
3. 確認防火牆允許連接
4. 檢查 MySQL 用戶權限

### PostgreSQL 連接失敗

1. 檢查 PostgreSQL 服務是否運行
2. 驗證 `pg_hba.conf` 配置
3. 確認端口 5432 是否開放
4. 檢查用戶權限

## 數據庫監控

### 查看連接狀態

```typescript
// 獲取數據庫類型
const type = dbManager.getType();
console.log(`Database type: ${type}`);

// 檢查連接
const adapter = dbManager.getAdapter();
if (adapter) {
  console.log('Database connected');
} else {
  console.log('Database not connected');
}
```

### 性能監控

```typescript
// 記錄查詢時間
const start = Date.now();
const result = await db.query(...);
const duration = Date.now() - start;
console.log(`Query took ${duration}ms`);
```

## 最佳實踐

1. **開發使用 SQLite**：快速啟動，無需配置
2. **生產使用 MySQL/PostgreSQL**：更好的性能和可擴展性
3. **定期備份**：設置自動備份計劃
4. **監控性能**：記錄慢查詢，優化索引
5. **使用連接池**：避免頻繁創建連接
6. **參數化查詢**：防止 SQL 注入
7. **事務處理**：確保數據一致性

## 相關文檔

- [部署指南](./DEPLOYMENT.md)
- [API 文檔](./API.md)
- [開發指南](./DEVELOPMENT.md)

---

**最後更新**: 2026-02-15