# m'AI Touch - 數據庫設置指南

## 快速開始

### 選項 1: 使用 SQLite（推薦用於開發）

最簡單的方式，無需額外配置：

```bash
# 1. 設置環境變量（或使用默認值）
echo "DB_TYPE=sqlite" > .env
echo "SQLITE_FILENAME=./data/mai-touch.db" >> .env

# 2. 初始化數據庫（包含遷移和示例數據）
npm run db:init

# 3. 啟動服務器
npm run server
```

就這麼簡單！數據庫文件會自動創建在 `./data/mai-touch.db`。

### 選項 2: 使用 MySQL

```bash
# 1. 安裝 MySQL（如果尚未安裝）
# Windows: 下載 MySQL Installer
# Mac: brew install mysql
# Linux: sudo apt-get install mysql-server

# 2. 創建數據庫
mysql -u root -p
CREATE DATABASE mai_touch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 3. 設置環境變量
echo "DB_TYPE=mysql" > .env
echo "DATABASE_URL=mysql://root:your_password@localhost:3306/mai_touch" >> .env

# 4. 初始化數據庫
npm run db:init

# 5. 啟動服務器
npm run server
```

### 選項 3: 使用 PostgreSQL

```bash
# 1. 安裝 PostgreSQL（如果尚未安裝）
# Windows: 下載 PostgreSQL Installer
# Mac: brew install postgresql
# Linux: sudo apt-get install postgresql

# 2. 創建數據庫
psql -U postgres
CREATE DATABASE mai_touch;
\q

# 3. 設置環境變量
echo "DB_TYPE=postgres" > .env
echo "DATABASE_URL=postgres://postgres:your_password@localhost:5432/mai_touch" >> .env

# 4. 初始化數據庫
npm run db:init

# 5. 啟動服務器
npm run server
```

## 數據庫命令

### 初始化數據庫（推薦）

一鍵完成遷移和示例數據創建：

```bash
npm run db:init
```

這會：
1. 連接到數據庫
2. 運行所有遷移
3. 創建示例數據（用戶、設施、預約等）
4. 驗證數據完整性

### 僅運行遷移

如果只想運行遷移而不創建示例數據：

```bash
npm run db:migrate
```

### 重置數據庫

⚠️ 警告：這會刪除所有數據！

```bash
npm run db:reset
```

### 回滾遷移

回滾最後一次遷移（僅用於開發）：

```bash
npm run db:rollback
```

## 環境配置

### SQLite 配置（默認）

```env
DB_TYPE=sqlite
SQLITE_FILENAME=./data/mai-touch.db
```

### MySQL 配置

使用連接字符串：
```env
DB_TYPE=mysql
DATABASE_URL=mysql://user:password@host:port/database
```

或使用獨立配置：
```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=mai_touch
```

### PostgreSQL 配置

使用連接字符串：
```env
DB_TYPE=postgres
DATABASE_URL=postgres://user:password@host:port/database
```

或使用獨立配置：
```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=mai_touch
```

## 數據庫切換

可以輕鬆在不同數據庫之間切換：

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

## 示例數據

`npm run db:init` 會創建以下示例數據：

### 用戶
- Alexander Whitmore (admin)
- Victoria Chen (user)

### 設施
- Private Dining Room
- Infinity Pool
- Wellness Spa
- Private Cinema
- Fitness Center

### 預約
- 明天的晚餐預約

### 工作訂單
- HVAC 維護請求

## 數據庫文件位置

### SQLite
- 開發: `./data/mai-touch.db`
- 測試: `./data/mai-touch-test.db`

### MySQL
- 數據目錄由 MySQL 配置決定
- 通常在 `/var/lib/mysql/` (Linux) 或 `C:\ProgramData\MySQL\` (Windows)

### PostgreSQL
- 數據目錄由 PostgreSQL 配置決定
- 通常在 `/var/lib/postgresql/` (Linux) 或 `C:\Program Files\PostgreSQL\` (Windows)

## 備份和恢復

### SQLite

備份：
```bash
cp ./data/mai-touch.db ./data/backup-$(date +%Y%m%d).db
```

恢復：
```bash
cp ./data/backup-20260215.db ./data/mai-touch.db
```

### MySQL

備份：
```bash
mysqldump -u root -p mai_touch > backup.sql
```

恢復：
```bash
mysql -u root -p mai_touch < backup.sql
```

### PostgreSQL

備份：
```bash
pg_dump -U postgres mai_touch > backup.sql
```

恢復：
```bash
psql -U postgres mai_touch < backup.sql
```

## 故障排除

### SQLite: "database is locked"

```bash
# 確保沒有其他進程使用數據庫
# 或刪除鎖文件
rm ./data/mai-touch.db-shm
rm ./data/mai-touch.db-wal
```

### MySQL: "Access denied"

```bash
# 檢查用戶權限
mysql -u root -p
GRANT ALL PRIVILEGES ON mai_touch.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

### PostgreSQL: "connection refused"

```bash
# 檢查服務是否運行
# Windows: services.msc
# Mac/Linux: sudo systemctl status postgresql
```

## 性能優化

### SQLite

```sql
-- 啟用 WAL 模式
PRAGMA journal_mode = WAL;

-- 增加緩存
PRAGMA cache_size = -64000;
```

### MySQL

```sql
-- 優化查詢緩存
SET GLOBAL query_cache_size = 67108864;
```

### PostgreSQL

```sql
-- 增加工作內存
SET work_mem = '64MB';
```

## 更多信息

詳細文檔請參考：
- [數據庫配置指南](./docs/DATABASE.md)
- [部署指南](./docs/DEPLOYMENT.md)
- [開發指南](./docs/DEVELOPMENT.md)

---

**提示**: 開發時使用 SQLite，生產環境使用 MySQL 或 PostgreSQL。