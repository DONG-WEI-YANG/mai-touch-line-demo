# m'AI Touch - 部署指南

**狀態**: 預留給未來真實主機使用  
**更新日期**: 2026-02-15

## 📋 概述

本文檔說明如何將 m'AI Touch 系統部署到生產環境。所有配置文件已預先準備好，可直接用於真實主機部署。

## 🏗️ 系統架構

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy)                 │
│                    Port: 80/443                          │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐    ┌──────────────────┐
│   Main App       │    │   NLP Service    │
│   Node.js:3000   │    │   Python:8000    │
└────────┬─────────┘    └──────────────────┘
         │
         ▼
┌──────────────────┐    ┌──────────────────┐
│   MySQL:3306     │    │   Redis:6379     │
└──────────────────┘    └──────────────────┘
```

## 🚀 部署方式

### 方式 1: Docker Compose (推薦)

#### 前置要求
- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM
- 20GB+ 磁盤空間

#### 步驟

1. **準備環境變量**

創建 `.env.production` 文件：

```env
# Database
DATABASE_URL=mysql://mai_user:your_password@db:3306/mai_touch
MYSQL_ROOT_PASSWORD=your_root_password
MYSQL_USER=mai_user
MYSQL_PASSWORD=your_password

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Session
SESSION_SECRET=your_random_secret_key_here

# NLP Service
NLP_SERVICE_URL=http://nlp-service:8000
NLP_SERVICE_ENABLED=true

# Node Environment
NODE_ENV=production
```

2. **構建和啟動服務**

```bash
# 構建鏡像
docker-compose build

# 啟動所有服務
docker-compose up -d

# 查看日誌
docker-compose logs -f

# 查看服務狀態
docker-compose ps
```

3. **驗證部署**

```bash
# 檢查主應用
curl http://localhost:3000/api/health

# 檢查 NLP 服務
curl http://localhost:8000/health

# 檢查數據庫
docker-compose exec db mysql -u mai_user -p mai_touch
```

4. **停止服務**

```bash
# 停止所有服務
docker-compose down

# 停止並刪除數據
docker-compose down -v
```

### 方式 2: 手動部署

#### 主應用部署

```bash
# 1. 安裝依賴
npm install --production

# 2. 構建 TypeScript
npm run build

# 3. 設置環境變量
export NODE_ENV=production
export DATABASE_URL=your_database_url
export OPENAI_API_KEY=your_api_key

# 4. 運行數據庫遷移
npm run db:migrate

# 5. 啟動應用
npm start

# 或使用 PM2
pm2 start dist/server/index.js --name mai-touch-app
```

#### NLP 服務部署

```bash
cd nlp-service

# 1. 創建虛擬環境
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 2. 安裝依賴
pip install -r requirements.txt

# 3. 下載模型
python download_models.py

# 4. 啟動服務
python main.py

# 或使用 Gunicorn
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## 🔒 安全配置

### 1. HTTPS 配置

更新 `nginx.conf` 啟用 HTTPS：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # ... 其他配置
}
```

### 2. 防火牆規則

```bash
# 只開放必要端口
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 3. 環境變量安全

- 使用強密碼
- 定期輪換密鑰
- 不要提交 `.env` 文件到版本控制

## 📊 監控和日誌

### 應用日誌

```bash
# Docker Compose
docker-compose logs -f app
docker-compose logs -f nlp-service

# PM2
pm2 logs mai-touch-app
```

### 健康檢查

```bash
# 主應用
curl http://localhost:3000/api/health

# NLP 服務
curl http://localhost:8000/health

# 數據庫
docker-compose exec db mysqladmin ping
```

### 性能監控

使用 PM2 監控：

```bash
pm2 install pm2-server-monit
pm2 monit
```

## 🔄 更新和維護

### 應用更新

```bash
# 1. 拉取最新代碼
git pull origin main

# 2. 安裝新依賴
npm install

# 3. 構建
npm run build

# 4. 重啟服務
docker-compose restart app
# 或
pm2 restart mai-touch-app
```

### 數據庫備份

```bash
# 備份
docker-compose exec db mysqldump -u root -p mai_touch > backup_$(date +%Y%m%d).sql

# 恢復
docker-compose exec -T db mysql -u root -p mai_touch < backup_20260215.sql
```

## 🌐 域名配置

### DNS 設置

```
A     @              your_server_ip
A     www            your_server_ip
A     api            your_server_ip
A     nlp            your_server_ip
```

### Nginx 虛擬主機

```nginx
server {
    server_name maitouch.com www.maitouch.com;
    # ... 主應用配置
}

server {
    server_name api.maitouch.com;
    # ... API 配置
}

server {
    server_name nlp.maitouch.com;
    # ... NLP 服務配置
}
```

## 📈 擴展配置

### 水平擴展

使用 Docker Swarm 或 Kubernetes：

```bash
# Docker Swarm
docker swarm init
docker stack deploy -c docker-compose.yml mai-touch

# 擴展服務
docker service scale mai-touch_app=3
docker service scale mai-touch_nlp-service=2
```

### 負載均衡

在 `nginx.conf` 中配置多個上游服務器：

```nginx
upstream app_server {
    server app1:3000;
    server app2:3000;
    server app3:3000;
}
```

## 🐛 故障排除

### 常見問題

1. **數據庫連接失敗**
   - 檢查 `DATABASE_URL` 配置
   - 確認數據庫服務運行中
   - 檢查網絡連接

2. **NLP 服務無響應**
   - 檢查模型是否下載完成
   - 確認內存足夠（至少 2GB）
   - 查看服務日誌

3. **端口被占用**
   - 修改 `docker-compose.yml` 中的端口映射
   - 或停止占用端口的服務

### 日誌位置

- 主應用: `/var/log/mai-touch/app.log`
- NLP 服務: `/var/log/mai-touch/nlp.log`
- Nginx: `/var/log/nginx/`

## 📞 支持

如遇到部署問題，請查看：
- [開發指南](DEVELOPMENT.md)
- [API 文檔](API.md)
- [系統完整度報告](SYSTEM_COMPLETENESS.md)

---

**注意**: 本文檔中的所有配置都已預先準備好，可直接用於生產環境部署。請根據實際需求調整配置參數。
