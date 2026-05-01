# NLP 服務快速參考

## 🚀 快速啟動

### Windows
```bash
cd nlp-service
python setup.py
start.bat
```

### Linux/Mac
```bash
cd nlp-service
python3 setup.py
bash start.sh
```

服務地址: `http://localhost:8000`

---

## 📦 模型管理

### 下載所有模型
```bash
python download_models.py download --all
```

### 按任務下載
```bash
python download_models.py download --task classification
python download_models.py download --task sentiment
python download_models.py download --task ner
```

### 按語言下載
```bash
python download_models.py download --language zh
python download_models.py download --language en
```

### 列出模型
```bash
# 所有模型
python download_models.py list

# 按任務過濾
python download_models.py list --task sentiment

# 按語言過濾
python download_models.py list --language zh
```

### 查看統計
```bash
python download_models.py stats
```

---

## 🔌 API 端點

### 健康檢查
```bash
curl http://localhost:8000/health
```

### 分析文本
```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "我需要維修空調",
    "task": "intent",
    "language": "zh"
  }'
```

### 批量分析
```bash
curl -X POST http://localhost:8000/batch-analyze \
  -H "Content-Type: application/json" \
  -d '[
    {"text": "空調壞了", "task": "intent"},
    {"text": "鄰居太吵", "task": "sentiment"}
  ]'
```

### 列出模型
```bash
# 所有模型
curl http://localhost:8000/models

# 按任務過濾
curl "http://localhost:8000/models?task=classification"

# 按語言過濾
curl "http://localhost:8000/models?language=zh"

# 只顯示已下載
curl "http://localhost:8000/models?downloaded_only=true"
```

### 模型統計
```bash
curl http://localhost:8000/models/stats
```

### 下載模型
```bash
curl -X POST http://localhost:8000/models/intent-chinese/download
```

### MLOps 健康狀態
```bash
curl http://localhost:8000/mlops/health
```

### MLOps 儀表板
```bash
curl http://localhost:8000/mlops/dashboard
```

### 特定模型健康狀態
```bash
curl http://localhost:8000/mlops/model/intent-bert-tiny
```

---

## 📊 支持的任務

| 任務 | 說明 | 示例 |
|------|------|------|
| `intent` | 意圖分類 | "我需要維修" → maintenance_request |
| `sentiment` | 情感分析 | "鄰居太吵" → frustration |
| `entity` | 實體提取 | "明天3點" → DATE, TIME |
| `all` | 所有任務 | 返回所有分析結果 |

---

## 🎯 模型類別

### 1. 意圖分類 (10個)
- intent-bert-tiny
- intent-distilbert
- intent-roberta
- intent-xlm-roberta
- intent-albert
- intent-electra
- intent-deberta
- intent-chinese-bert
- intent-multilingual
- intent-domain-specific

### 2. 命名實體識別 (10個)
- ner-bert-base
- ner-chinese
- ner-multilingual
- ner-spacy-en
- ner-spacy-zh
- ner-flair
- ner-roberta
- ner-xlm-roberta
- ner-deberta
- ner-custom-property

### 3. 情感分析 (10個)
- sentiment-bert
- sentiment-roberta
- sentiment-chinese
- sentiment-multilingual
- sentiment-twitter
- sentiment-financial
- sentiment-hotel-review
- sentiment-product-review
- sentiment-distilbert
- sentiment-xlm-roberta

### 4. 文本分類 (10個)
- text-class-bert
- text-class-distilbert
- text-class-roberta
- text-class-chinese
- text-class-multilingual
- topic-classification
- spam-detection
- language-detection
- urgency-detection
- privacy-classification

### 5. 問答系統 (10個)
- qa-bert
- qa-roberta
- qa-chinese
- qa-multilingual
- qa-distilbert
- qa-albert
- qa-electra
- qa-deberta
- qa-xlm-roberta
- qa-domain-specific

### 6. 文本生成 (10個)
- gen-gpt2
- gen-gpt2-medium
- gen-gpt2-chinese
- gen-t5-small
- gen-t5-base
- gen-bart
- gen-pegasus
- gen-mbart
- gen-mt5
- gen-dialogue

### 7. 翻譯模型 (10個)
- trans-en-zh
- trans-zh-en
- trans-marian-en-zh
- trans-marian-zh-en
- trans-m2m100
- trans-mbart50
- trans-nllb
- trans-opus-mt
- trans-helsinki
- trans-google

### 8. 摘要模型 (10個)
- sum-bart
- sum-pegasus
- sum-t5
- sum-chinese
- sum-multilingual
- sum-distilbart
- sum-led
- sum-longformer
- sum-bigbird
- sum-extractive

### 9. 嵌入模型 (10個)
- embed-sentence-bert
- embed-mpnet
- embed-minilm
- embed-chinese
- embed-multilingual
- embed-labse
- embed-simcse
- embed-instructor
- embed-e5
- embed-bge

### 10. 零樣本分類 (10個)
- zero-shot-bart
- zero-shot-deberta
- zero-shot-xlm-roberta
- zero-shot-chinese
- zero-shot-multilingual
- zero-shot-nli
- zero-shot-mnli
- zero-shot-xnli
- zero-shot-anli
- zero-shot-custom

### 11. 專用模型 (20個)
- toxicity-detection
- hate-speech-detection
- fake-news-detection
- emotion-detection
- sarcasm-detection
- irony-detection
- stance-detection
- argument-mining
- fact-checking
- claim-detection
- relation-extraction
- event-extraction
- coreference-resolution
- dependency-parsing
- pos-tagging
- lemmatization
- tokenization
- spell-correction
- text-normalization
- keyword-extraction

**總計: 110 個模型**

---

## 🔍 MLOps 監控

### 健康狀態級別
- **healthy**: 成功率 ≥ 95%, 延遲 ≤ 1000ms
- **degraded**: 成功率 90-95%, 延遲 1000-2000ms
- **unhealthy**: 成功率 < 90%, 延遲 > 2000ms

### 監控指標
- 平均延遲 (avg_latency_ms)
- P95 延遲 (p95_latency_ms)
- P99 延遲 (p99_latency_ms)
- 成功率 (success_rate)
- 總請求數 (total_requests)
- 錯誤數 (error_count)

---

## 🐍 Python 客戶端示例

```python
import requests

# 分析文本
def analyze_text(text, task="intent", language="zh"):
    response = requests.post(
        "http://localhost:8000/analyze",
        json={
            "text": text,
            "task": task,
            "language": language
        }
    )
    return response.json()

# 使用
result = analyze_text("我需要維修空調", "intent", "zh")
print(f"意圖: {result['intent']['primary_intent']}")
print(f"置信度: {result['intent']['confidence']}")

# 檢查健康狀態
health = requests.get("http://localhost:8000/mlops/health").json()
print(f"健康模型數: {health['total_models']}")

# 查看統計
stats = requests.get("http://localhost:8000/models/stats").json()
print(f"總模型數: {stats['total_models']}")
print(f"已下載: {stats['downloaded_models']}")
```

---

## 💻 TypeScript 客戶端示例

```typescript
// 分析文本
async function analyzeText(
  text: string,
  task: string = "intent",
  language: string = "zh"
) {
  const response = await fetch("http://localhost:8000/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, task, language })
  });
  return await response.json();
}

// 使用
const result = await analyzeText("我需要維修空調", "intent", "zh");
console.log("意圖:", result.intent.primary_intent);
console.log("置信度:", result.intent.confidence);

// 檢查健康狀態
const health = await fetch("http://localhost:8000/mlops/health")
  .then(r => r.json());
console.log("健康模型數:", health.total_models);

// 查看統計
const stats = await fetch("http://localhost:8000/models/stats")
  .then(r => r.json());
console.log("總模型數:", stats.total_models);
console.log("已下載:", stats.downloaded_models);
```

---

## 🔧 配置

### 環境變量
```env
# 服務配置
HOST=0.0.0.0
PORT=8000

# 模型池配置
POOL_SIZE=3
MAX_QUEUE_SIZE=100
HEALTH_CHECK_INTERVAL=60

# 日誌級別
LOG_LEVEL=INFO
```

### 配置文件
`nlp-service/config/settings.py`

---

## 📁 文件結構

```
nlp-service/
├── main.py                 # FastAPI 主應用
├── download_models.py      # 模型下載工具
├── requirements.txt        # Python 依賴
├── setup.py               # 自動設置腳本
├── start.bat              # Windows 啟動腳本
├── start.sh               # Linux/Mac 啟動腳本
├── test_service.py        # 測試腳本
├── README.md              # 詳細文檔
├── QUICK_REFERENCE.md     # 快速參考（本文檔）
├── config/
│   ├── settings.py        # 配置管理
│   └── __init__.py
├── models/
│   ├── model_registry.py  # 模型註冊表（110個模型）
│   ├── tiny_nlp.py        # Tiny NLP 模型
│   ├── __init__.py
│   └── pretrained/        # 預訓練模型目錄
├── pool/
│   ├── model_pool.py      # 模型池管理器
│   └── __init__.py
└── mlops/
    ├── model_monitor.py   # MLOps 監控
    └── metrics/           # 指標存儲目錄
```

---

## 🆘 故障排除

### 服務無法啟動
```bash
# 檢查端口是否被佔用
netstat -ano | findstr :8000  # Windows
lsof -i :8000                 # Linux/Mac

# 檢查 Python 版本
python --version  # 需要 3.8+

# 重新安裝依賴
pip install -r requirements.txt
```

### 模型下載失敗
```bash
# 檢查網絡連接
ping huggingface.co

# 檢查磁盤空間
df -h  # Linux/Mac
dir    # Windows

# 查看錯誤日誌
tail -f mlops/metrics/*.jsonl
```

### 性能問題
```bash
# 增加模型池大小
export POOL_SIZE=5

# 檢查系統資源
top     # Linux/Mac
taskmgr # Windows

# 查看 MLOps 儀表板
curl http://localhost:8000/mlops/dashboard
```

---

## 📚 相關文檔

- [詳細 README](README.md)
- [MLOps 文檔](../docs/MLOPS.md)
- [NLP 集成指南](../docs/NLP_INTEGRATION.md)
- [API 文檔](../docs/API.md)

---

**版本**: 1.0.0  
**最後更新**: 2026-02-15
