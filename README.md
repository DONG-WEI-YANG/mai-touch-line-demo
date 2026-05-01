# m'AI Touch - 豪華建築管理應用

> The Digital Brain for Elite Living — AI 驅動的高端物業管理和禮賓服務移動應用

## 🌟 項目簡介

m'AI Touch 是一個創新的豪華建築管理應用程序，通過 AI 技術為住戶提供智能化的物業管理和生活服務。住戶可以使用自然語言（文字/語音）與"Digital Brain"互動，管理生活空間、委派任務並訪問高端生活服務。

## ✨ 核心功能

### 👥 用戶角色
- **住戶 (Resident)**: 使用應用程式管理個人生活空間、預約設施、提交服務請求、接收通知等。
- **系統管理 (System Administrator)**: 擁有最高權限，負責系統配置、用戶管理、查看所有數據、監控系統健康和執行高級操作。
- **物流 (Logistics)**: 負責處理和追踪物業內的物流相關任務和請求。

### 🏠 物業運營
- **零摩擦任務委派** - 語音或文字快速創建服務請求
- **自動化管理壓力** - AI 智能處理日常維護和服務
- **優雅社交調解** - 低調處理鄰里問題

### 🎯 生活體驗
- **預測性空間控制** - 智能調節溫度、燈光、窗簾
- **隱形 VIP 接待** - 無接觸訪客管理和禮賓服務
- **動態生活策劃** - 個性化設施預約和活動安排

### 🤖 AI 功能
- **100+ NLP 模型** - 意圖分類、情感分析、實體提取等
- **MLOps 監控** - 性能追蹤、健康檢查、自動告警
- **多語言語音識別** - 中文、英文等
- **智能意圖識別** - 12+ 意圖類別
- **情感分析** - 情緒和緊急程度檢測
- **上下文感知對話** - 智能響應生成
- **自動工作訂單** - 基於意圖自動創建

## 🚀 快速開始

### 環境要求
- Node.js 18+
- MySQL 8.0+
- Expo CLI

### 安裝

```bash
# 克隆項目
git clone <repository-url>
cd m-ai-touch

# 安裝依賴
npm install

# 配置環境變量
cp .env.example .env
# 編輯 .env 文件

# 啟動後端服務器
npm run dev:server

# 啟動前端（新終端）
npm start
```

## 📱 技術棧

### 前端
- React Native + Expo
- TypeScript
- Expo Router
- tRPC + React Query

### 後端
- Express.js
- tRPC
- SQLite / MySQL / PostgreSQL
- Drizzle ORM
- OpenAI API

### NLP 服務
- Python + FastAPI
- 100+ 預訓練模型
- MLOps 監控系統
- 模型池化（3個實例）

## 📚 文檔

### 快速開始
- [快速開始指南](QUICK_START.md)
- [數據庫設置](DATABASE_SETUP.md)

### 開發文檔
- [項目結構](docs/PROJECT_STRUCTURE.md)
- [開發指南](docs/DEVELOPMENT.md)
- [API 文檔](docs/API.md)
- [設計文檔](docs/design.md)

### NLP 和 MLOps
- [NLP 集成指南](docs/NLP_INTEGRATION.md)
- [MLOps 系統文檔](docs/MLOPS.md)
- [NLP 快速參考](nlp-service/QUICK_REFERENCE.md)

### 數據庫
- [數據庫文檔](docs/DATABASE.md)
- [數據庫功能](docs/DATABASE_FEATURES.md)
- [多數據庫總結](docs/MULTI_DATABASE_SUMMARY.md)

### 部署
- [部署指南](docs/DEPLOYMENT.md)

### 項目狀態
- [系統審查](docs/SYSTEM_AUDIT.md)
- [系統完成報告](docs/SYSTEM_COMPLETION_REPORT.md)
- [最終總結](docs/FINAL_SUMMARY.md)

## 🎨 設計特色

- 優雅的金色/香檳色主題
- 深色/淺色模式支持
- 流暢的動畫和過渡
- 直觀的語音交互界面

## 📄 許可證

Private - All Rights Reserved

---

## 原始技術文檔

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(baseUrl: string, relKey: string, apiKey: string): Promise<string> {
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string,
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`,
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
```

`lib/trpc.ts`
```ts
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        // tRPC v11: transformer MUST be inside httpBatchLink, not at root
        transformer: superjson,
        async headers() {
          const token = await Auth.getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // Custom fetch to include credentials for cookie-based auth
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}
```

`hooks/use-auth.ts`
```ts
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    console.log("[useAuth] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      // Web platform: use cookie-based auth, fetch user from API
      if (Platform.OS === "web") {
        console.log("[useAuth] Web platform: fetching user from API...");
        const apiUser = await Api.getMe();
        console.log("[useAuth] API user response:", apiUser);

        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            openId: apiUser.openId,
            name: apiUser.name,
            email: apiUser.email,
            loginMethod: apiUser.loginMethod,
            lastSignedIn: new Date(apiUser.lastSignedIn),
          };
          setUser(userInfo);
          // Cache user info in localStorage for faster subsequent loads
          await Auth.setUserInfo(userInfo);
          console.log("[useAuth] Web user set from API:", userInfo);
        } else {
          console.log("[useAuth] Web: No authenticated user from API");
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      // Native platform: use token-based auth
      console.log("[useAuth] Native platform: checking for session token...");
      const sessionToken = await Auth.getSessionToken();
      console.log(
        "[useAuth] Session token:",
        sessionToken ? `present (${sessionToken.substring(0, 20)}...)` : "missing",
      );
      if (!sessionToken) {
        console.log("[useAuth] No session token, setting user to null");
        setUser(null);
        return;
      }

      // Use cached user info for native (token validates the session)
      const cachedUser = await Auth.getUserInfo();
      console.log("[useAuth] Cached user:", cachedUser);
      if (cachedUser) {
        console.log("[useAuth] Using cached user info");
        setUser(cachedUser);
      } else {
        console.log("[useAuth] No cached user, setting user to null");
        setUser(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error:", error);
      setError(error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log("[useAuth] fetchUser completed, loading:", false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    console.log("[useAuth] useEffect triggered, autoFetch:", autoFetch, "platform:", Platform.OS);
    if (autoFetch) {
      if (Platform.OS === "web") {
        // Web: fetch user from API directly (user will login manually if needed)
        console.log("[useAuth] Web: fetching user from API...");
        fetchUser();
      } else {
        // Native: check for cached user info first for faster initial load
        Auth.getUserInfo().then((cachedUser) => {
          console.log("[useAuth] Native cached user check:", cachedUser);
          if (cachedUser) {
            console.log("[useAuth] Native: setting cached user immediately");
            setUser(cachedUser);
            setLoading(false);
          } else {
            // No cached user, check session token
            fetchUser();
          }
        });
      }
    } else {
      console.log("[useAuth] autoFetch disabled, setting loading to false");
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  useEffect(() => {
    console.log("[useAuth] State updated:", {
      hasUser: !!user,
      loading,
      isAuthenticated,
      error: error?.message,
    });
  }, [user, loading, isAuthenticated, error]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
```

`tests/auth.logout.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "../server/_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  
  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  
  return { ctx, clearedCookies };
}

// TODO: Remove `.skip` below once you implement user authentication
describe.skip("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});
```

---

## Common Patterns

### Optimistic Updates

Update UI immediately, revert on error:

```tsx
const toggleComplete = trpc.items.update.useMutation({
  onMutate: async (input) => {
    // Cancel outgoing queries
    await utils.items.list.cancel();
    
    // Snapshot previous value
    const previous = utils.items.list.getData();
    
    // Optimistically update
    utils.items.list.setData(undefined, (old) =>
      old?.map((item) =>
        item.id === input.id
          ? { ...item, completed: input.completed }
          : item
      )
    );
    
    return { previous };
  },
  onError: (err, input, context) => {
    // Revert on error
    utils.items.list.setData(undefined, context?.previous);
  },
  onSettled: () => {
    // Refetch after mutation
    utils.items.list.invalidate();
  },
});
```

### Pagination

```tsx
// Router
list: protectedProcedure
  .input(z.object({
    limit: z.number().min(1).max(100).default(20),
    cursor: z.number().optional(),
  }))
  .query(async ({ ctx, input }) => {
    const items = await db.getItems({
      userId: ctx.user.id,
      limit: input.limit + 1,
      cursor: input.cursor,
    });
    
    let nextCursor: number | undefined;
    if (items.length > input.limit) {
      const next = items.pop();
      nextCursor = next?.id;
    }
    
    return { items, nextCursor };
  }),

// Frontend
const { data, fetchNextPage, hasNextPage } = trpc.items.list.useInfiniteQuery(
  { limit: 20 },
  { getNextPageParam: (lastPage) => lastPage.nextCursor }
);
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Database not available" | Check `DATABASE_URL` is set |
| Auth not working | Verify OAuth callback URL matches |
| tRPC type errors | Run `pnpm check` to verify types |
| Mutations fail silently | Check browser console for errors |
| Session expired | User needs to login again |

## 🤖 LINE Demo (Cloud)

A publicly-reachable LINE Official Account demo of m'AI Touch is available — see `docs/LINE_INTEGRATION.md` for setup, presentation playbook, and troubleshooting.

- **Live URL**: `https://mai-touch-demo.onrender.com`
- **Health check**: `GET /health`
- **Webhook endpoint**: `POST /line/webhook`
- **Profile switch**: `DEPLOY_PROFILE=demo` (OpenAI-only, free tier) or `DEPLOY_PROFILE=prod` (existing NLP service)
- **Available demo scripts**: `/demo facility`, `/demo repair`, `/demo visitor`, `/demo complaint`
- **Commands**: `/help`, `/role`, `/lang`, `/reset`, `/whoami`, `/demo list`, `/demo stop`

Spec: `docs/superpowers/specs/2026-05-01-line-online-demo-design.md`
Plan: `docs/superpowers/plans/2026-05-01-line-online-demo-plan*.md`
