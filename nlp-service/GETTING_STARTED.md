# NLP 服務 - 快速開始指南

## 🚀 5 分鐘快速開始

### 步驟 1: 安裝依賴（2 分鐘）

```bash
cd nlp-service

# 創建虛擬環境
python -m venv venv

# 激活虛擬環境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安裝依賴
pip install -r requirements.txt
```

### 步驟 2: 下載基礎模型（2 分鐘）

```bash
# 下載 3 個基礎模型（~500MB）
python batch_download.py download --category essential
```

這會下載：
- `intent-bert-tiny` - 意圖分類
- `sentiment-bert` - 情感分析
- `ner-bert-base` - 命名實體識別

### 步驟 3: 啟動服務（1 分鐘）

```bash
# Windows:
start.bat

# Linux/Mac:
bash start.sh
```

服務將在 `http://localhost:8000` 啟動

### 步驟 4: 測試 API

```bash
# 測試意圖分類
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I need to fix my air conditioner",
    "task": "intent"
  }'

# 查看 API 文檔
# 打開瀏覽器訪問: http://localhost:8000/docs
```

---

## 📦 配置選項

### 選項 A: 最小配置（開發）

```bash
# 只下載基礎模型
python batch_download.py download --category essential
```

- **模型數**: 3 個
- **磁盤空間**: ~500MB
- **下載時間**: ~2-5 分鐘
- **適用**: 快速開發和測試

### 選項 B: 中文支持（測試）

```bash
# 下載基礎 + 中文模型
python batch_download.py download --category essential
python batch_download.py download --category chinese
```

- **模型數**: 9 個
- **磁盤空間**: ~2GB
- **下載時間**: ~10-15 分鐘
- **適用**: 中文應用測試

### 選項 C: 完整配置（生產）

```bash
# 下載所有推薦模型
python batch_download.py all
```

- **模型數**: 19 個
- **磁盤空間**: ~5GB
- **下載時間**: ~30-40 分鐘
- **適用**: 生產環境部署

---

## 🧪 驗證安裝

### 方法 1: 使用測試腳本

```bash
# 完整測試
python test_models.py full
```

這會測試：
1. ✅ 模型註冊表
2. ✅ 模型下載
3. ✅ 模型加載
4. ✅ 模型推理

### 方法 2: 使用 API

```bash
# 1. 檢查服務健康
curl http://localhost:8000/health

# 2. 查看已下載的模型
curl "http://localhost:8000/models?downloaded_only=true"

# 3. 測試分析
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "test", "task": "intent"}'

# 4. 查看 MLOps 狀態
curl http://localhost:8000/mlops/dashboard
```

---

## 📊 常用命令

### 模型管理

```bash
# 查看所有模型
python download_models.py list

# 查看統計
python download_models.py stats

# 下載特定模型
python download_models.py download --task classification

# 查看推薦模型
python batch_download.py show
```

### 服務管理

```bash
# 啟動服務
# Windows: start.bat
# Linux/Mac: bash start.sh

# 停止服務
# Ctrl+C

# 查看日誌
# 服務會在控制台輸出日誌
```

### 測試

```bash
# 測試特定模型
python test_models.py inference \
  --model intent-bert-tiny \
  --text "I need help"

# 測試下載
python test_models.py download --model sentiment-bert

# 測試加載
python test_models.py load --model ner-bert-base
```

---

## 🌐 API 端點

### 核心端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/health` | GET | 健康檢查 |
| `/analyze` | POST | 分析文本 |
| `/batch-analyze` | POST | 批量分析 |
| `/models` | GET | 列出模型 |
| `/models/stats` | GET | 模型統計 |
| `/mlops/health` | GET | MLOps 健康狀態 |
| `/mlops/dashboard` | GET | MLOps 儀表板 |
| `/docs` | GET | API 文檔 |

### 使用示例

```bash
# 意圖分類
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "I need maintenance", "task": "intent"}'

# 情感分析
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "The neighbor is noisy", "task": "sentiment"}'

# 實體提取
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Book gym at 3pm tomorrow", "task": "entity"}'

# 批量分析
curl -X POST http://localhost:8000/batch-analyze \
  -H "Content-Type: application/json" \
  -d '[
    {"text": "text1", "task": "intent"},
    {"text": "text2", "task": "sentiment"}
  ]'
```

---

## 🔧 配置

### 環境變量

創建 `.env` 文件（可選）：

```env
# 服務配置
HOST=0.0.0.0
PORT=8000

# 模型池配置
POOL_SIZE=3
MAX_QUEUE_SIZE=100

# 日誌級別
LOG_LEVEL=INFO
```

### 模型配置

編輯 `config/settings.py` 來自定義模型配置。

---

## 🚨 故障排除

### 問題 1: 下載失敗

```bash
# 檢查網絡
ping huggingface.co

# 重試下載
python batch_download.py download --category essential --force
```

### 問題 2: 服務無法啟動

```bash
# 檢查端口
netstat -ano | findstr :8000  # Windows
lsof -i :8000                 # Linux/Mac

# 更換端口
export PORT=8001
uvicorn main:app --port 8001
```

### 問題 3: 推理錯誤

```bash
# 檢查模型狀態
curl http://localhost:8000/mlops/health

# 重新下載模型
python download_models.py download --task classification --force

# 測試模型
python test_models.py full
```

---

## 📚 下一步

### 學習更多

- [完整 README](README.md) - 詳細文檔
- [模型下載指南](MODEL_DOWNLOAD_GUIDE.md) - 下載詳情
- [快速參考](QUICK_REFERENCE.md) - 命令參考
- [MLOps 文檔](../docs/MLOPS.md) - 監控系統

### 集成到主應用

參考 [NLP 集成指南](../docs/NLP_INTEGRATION.md) 了解如何將 NLP 服務集成到主應用。

### 生產部署

參考 [部署指南](../docs/DEPLOYMENT.md) 了解生產環境部署。

---

## ✅ 檢查清單

完成以下步驟確保一切正常：

- [ ] 安裝依賴
- [ ] 下載基礎模型
- [ ] 啟動服務
- [ ] 測試 API
- [ ] 查看文檔
- [ ] 運行測試腳本

---

**需要幫助？**

- 查看 [故障排除](#-故障排除)
- 閱讀 [完整文檔](README.md)
- 運行 `python test_models.py full`

---

**版本**: 1.0.0  
**最後更新**: 2026-02-15

🎉 **開始使用 NLP 服務！** 🎉
