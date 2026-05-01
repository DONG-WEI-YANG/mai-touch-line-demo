# MLOps 系統文檔

## 概述

m'AI Touch NLP 服務集成了完整的 MLOps（機器學習運維）系統，包括：

- **100+ 預訓練模型註冊表**
- **模型性能監控**
- **健康檢查和告警**
- **使用統計追蹤**
- **自動化部署管理**

## 架構

```
┌─────────────────────────────────────────────────────────┐
│                    NLP Service API                       │
│                   (FastAPI + Uvicorn)                    │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Model Pool   │   │   Model      │   │   MLOps      │
│  Manager     │◄──┤  Registry    │◄──┤  Monitor     │
│ (3 instances)│   │ (100+ models)│   │ (Metrics)    │
└──────────────┘   └──────────────┘   └──────────────┘
```

## 模型註冊表

### 支持的模型類別

1. **意圖分類** (10個模型)
   - intent-bert-tiny, intent-distilbert, intent-roberta, etc.

2. **命名實體識別** (10個模型)
   - ner-bert-base, ner-chinese, ner-multilingual, etc.

3. **情感分析** (10個模型)
   - sentiment-bert, sentiment-chinese, sentiment-multilingual, etc.

4. **文本分類** (10個模型)
   - text-class-bert, topic-classification, spam-detection, etc.

5. **問答系統** (10個模型)
   - qa-bert, qa-chinese, qa-multilingual, etc.

6. **文本生成** (10個模型)
   - gen-gpt2, gen-t5-base, gen-bart, etc.

7. **翻譯模型** (10個模型)
   - trans-en-zh, trans-zh-en, trans-m2m100, etc.

8. **摘要模型** (10個模型)
   - sum-bart, sum-pegasus, sum-chinese, etc.

9. **嵌入模型** (10個模型)
   - embed-sentence-bert, embed-chinese, embed-multilingual, etc.

10. **零樣本分類** (10個模型)
    - zero-shot-bart, zero-shot-xlm-roberta, etc.

11. **專用模型** (20個模型)
    - toxicity-detection, fake-news-detection, emotion-detection, etc.

**總計**: 110 個預訓練模型

### 模型屬性

每個模型包含以下信息：

```python
{
    "name": "intent-bert-tiny",
    "version": "1.0",
    "task": "classification",
    "language": "multi",  # en, zh, multi
    "size": "tiny",       # tiny, small, base, large
    "source": "huggingface",
    "url": "https://huggingface.co/models/...",
    "downloaded": false,
    "usage_count": 0,
    "latency_ms": null,
    "accuracy": null
}
```

## API 端點

### 模型管理

#### 列出所有模型
```bash
GET /models?task=classification&language=zh&downloaded_only=true
```

**響應**:
```json
{
  "total": 10,
  "models": [
    {
      "name": "intent-chinese",
      "version": "1.0",
      "task": "classification",
      "language": "zh",
      "size": "base",
      "downloaded": true,
      "usage_count": 150,
      "latency_ms": 45.2
    }
  ]
}
```

#### 獲取模型統計
```bash
GET /models/stats
```

**響應**:
```json
{
  "total_models": 110,
  "downloaded_models": 25,
  "by_task": {
    "classification": 30,
    "ner": 10,
    "sentiment": 10
  },
  "by_language": {
    "en": 40,
    "zh": 30,
    "multi": 40
  },
  "most_used": [
    {
      "name": "intent-bert-tiny",
      "usage_count": 1500,
      "latency_ms": 35.5
    }
  ]
}
```

#### 下載模型
```bash
POST /models/{model_name}/download
```

**響應**:
```json
{
  "success": true,
  "message": "Model download started",
  "model": "intent-chinese"
}
```

### MLOps 監控

#### 獲取所有模型健康狀態
```bash
GET /mlops/health
```

**響應**:
```json
{
  "timestamp": "2026-02-15T10:30:00",
  "total_models": 3,
  "models": [
    {
      "name": "intent-bert-tiny",
      "status": "healthy",
      "avg_latency_ms": 35.5,
      "p95_latency_ms": 50.2,
      "success_rate": 0.98,
      "total_requests": 1500,
      "error_count": 30
    }
  ]
}
```

#### 獲取 MLOps 儀表板
```bash
GET /mlops/dashboard
```

**響應**:
```json
{
  "timestamp": "2026-02-15T10:30:00",
  "summary": {
    "total_models": 3,
    "healthy": 2,
    "degraded": 1,
    "unhealthy": 0,
    "total_requests": 5000,
    "total_errors": 50,
    "overall_success_rate": 0.99
  },
  "alerts": [
    {
      "model": "sentiment-bert",
      "status": "degraded",
      "reason": "Success rate: 92%, Latency: 850ms"
    }
  ]
}
```

#### 獲取特定模型健康狀態
```bash
GET /mlops/model/{model_name}
```

**響應**:
```json
{
  "model_name": "intent-bert-tiny",
  "status": "healthy",
  "metrics": {
    "avg_latency_ms": 35.5,
    "p95_latency_ms": 50.2,
    "p99_latency_ms": 65.8,
    "success_rate": 0.98,
    "total_requests": 1500,
    "error_count": 30
  },
  "last_error": null,
  "last_check": "2026-02-15T10:30:00"
}
```

## 命令行工具

### 下載模型

```bash
# 下載所有模型
python download_models.py download --all

# 按任務下載
python download_models.py download --task classification

# 按語言下載
python download_models.py download --language zh
```

### 列出模型

```bash
# 列出所有模型
python download_models.py list

# 按任務過濾
python download_models.py list --task sentiment

# 按語言過濾
python download_models.py list --language zh

# 按大小過濾
python download_models.py list --size tiny
```

### 查看統計

```bash
python download_models.py stats
```

**輸出示例**:
```
============================================================
模型統計信息
============================================================

總模型數: 110
已下載: 25
未下載: 85

按任務分類:
  classification: 30
  ner: 10
  sentiment: 10
  qa: 10
  generation: 10
  translation: 10
  summarization: 10
  embedding: 10
  zero-shot: 10

按語言分類:
  en: 40
  zh: 30
  multi: 40

按大小分類:
  tiny: 20
  small: 30
  base: 40
  large: 20

最常使用的模型:
  intent-bert-tiny: 1500 次
  sentiment-chinese: 1200 次
  ner-multilingual: 1000 次
============================================================
```

## 性能監控

### 監控指標

每個預測請求都會記錄以下指標：

- **延遲 (Latency)**: 處理時間（毫秒）
- **輸入長度**: 輸入文本字符數
- **輸出長度**: 輸出結果大小
- **成功/失敗**: 請求是否成功
- **錯誤信息**: 失敗原因
- **置信度**: 預測置信度

### 健康狀態判斷

模型健康狀態基於以下標準：

- **Healthy (健康)**:
  - 成功率 ≥ 95%
  - 平均延遲 ≤ 1000ms

- **Degraded (降級)**:
  - 成功率 90-95%
  - 或平均延遲 1000-2000ms

- **Unhealthy (不健康)**:
  - 成功率 < 90%
  - 或平均延遲 > 2000ms

### 指標存儲

- **內存緩存**: 最近 1000 條記錄
- **磁盤存儲**: 每 100 條記錄寫入一次
- **文件格式**: JSONL (每行一個 JSON 對象)
- **文件命名**: `{model_name}_{YYYYMMDD}.jsonl`
- **自動清理**: 7 天後自動刪除舊文件

## 告警系統

### 告警條件

系統會在以下情況發出告警：

1. **性能降級**
   - 成功率低於 95%
   - 平均延遲超過 1000ms

2. **服務不健康**
   - 成功率低於 90%
   - 平均延遲超過 2000ms

3. **錯誤率上升**
   - 錯誤數量異常增加

### 告警響應

告警會包含在 `/mlops/dashboard` 端點的響應中：

```json
{
  "alerts": [
    {
      "model": "sentiment-bert",
      "status": "degraded",
      "reason": "Success rate: 92%, Latency: 850ms"
    }
  ]
}
```

## 最佳實踐

### 模型選擇

1. **開發環境**: 使用 `tiny` 或 `small` 模型
2. **生產環境**: 使用 `base` 或 `large` 模型
3. **多語言**: 優先選擇 `multi` 語言模型
4. **特定語言**: 使用專門的語言模型（如 `zh` 中文模型）

### 性能優化

1. **預下載模型**: 在服務啟動前下載常用模型
2. **模型池化**: 使用 3-5 個並行實例
3. **緩存結果**: 對相同輸入緩存結果
4. **批量處理**: 使用 `/batch-analyze` 端點

### 監控建議

1. **定期檢查**: 每小時檢查 `/mlops/dashboard`
2. **設置告警**: 集成到監控系統（如 Prometheus）
3. **日誌分析**: 定期分析錯誤日誌
4. **性能基準**: 建立性能基準線

## 集成示例

### Python 客戶端

```python
import requests

# 列出模型
response = requests.get("http://localhost:8000/models")
models = response.json()

# 下載模型
response = requests.post(
    "http://localhost:8000/models/intent-chinese/download"
)

# 檢查健康狀態
response = requests.get("http://localhost:8000/mlops/health")
health = response.json()

# 分析文本
response = requests.post(
    "http://localhost:8000/analyze",
    json={
        "text": "我需要維修空調",
        "task": "intent",
        "language": "zh"
    }
)
result = response.json()
```

### TypeScript 客戶端

```typescript
// 列出模型
const models = await fetch('http://localhost:8000/models')
  .then(r => r.json());

// 下載模型
await fetch('http://localhost:8000/models/intent-chinese/download', {
  method: 'POST'
});

// 檢查健康狀態
const health = await fetch('http://localhost:8000/mlops/health')
  .then(r => r.json());

// 分析文本
const result = await fetch('http://localhost:8000/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: '我需要維修空調',
    task: 'intent',
    language: 'zh'
  })
}).then(r => r.json());
```

## 故障排除

### 常見問題

1. **模型下載失敗**
   - 檢查網絡連接
   - 檢查磁盤空間
   - 查看錯誤日誌

2. **性能降級**
   - 檢查系統資源（CPU、內存）
   - 增加模型池大小
   - 使用更小的模型

3. **高錯誤率**
   - 檢查輸入數據質量
   - 驗證模型是否正確加載
   - 查看詳細錯誤日誌

### 日誌位置

- **服務日誌**: 控制台輸出
- **指標日誌**: `./mlops/metrics/*.jsonl`
- **模型註冊表**: `./models/pretrained/registry.json`

## 未來擴展

### 計劃功能

1. **A/B 測試**: 比較不同模型性能
2. **自動擴展**: 根據負載自動調整實例數
3. **模型版本控制**: 管理多個模型版本
4. **實驗追蹤**: 記錄模型訓練實驗
5. **自動重訓練**: 基於性能自動觸發重訓練
6. **分布式部署**: 跨多個服務器部署模型

---

**文檔版本**: 1.0  
**最後更新**: 2026-02-15  
**維護者**: m'AI Touch Team
