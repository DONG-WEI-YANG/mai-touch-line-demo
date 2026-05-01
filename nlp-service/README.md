# m'AI Touch NLP Service

獨立的 NLP 微服務，使用多個 Tiny NLP 模型和池化層進行智能調度。

## 🌟 特性

- **多模型池化**: 3個並行模型實例，自動負載均衡
- **輕量級模型**: 基於 DistilBERT 的 Tiny 模型
- **智能調度**: 自動選擇最佳可用模型
- **健康檢查**: 自動監控和恢復錯誤實例
- **高性能**: 異步處理，支持批量請求
- **獨立環境**: 使用虛擬環境，不影響全域

## 📋 系統要求

- Python 3.8+
- 4GB+ RAM
- 2GB+ 磁盤空間（用於模型緩存）

## 🚀 快速開始

### 1. 設置環境

**Windows:**
```bash
python setup.py
```

**Linux/Mac:**
```bash
python3 setup.py
```

### 2. 下載模型（推薦）

```bash
# 顯示推薦的模型
python batch_download.py show

# 下載基礎模型（必須）
python batch_download.py download --category essential

# 下載中文模型
python batch_download.py download --category chinese

# 下載所有推薦模型
python batch_download.py all

# 或使用詳細的下載工具
python download_models.py download --task classification
python download_models.py download --language zh
```

### 3. 測試模型（可選）

```bash
# 完整流程測試
python test_models.py full

# 測試特定模型
python test_models.py inference --model intent-bert-tiny --text "I need help"
```

### 4. 啟動服務

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
bash start.sh
```

### 5. 訪問 API

- API 文檔: http://localhost:8000/docs
- 健康檢查: http://localhost:8000/health
- 統計信息: http://localhost:8000/stats
- 模型列表: http://localhost:8000/models
- MLOps 儀表板: http://localhost:8000/mlops/dashboard

## 📡 API 使用

### 分析文本

```bash
curl -X POST "http://localhost:8000/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "空調壞了，需要維修",
    "task": "intent",
    "language": "zh"
  }'
```

### 批量分析

```bash
curl -X POST "http://localhost:8000/batch-analyze" \
  -H "Content-Type: application/json" \
  -d '[
    {"text": "預約健身房", "task": "intent"},
    {"text": "鄰居太吵了", "task": "sentiment"}
  ]'
```

## 🏗️ 架構

```
nlp-service/
├── main.py              # FastAPI 主服務
├── pool/
│   └── model_pool.py    # 模型池管理器
├── models/
│   └── tiny_nlp.py      # Tiny NLP 模型
├── config/
│   └── settings.py      # 配置管理
├── venv/                # 虛擬環境（自動創建）
└── models/cache/        # 模型緩存（自動下載）
```

## 🔧 配置

編輯 `config/settings.py` 或創建 `.env` 文件：

```env
# 模型池設置
POOL_SIZE=3
MAX_QUEUE_SIZE=100

# API 設置
API_HOST=0.0.0.0
API_PORT=8000

# 性能設置
MAX_TEXT_LENGTH=512
DEFAULT_TIMEOUT=5.0
```

## 📊 支持的任務

### 1. Intent Classification (意圖分類)
識別用戶意圖：
- amenity_booking (設施預約)
- maintenance_request (維修請求)
- security_concern (安全問題)
- noise_complaint (噪音投訴)
- guest_management (訪客管理)
- 等 20+ 種意圖

### 2. Sentiment Analysis (情感分析)
分析情緒和緊急程度：
- 情緒: neutral, fatigue, urgency, frustration, etc.
- 緊急度: low, medium, high, critical

### 3. Entity Extraction (實體提取)
提取關鍵信息：
- DATE (日期)
- TIME (時間)
- LOCATION (位置)
- PERSON (人名)
- AMENITY (設施)
- 等

## 🧪 測試

```bash
# 激活虛擬環境
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# 運行測試
pytest tests/
```

## 📈 性能指標

- 平均延遲: ~50-100ms
- 吞吐量: ~100 requests/second
- 模型大小: ~250MB (DistilBERT)
- 內存使用: ~1GB per instance

## 🔍 監控

查看實時統計：
```bash
curl http://localhost:8000/stats
```

返回：
```json
{
  "pool_size": 3,
  "idle_instances": 2,
  "busy_instances": 1,
  "total_requests": 1234,
  "avg_latency_ms": 75.5,
  "instances": [...]
}
```

## 🐛 故障排除

### 模型下載失敗
```bash
# 手動下載模型
python download_models.py
```

### 端口被占用
修改 `config/settings.py` 中的 `api_port`

### 內存不足
減少 `pool_size` 或使用更小的模型

## 📚 集成到主應用

在主應用的 `src/server/routers.ts` 中調用：

```typescript
// 調用 NLP 服務
const response = await fetch('http://localhost:8000/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: userMessage,
    task: 'intent',
    language: 'zh'
  })
});

const result = await response.json();
```

## 📄 許可證

Private - All Rights Reserved
