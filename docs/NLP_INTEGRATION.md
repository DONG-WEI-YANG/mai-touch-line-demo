# NLP 服務集成指南

## 🎯 概述

本文檔說明如何將獨立的 NLP 微服務集成到 m'AI Touch 主應用中。

NLP 服務包含：
- **100+ 預訓練模型**（意圖分類、NER、情感分析、問答、翻譯等）
- **模型池化系統**（3個並行實例，負載均衡）
- **MLOps 監控**（性能追蹤、健康檢查、告警）
- **自動化部署**（模型下載、版本控制）

詳細的 MLOps 文檔請參考：[MLOps 系統文檔](MLOPS.md)

## 🏗️ 架構圖

```
┌─────────────────────────────────────────────────────────┐
│                  Client (React Native)                   │
│                  Mobile/Web App                          │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/WebSocket
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Main Server (Node.js/Express)                 │
│                    Port: 3000                            │
├─────────────────────────────────────────────────────────┤
│  • tRPC API Routes                                       │
│  • Authentication                                        │
│  • Business Logic                                        │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP REST
                     ▼
┌─────────────────────────────────────────────────────────┐
│          NLP Service (Python/FastAPI)                    │
│                    Port: 8000                            │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │         Model Pool Manager                       │   │
│  │  • Load Balancing                                │   │
│  │  • Health Checking                               │   │
│  │  • Auto Recovery                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Model 1  │  │ Model 2  │  │ Model 3  │             │
│  │ Intent   │  │Sentiment │  │ Entity   │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

## 🚀 快速開始

### 1. 啟動 NLP 服務

**Windows:**
```bash
cd nlp-service
python setup.py
start.bat
```

**Linux/Mac:**
```bash
cd nlp-service
python3 setup.py
bash start.sh
```

服務將在 `http://localhost:8000` 啟動

### 2. 驗證服務運行

```bash
# 健康檢查
curl http://localhost:8000/health

# 測試分析
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "空調壞了", "task": "intent"}'
```

### 3. 集成到主應用

在 `src/server/routers.ts` 中添加 NLP 服務調用。

## 📡 API 集成

### 方法 1: 直接 HTTP 調用

```typescript
// src/lib/nlp-client.ts
export async function analyzeText(
  text: string,
  task: "intent" | "sentiment" | "entity" | "all" = "intent",
  language: string = "en"
) {
  const response = await fetch("http://localhost:8000/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      task,
      language,
      timeout: 5.0
    })
  });

  if (!response.ok) {
    throw new Error(`NLP service error: ${response.statusText}`);
  }

  return await response.json();
}
```

### 方法 2: 在 tRPC 路由中集成

```typescript
// src/server/routers.ts
import { analyzeText } from "../lib/nlp-client";

export const appRouter = router({
  // ... 其他路由

  chat: router({
    send: protectedProcedure
      .input(z.object({
        message: z.string().min(1),
        language: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 1. 使用 NLP 服務分析用戶消息
        const nlpResult = await analyzeText(
          input.message,
          "all",  // 獲取所有分析結果
          input.language || "en"
        );

        // 2. 根據意圖處理
        const intent = nlpResult.intent?.primary_intent;
        const sentiment = nlpResult.sentiment?.emotion;

        // 3. 保存用戶消息
        await db.createChatMessage({
          userId: ctx.user.id,
          role: "user",
          content: input.message,
          language: input.language,
        });

        // 4. 根據意圖生成響應
        let response = "";
        
        if (intent === "maintenance_request") {
          // 自動創建工作訂單
          await db.createWorkOrder({
            userId: ctx.user.id,
            title: "Maintenance Request",
            description: input.message,
            category: "maintenance",
            priority: sentiment === "urgency" ? "urgent" : "medium"
          });
          
          response = "I've created a maintenance work order for you.";
        } else if (intent === "amenity_booking") {
          response = "I can help you book an amenity. Which facility would you like?";
        } else {
          // 使用 LLM 生成通用響應
          response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: input.message }
            ]
          });
        }

        // 5. 保存 AI 響應
        await db.createChatMessage({
          userId: ctx.user.id,
          role: "assistant",
          content: response,
          language: input.language,
        });

        return {
          text: response,
          intent,
          sentiment,
          processing_time_ms: nlpResult.processing_time_ms
        };
      }),
  }),
});
```

## 🔧 配置

### 環境變量

在主應用的 `.env` 文件中添加：

```env
# NLP Service
NLP_SERVICE_URL=http://localhost:8000
NLP_SERVICE_TIMEOUT=5000
NLP_SERVICE_ENABLED=true
```

### 配置文件

```typescript
// src/lib/config.ts
export const nlpConfig = {
  serviceUrl: process.env.NLP_SERVICE_URL || "http://localhost:8000",
  timeout: parseInt(process.env.NLP_SERVICE_TIMEOUT || "5000"),
  enabled: process.env.NLP_SERVICE_ENABLED === "true",
  retryAttempts: 3,
  retryDelay: 1000,
};
```

## 🎨 前端集成

### 使用 tRPC 調用

```typescript
// src/app/index.tsx
import { trpc } from "@/lib/trpc";

export default function HomeScreen() {
  const sendMessage = trpc.chat.send.useMutation();

  const handleSend = async (message: string) => {
    try {
      const result = await sendMessage.mutateAsync({
        message,
        language: "zh"
      });

      console.log("Intent:", result.intent);
      console.log("Sentiment:", result.sentiment);
      console.log("Response:", result.text);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // ... UI 代碼
}
```

## 📊 支持的任務

### 1. Intent Classification (意圖分類)

```typescript
const result = await analyzeText("空調壞了", "intent", "zh");
// result.intent.primary_intent: "maintenance_request"
// result.intent.confidence: 0.95
```

### 2. Sentiment Analysis (情感分析)

```typescript
const result = await analyzeText("鄰居太吵了", "sentiment", "zh");
// result.sentiment.emotion: "frustration"
// result.sentiment.urgency: "high"
```

### 3. Entity Extraction (實體提取)

```typescript
const result = await analyzeText("明天下午3點預約健身房", "entity", "zh");
// result.entities.entities: [
//   { text: "明天", type: "DATE" },
//   { text: "下午3點", type: "TIME" },
//   { text: "健身房", type: "AMENITY" }
// ]
```

### 4. All Tasks (所有任務)

```typescript
const result = await analyzeText("空調壞了很急", "all", "zh");
// 返回所有分析結果
```

## 🔄 錯誤處理

```typescript
async function analyzeTextWithRetry(
  text: string,
  task: string,
  maxRetries: number = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await analyzeText(text, task);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // 指數退避
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

## 📈 性能優化

### 1. 批量處理

```typescript
// 批量分析多條消息
const messages = ["消息1", "消息2", "消息3"];

const results = await fetch("http://localhost:8000/batch-analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(
    messages.map(text => ({ text, task: "intent" }))
  )
});
```

### 2. 緩存結果

```typescript
const cache = new Map<string, any>();

async function analyzeTextCached(text: string, task: string) {
  const key = `${text}:${task}`;
  
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const result = await analyzeText(text, task);
  cache.set(key, result);
  
  // 1小時後過期
  setTimeout(() => cache.delete(key), 3600000);
  
  return result;
}
```

### 3. 超時處理

```typescript
async function analyzeTextWithTimeout(
  text: string,
  task: string,
  timeout: number = 5000
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch("http://localhost:8000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, task }),
      signal: controller.signal
    });

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
```

## 🧪 測試

### 單元測試

```typescript
// tests/nlp-client.test.ts
import { analyzeText } from "@/lib/nlp-client";

describe("NLP Client", () => {
  it("should analyze intent correctly", async () => {
    const result = await analyzeText("空調壞了", "intent", "zh");
    
    expect(result.success).toBe(true);
    expect(result.intent.primary_intent).toBe("maintenance_request");
    expect(result.intent.confidence).toBeGreaterThan(0.8);
  });
});
```

### 集成測試

```bash
# 運行 NLP 服務測試
cd nlp-service
python test_service.py
```

## 🔍 監控

### 健康檢查

```typescript
// 定期檢查 NLP 服務健康狀態
setInterval(async () => {
  try {
    const response = await fetch("http://localhost:8000/health");
    const health = await response.json();
    
    if (health.status !== "healthy") {
      console.error("NLP service unhealthy:", health);
      // 發送告警
    }
  } catch (error) {
    console.error("NLP service down:", error);
    // 發送告警
  }
}, 60000); // 每分鐘檢查一次
```

### 統計信息

```typescript
// 獲取 NLP 服務統計
const stats = await fetch("http://localhost:8000/stats").then(r => r.json());

console.log("Pool size:", stats.pool_size);
console.log("Idle instances:", stats.idle_instances);
console.log("Total requests:", stats.total_requests);
console.log("Avg latency:", stats.avg_latency_ms, "ms");
```

## 🚀 部署建議

### 開發環境
- NLP 服務和主應用在同一機器上運行
- 使用 localhost 連接

### 生產環境
- NLP 服務部署在獨立服務器
- 使用內網 IP 或域名連接
- 配置負載均衡
- 啟用 HTTPS

### Docker 部署

```yaml
# docker-compose.yml
version: '3.8'

services:
  main-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NLP_SERVICE_URL=http://nlp-service:8000
    depends_on:
      - nlp-service

  nlp-service:
    build: ./nlp-service
    ports:
      - "8000:8000"
    environment:
      - POOL_SIZE=3
```

## 📚 相關文檔

- [MLOps 系統文檔](MLOPS.md) - 100+ 模型管理和監控
- [NLP 服務 README](../nlp-service/README.md)
- [API 文檔](API.md)
- [開發指南](DEVELOPMENT.md)
