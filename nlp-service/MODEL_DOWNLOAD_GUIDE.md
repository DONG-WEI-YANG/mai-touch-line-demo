# 模型下載和使用指南

## 📦 模型下載方式

### 方式 1: 批量下載（推薦）

批量下載腳本提供了最簡單的方式來下載推薦的模型。

#### 查看推薦模型

```bash
python batch_download.py show
```

這會顯示所有推薦的模型，按類別分組：
- **essential**: 基礎模型（必須）
- **chinese**: 中文支持
- **multilingual**: 多語言支持
- **advanced**: 高級功能

#### 下載特定類別

```bash
# 下載基礎模型（最小配置）
python batch_download.py download --category essential

# 下載中文模型
python batch_download.py download --category chinese

# 下載多語言模型
python batch_download.py download --category multilingual

# 下載高級功能模型
python batch_download.py download --category advanced
```

#### 下載所有推薦模型

```bash
python batch_download.py all
```

這會下載所有推薦的模型（約 20 個），適合生產環境。

### 方式 2: 按需下載

使用 `download_models.py` 腳本可以更靈活地下載模型。

#### 下載所有模型

```bash
python download_models.py download --all
```

這會下載所有 110 個模型（需要大量時間和磁盤空間）。

#### 按任務下載

```bash
# 下載所有意圖分類模型
python download_models.py download --task classification

# 下載所有情感分析模型
python download_models.py download --task sentiment

# 下載所有命名實體識別模型
python download_models.py download --task ner
```

#### 按語言下載

```bash
# 下載所有中文模型
python download_models.py download --language zh

# 下載所有英文模型
python download_models.py download --language en

# 下載所有多語言模型
python download_models.py download --language multi
```

#### 列出模型

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

#### 查看統計

```bash
python download_models.py stats
```

### 方式 3: 通過 API 下載

服務啟動後，可以通過 API 下載模型。

```bash
# 下載特定模型
curl -X POST http://localhost:8000/models/intent-bert-tiny/download

# 查看所有模型
curl http://localhost:8000/models

# 查看已下載的模型
curl "http://localhost:8000/models?downloaded_only=true"

# 查看模型統計
curl http://localhost:8000/models/stats
```

---

## 🧪 測試模型

### 完整流程測試

```bash
python test_models.py full
```

這會測試：
1. 模型下載
2. 模型加載
3. 模型推理

### 測試特定功能

```bash
# 測試模型註冊表
python test_models.py registry

# 測試模型下載
python test_models.py download --model intent-bert-tiny

# 測試模型加載
python test_models.py load --model intent-bert-tiny --task classification

# 測試模型推理
python test_models.py inference \
  --model intent-bert-tiny \
  --task classification \
  --text "I need to fix my air conditioner"
```

---

## 📊 推薦的模型配置

### 最小配置（開發環境）

只下載基礎模型，適合快速開發和測試：

```bash
python batch_download.py download --category essential
```

包含的模型：
- `intent-bert-tiny` - 意圖分類
- `sentiment-bert` - 情感分析
- `ner-bert-base` - 命名實體識別

**磁盤空間**: ~500MB  
**下載時間**: ~5-10 分鐘

### 中文支持配置

添加中文模型支持：

```bash
python batch_download.py download --category essential
python batch_download.py download --category chinese
```

額外包含：
- `intent-chinese-bert` - 中文意圖分類
- `sentiment-chinese` - 中文情感分析
- `ner-chinese` - 中文命名實體識別
- `text-class-chinese` - 中文文本分類
- `qa-chinese` - 中文問答
- `embed-chinese` - 中文嵌入

**磁盤空間**: ~2GB  
**下載時間**: ~15-20 分鐘

### 完整配置（生產環境）

下載所有推薦的模型：

```bash
python batch_download.py all
```

包含所有類別的模型（essential + chinese + multilingual + advanced）

**磁盤空間**: ~5GB  
**下載時間**: ~30-40 分鐘

---

## 🔍 模型信息

### 按任務分類

#### 意圖分類（Classification）
- `intent-bert-tiny` - 最小模型，快速推理
- `intent-distilbert` - 平衡性能和速度
- `intent-roberta` - 高準確度
- `intent-chinese-bert` - 中文專用
- `intent-multilingual` - 多語言支持

#### 情感分析（Sentiment）
- `sentiment-bert` - 通用情感分析
- `sentiment-roberta` - 高準確度
- `sentiment-chinese` - 中文專用
- `sentiment-multilingual` - 多語言支持

#### 命名實體識別（NER）
- `ner-bert-base` - 通用 NER
- `ner-chinese` - 中文 NER
- `ner-multilingual` - 多語言 NER

#### 專用模型
- `toxicity-detection` - 毒性檢測
- `emotion-detection` - 情緒檢測
- `zero-shot-bart` - 零樣本分類

### 按語言分類

#### 英文（en）
- 40 個模型
- 涵蓋所有任務類型

#### 中文（zh）
- 30 個模型
- 專門優化中文處理

#### 多語言（multi）
- 40 個模型
- 支持 100+ 語言

---

## 💡 使用建議

### 開發階段

1. 只下載基礎模型（essential）
2. 根據需要添加特定語言或任務的模型
3. 使用測試腳本驗證功能

```bash
# 快速開始
python batch_download.py download --category essential
python test_models.py full
```

### 測試階段

1. 下載基礎 + 中文模型
2. 測試所有核心功能
3. 驗證性能指標

```bash
# 測試配置
python batch_download.py download --category essential
python batch_download.py download --category chinese
python test_models.py full
```

### 生產階段

1. 下載所有推薦模型
2. 啟用 MLOps 監控
3. 配置自動擴展

```bash
# 生產配置
python batch_download.py all
# 啟動服務並監控
```

---

## 🚨 故障排除

### 下載失敗

**問題**: 模型下載失敗或超時

**解決方案**:
```bash
# 1. 檢查網絡連接
ping huggingface.co

# 2. 設置代理（如果需要）
export HTTP_PROXY=http://proxy:port
export HTTPS_PROXY=http://proxy:port

# 3. 重試下載
python batch_download.py download --category essential --force
```

### 磁盤空間不足

**問題**: 磁盤空間不足

**解決方案**:
```bash
# 1. 檢查磁盤空間
df -h  # Linux/Mac
dir    # Windows

# 2. 只下載必要的模型
python batch_download.py download --category essential

# 3. 清理舊模型
rm -rf models/pretrained/*  # 小心使用
```

### 加載失敗

**問題**: 模型加載失敗

**解決方案**:
```bash
# 1. 檢查模型文件
ls models/pretrained/intent-bert-tiny/

# 2. 重新下載
python download_models.py download --task classification --force

# 3. 測試加載
python test_models.py load --model intent-bert-tiny
```

### 推理錯誤

**問題**: 模型推理出錯

**解決方案**:
```bash
# 1. 檢查模型狀態
curl http://localhost:8000/mlops/health

# 2. 查看錯誤日誌
tail -f mlops/metrics/*.jsonl

# 3. 重啟服務
# Windows: start.bat
# Linux/Mac: bash start.sh
```

---

## 📈 性能優化

### GPU 加速

如果有 GPU，模型會自動使用 GPU 加速：

```bash
# 檢查 GPU
python -c "import torch; print(torch.cuda.is_available())"

# 安裝 CUDA 版本的 PyTorch
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 模型緩存

模型會自動緩存在內存中，提高推理速度：

```python
# 預加載常用模型
from models.model_loader import model_loader

model_loader.load_model("intent-bert-tiny", "classification")
model_loader.load_model("sentiment-chinese", "sentiment")
```

### 批量處理

使用批量 API 提高吞吐量：

```bash
curl -X POST http://localhost:8000/batch-analyze \
  -H "Content-Type: application/json" \
  -d '[
    {"text": "text1", "task": "intent"},
    {"text": "text2", "task": "intent"},
    {"text": "text3", "task": "intent"}
  ]'
```

---

## 📚 相關文檔

- [README](README.md) - 服務概述
- [QUICK_REFERENCE](QUICK_REFERENCE.md) - 快速參考
- [MLOps 文檔](../docs/MLOPS.md) - MLOps 系統
- [NLP 集成](../docs/NLP_INTEGRATION.md) - 集成指南

---

**版本**: 1.0.0  
**最後更新**: 2026-02-15
