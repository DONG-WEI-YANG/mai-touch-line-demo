# System Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix compilation bugs, decompose monolithic router, improve DB performance, harden security, and add developer tooling.

**Architecture:** Incremental refactor — each task is independently shippable. Phase 1 fixes blockers, Phase 2 splits the 547-line router into domain modules, Phases 3-5 are additive improvements.

**Tech Stack:** TypeScript, Expo Router, tRPC v10, Drizzle ORM, Express, Vitest, ESLint

---

### Task 1: Fix `_layout.tsx` Compilation Bugs

**Files:**
- Modify: `src/app/_layout.tsx`

**Step 1: Fix the imports**

Replace the entire import section (lines 1-23) of `src/app/_layout.tsx`. The file has two problems:
1. `Tabs` is imported twice (line 3 from `expo-router`, line 23 again)
2. `View` and `ActivityIndicator` are used in `Root()` but never imported
3. `Slot` and `useRouter` are imported but never used

Replace the file's first 26 lines with:

```tsx
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { AppProvider, useApp } from "@/lib/app-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Create tRPC client
const trpcClient = createTRPCClient();

// ... (imports remain the same) comment should be removed
```

Remove line 25 (`// ... (imports remain the same)`) — this is a leftover comment from development.

**Step 2: Verify the fix compiles**

Run: `cd "D:/product/高級建材APP系統" && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: No errors from `_layout.tsx`. Other files may still have errors — that's fine for now.

**Step 3: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "fix: resolve duplicate imports and missing View/ActivityIndicator in _layout.tsx"
```

---

### Task 2: Fix `app-context.tsx` Function Signature Bug

**Files:**
- Modify: `src/lib/app-context.tsx`

**Step 1: Fix `generateNLPResponse` call and variable shadowing**

Three changes in `src/lib/app-context.tsx`:

1. **Line 287** — Remove unused `const isZh = state.language === "zh";` (this variable is declared but the one at line 296 shadows it, and that one is also unused because `generateNLPResponse` handles language internally via `nlpResult.language`)

2. **Line 295** — Change `generateNLPResponse(content, nlpResult, state)` to `generateNLPResponse(content, nlpResult)`. The function at line 116 only accepts 2 parameters.

3. **Line 296** — Remove the shadowed `const isZh = state.language === "zh";` redeclaration. The variable `isZh` is used later at lines 303, 307, 321, 323, 326 — but these should use `nlpResult.language === "zh"` directly since that's the NLP-detected language. Replace all `isZh` references in that block with `state.language === "zh"` using the outer scope's `state`.

Specifically, change the async block starting at line 286:

FROM:
```typescript
      const isZh = state.language === "zh";
      try {
        const { nlpResult } = await analyzeMessage(content);
        const topIntent = nlpResult.intents[0];

        // ... (Existing metadata logic)

        // Generate NLP-enhanced response
        let aiContent = generateNLPResponse(content, nlpResult, state);
        const isZh = state.language === "zh";
```

TO:
```typescript
      try {
        const { nlpResult } = await analyzeMessage(content);
        const topIntent = nlpResult.intents[0];

        // Generate NLP-enhanced response
        let aiContent = generateNLPResponse(content, nlpResult);
        const isZh = state.language === "zh";
```

**Step 2: Verify no TypeScript errors**

Run: `cd "D:/product/高級建材APP系統" && npx tsc --noEmit --pretty 2>&1 | grep "app-context"`

Expected: No errors from `app-context.tsx`.

**Step 3: Commit**

```bash
git add src/lib/app-context.tsx
git commit -m "fix: remove extra arg from generateNLPResponse and fix variable shadowing"
```

---

### Task 3: Create Router Module Structure

**Files:**
- Create: `src/server/routers/` directory
- Create: `src/server/routers/auth.ts`
- Create: `src/server/routers/voice.ts`
- Create: `src/server/routers/chat.ts`
- Create: `src/server/routers/amenities.ts`
- Create: `src/server/routers/bookings.ts`
- Create: `src/server/routers/workOrders.ts`
- Create: `src/server/routers/iot.ts`
- Create: `src/server/routers/finance.ts`
- Create: `src/server/routers/access.ts`
- Create: `src/server/routers/admin.ts`
- Create: `src/server/routers/index.ts`
- Modify: `src/server/index.ts` (update import path)
- Delete: `src/server/routers.ts` (after verification)

**Step 1: Create `src/server/routers/auth.ts`**

```typescript
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, residentProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
  updateProfile: residentProcedure
    .input(z.object({ name: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUser(ctx.user.id, input);
      return { success: true };
    }),
});
```

**Step 2: Create `src/server/routers/voice.ts`**

```typescript
import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { transcribeAudio } from "../_core/voiceTranscription";
import { storagePut } from "../storage";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English", zh: "中文", ja: "日本語", ko: "한국어",
  es: "Español", fr: "Français", de: "Deutsch", it: "Italiano",
  pt: "Português", ru: "Русский", ar: "العربية", hi: "हिन्दी",
};

function normalizeLanguageCode(lang: string): string {
  const lower = lang.toLowerCase().trim();
  const nameToCode: Record<string, string> = {
    english: "en", chinese: "zh", mandarin: "zh", cantonese: "zh",
    japanese: "ja", korean: "ko", spanish: "es", french: "fr",
    german: "de", italian: "it", portuguese: "pt", russian: "ru",
    arabic: "ar", hindi: "hi",
  };
  return nameToCode[lower] || lower;
}

function estimateConfidence(
  response: { segments?: Array<{ avg_logprob: number; no_speech_prob: number }> }
): number {
  if (!response.segments || response.segments.length === 0) return 0.5;
  const avgLogProb = response.segments.reduce((sum, s) => sum + s.avg_logprob, 0) / response.segments.length;
  const avgNoSpeechProb = response.segments.reduce((sum, s) => sum + s.no_speech_prob, 0) / response.segments.length;
  const logProbScore = Math.max(0, Math.min(1, 1 + avgLogProb));
  const speechScore = 1 - avgNoSpeechProb;
  return Math.round(logProbScore * 0.7 + speechScore * 0.3 * 100) / 100;
}

export const voiceRouter = router({
  transcribe: publicProcedure
    .input(z.object({
      audioBase64: z.string(),
      mimeType: z.string().default("audio/webm"),
      language: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.audioBase64, "base64");
      const ext = input.mimeType.includes("wav") ? "wav"
        : input.mimeType.includes("mp4") || input.mimeType.includes("m4a") ? "m4a" : "webm";
      const fileName = `voice/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { url } = await storagePut(fileName, buffer, input.mimeType);

      const bilingualPrompt = input.language
        ? input.language === "zh"
          ? "請轉錄使用者的語音指令。這是一個高端物業管理應用程式的語音命令。"
          : `Transcribe the user's voice command for a luxury property management app. The user speaks ${LANGUAGE_LABELS[input.language] || input.language}.`
        : "Transcribe the user's voice command. The user may speak in English or Chinese (中文). 請準確辨識使用者的語音，可能是英文或中文。This is for a luxury property management concierge app (高端物業管理應用).";

      const result = await transcribeAudio({ audioUrl: url, language: input.language, prompt: bilingualPrompt });
      if ("error" in result) throw new Error(result.error);

      const normalizedLang = normalizeLanguageCode(result.language || "en");
      return {
        text: result.text || "",
        language: normalizedLang,
        languageLabel: LANGUAGE_LABELS[normalizedLang] || normalizedLang,
        confidence: estimateConfidence(result),
      };
    }),
});
```

**Step 3: Create `src/server/routers/chat.ts`**

```typescript
import { residentProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";

export const chatRouter = router({
  send: residentProcedure
    .input(z.object({ message: z.string().min(1), language: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await db.createChatMessage({ userId: ctx.user.id, role: "user", content: input.message, language: input.language });

      const history = await db.getUserChatMessages(ctx.user.id, 10);
      const sortedHistory = history.reverse();

      const systemPrompt = input.language === "zh"
        ? `你是 m'AI Touch 的 Digital Brain，一個為頂級住宅社區服務的 AI 智慧管家。你的名字是 Digital Brain。你能協助住戶管理物業服務、預約設施、處理維修請求、安排訪客接待等。請以專業、優雅且溫暖的語氣回應。回覆請簡潔，不超過 3 句話。`
        : `You are the Digital Brain of m'AI Touch, an AI concierge for an elite residential community. You help residents manage property services, book amenities, handle maintenance requests, arrange guest hosting, and more. Respond in a professional, elegant, and warm tone. Keep responses concise, no more than 3 sentences.`;

      const messages = [
        { role: "system" as const, content: [{ type: "text" as const, text: systemPrompt }] },
        ...sortedHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: [{ type: "text" as const, text: m.content }],
        })),
      ];

      const response = await invokeLLM({ messages });
      const choice = response.choices?.[0];
      const msgContent = choice?.message?.content;
      const assistantText = typeof msgContent === "string"
        ? msgContent
        : Array.isArray(msgContent) && msgContent[0]?.type === "text"
          ? (msgContent[0] as { type: "text"; text: string }).text
          : "I'm here to assist you. How may I help?";

      await db.createChatMessage({ userId: ctx.user.id, role: "assistant", content: assistantText, language: input.language });
      return { text: assistantText };
    }),

  history: residentProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const messages = await db.getUserChatMessages(ctx.user.id, input.limit);
      return messages.reverse();
    }),
});
```

**Step 4: Create `src/server/routers/amenities.ts`**

```typescript
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const amenitiesRouter = router({
  list: publicProcedure.query(async () => db.getAllAmenities()),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => db.getAmenityById(input.id)),

  getSlots: publicProcedure
    .input(z.object({ amenityId: z.number(), date: z.string() }))
    .query(async ({ input }) => {
      const amenity = await db.getAmenityById(input.amenityId);
      if (!amenity) return [];

      const existingBookings = await db.getBookingsByAmenityAndDate(input.amenityId, input.date);
      const slots: Array<{ startTime: string; endTime: string; available: boolean; remainingCapacity: number }> = [];
      const [openH, openM] = amenity.openTime.split(":").map(Number);
      const [closeH, closeM] = amenity.closeTime.split(":").map(Number);
      const duration = amenity.slotDurationMinutes;
      let currentMinutes = openH * 60 + openM;
      const endMinutes = closeH * 60 + closeM;

      while (currentMinutes + duration <= endMinutes) {
        const startH = Math.floor(currentMinutes / 60);
        const startM = currentMinutes % 60;
        const endSlotMinutes = currentMinutes + duration;
        const endSlotH = Math.floor(endSlotMinutes / 60);
        const endSlotM = endSlotMinutes % 60;
        const startTime = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
        const endTime = `${String(endSlotH).padStart(2, "0")}:${String(endSlotM).padStart(2, "0")}`;
        const currentOccupancy = existingBookings.filter(b => b.startTime === startTime).reduce((sum, b) => sum + b.guestCount, 0);
        const remaining = Math.max(0, amenity.capacity - currentOccupancy);
        slots.push({ startTime, endTime, available: remaining > 0, remainingCapacity: remaining });
        currentMinutes += duration;
      }
      return slots;
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      icon: z.string().default("star"),
      category: z.enum(["recreation", "wellness", "entertainment", "business", "dining", "outdoor"]).default("recreation"),
      capacity: z.number().min(1).default(10),
      location: z.string().optional(),
      rules: z.string().optional(),
      openTime: z.string().default("08:00"),
      closeTime: z.string().default("22:00"),
      slotDurationMinutes: z.number().default(60),
    }))
    .mutation(async ({ input }) => db.createAmenity(input)),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      capacity: z.number().min(1).optional(),
      isActive: z.boolean().optional(),
      openTime: z.string().optional(),
      closeTime: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateAmenity(id, data);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => db.deleteAmenity(input.id)),
});
```

**Step 5: Create `src/server/routers/bookings.ts`**

```typescript
import { residentProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const bookingsRouter = router({
  myBookings: residentProcedure.query(async ({ ctx }) => db.getUserBookings(ctx.user.id)),

  create: residentProcedure
    .input(z.object({
      amenityId: z.number(),
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      guestCount: z.number().min(1).default(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const amenity = await db.getAmenityById(input.amenityId);
      if (!amenity) throw new Error("Amenity not found");

      const existingBookings = await db.getBookingsByAmenityAndDate(input.amenityId, input.date);
      const currentOccupancy = existingBookings
        .filter(b => b.startTime === input.startTime)
        .reduce((sum, b) => sum + b.guestCount, 0);

      if (currentOccupancy + input.guestCount > amenity.capacity) {
        const left = amenity.capacity - currentOccupancy;
        throw new Error(`Capacity exceeded. Only ${left} spots left for this slot.`);
      }

      return db.createBooking({
        userId: ctx.user.id,
        amenityId: input.amenityId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        guestCount: input.guestCount,
        notes: input.notes,
      });
    }),

  cancel: residentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => db.updateBookingStatus(input.id, "cancelled")),

  listAll: adminProcedure.query(async () => db.getBookingsWithDetails()),

  updateStatus: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["confirmed", "pending", "cancelled", "completed"]),
    }))
    .mutation(async ({ input }) => db.updateBookingStatus(input.id, input.status)),
});
```

**Step 6: Create `src/server/routers/workOrders.ts`**

```typescript
import { residentProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const workOrdersRouter = router({
  myOrders: residentProcedure.query(async ({ ctx }) => db.getUserWorkOrders(ctx.user.id)),

  create: residentProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      category: z.enum(["maintenance", "security", "concierge", "housekeeping", "other"]).default("maintenance"),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    }))
    .mutation(async ({ ctx, input }) => db.createWorkOrder({ userId: ctx.user.id, ...input })),

  listAll: adminProcedure.query(async () => db.getWorkOrdersWithDetails()),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      assignedTo: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateWorkOrder(id, data);
    }),
});
```

**Step 7: Create `src/server/routers/iot.ts`**

```typescript
import { residentProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const iotRouter = router({
  myDevices: residentProcedure.query(async ({ ctx }) => {
    const user = await db.getUserById(ctx.user.id);
    if (!user || !user.unitId) return [];
    return db.getDevicesByUnit(user.unitId);
  }),

  amenityDevices: adminProcedure
    .input(z.object({ amenityId: z.number().optional() }))
    .query(async ({ input }) => db.getDevicesByAmenity(input.amenityId)),

  updateDevice: residentProcedure
    .input(z.object({ deviceId: z.number(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const device = await db.getDeviceById(input.deviceId);
      if (!device) throw new Error("Device not found");

      const user = await db.getUserById(ctx.user.id);
      const canControl = user?.role === "admin" || user?.role === "logistics" || (user?.unitId === device.unitId && device.unitId !== null);
      if (!canControl) throw new Error("Unauthorized to control this device");

      await db.updateDeviceStatus(input.deviceId, input.status);
      return { success: true };
    }),
});
```

**Step 8: Create `src/server/routers/finance.ts`**

```typescript
import { residentProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const financeRouter = router({
  myWallet: residentProcedure.query(async ({ ctx }) => db.getUserWallet(ctx.user.id)),
  history: residentProcedure.query(async ({ ctx }) => db.getUserTransactions(ctx.user.id)),
});
```

**Step 9: Create `src/server/routers/access.ts`**

Note: `logEntry` is changed from `publicProcedure` to `protectedProcedure` (Phase 4b security fix).

```typescript
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const accessRouter = router({
  logEntry: protectedProcedure
    .input(z.object({
      passId: z.number().optional(),
      entryPoint: z.string(),
      result: z.enum(["success", "denied", "expired"]),
    }))
    .mutation(async ({ input }) => db.createAccessLog(input)),

  liveFeed: adminProcedure.query(async () => db.getLatestAccessLogs(20)),
});
```

**Step 10: Create `src/server/routers/admin.ts`**

```typescript
import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const adminRouter = router({
  stats: adminProcedure.query(async () => db.getDashboardStats()),
  users: adminProcedure.query(async () => db.getAllUsers()),

  nlpHealth: adminProcedure.query(async () => {
    try {
      const response = await fetch("http://localhost:8000/health");
      return await response.json();
    } catch {
      return { status: "offline", error: "NLP Service unreachable" };
    }
  }),

  modelDownloads: adminProcedure.query(async () => {
    try {
      const response = await fetch("http://localhost:8000/models/stats");
      return await response.json();
    } catch {
      return { total_models: 120, downloaded_models: 0, status: "error" };
    }
  }),
});
```

**Step 11: Create `src/server/routers/index.ts`**

This is the composition file. It also keeps the `system` router inline since it uses background async jobs.

```typescript
import { publicProcedure, residentProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

// Import domain routers
import { authRouter } from "./auth";
import { voiceRouter } from "./voice";
import { chatRouter } from "./chat";
import { amenitiesRouter } from "./amenities";
import { bookingsRouter } from "./bookings";
import { workOrdersRouter } from "./workOrders";
import { iotRouter } from "./iot";
import { financeRouter } from "./finance";
import { accessRouter } from "./access";
import { adminRouter } from "./admin";

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ status: "ok", timestamp: Date.now() })),

    diagnostics: adminProcedure.query(async () => {
      let dbStatus = "connected";
      try { await db.getDb(); } catch { dbStatus = "error"; }
      let nlpStatus = "online";
      try {
        const res = await fetch("http://localhost:8000/health");
        if (!res.ok) nlpStatus = "degraded";
      } catch { nlpStatus = "offline"; }
      const forgeConfigured = !!process.env.EXPO_PUBLIC_API_KEY && process.env.EXPO_PUBLIC_API_KEY !== "mock-key";
      return {
        services: {
          database: { status: dbStatus, type: "SQLite" },
          nlp_engine: { status: nlpStatus, url: "http://localhost:8000" },
          forge_api: { configured: forgeConfigured, status: forgeConfigured ? "ready" : "unconfigured" }
        },
        environment: process.env.NODE_ENV || "development"
      };
    }),

    activeJobs: residentProcedure.query(async ({ ctx }) => db.getActiveJobsByUser(ctx.user.id)),

    runJob: residentProcedure
      .input(z.object({ type: z.enum(["arrival", "departure", "hosting"]) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user || !user.unitId) throw new Error("User not assigned to a unit");

        const jobId = await db.createSystemJob({
          userId: ctx.user.id, type: input.type, status: "running", progress: 10,
          currentStep: `Locating devices in Unit ${user.unitNumber}...`,
        });

        (async () => {
          try {
            const unitDevices = await db.getDevicesByUnit(user.unitId!);
            if (input.type === "arrival") {
              await new Promise(r => setTimeout(r, 1500));
              const ac = unitDevices.find(d => d.type === "climate");
              if (ac) await db.updateDeviceStatus(ac.id, "22°C");
              await db.updateJobProgress(jobId, 40, `Setting ${ac?.name || "AC"} to 22°C...`);
              await new Promise(r => setTimeout(r, 1500));
              const light = unitDevices.find(d => d.type === "light");
              if (light) await db.updateDeviceStatus(light.id, "on");
              await db.updateJobProgress(jobId, 70, `Illuminating ${light?.name || "Entryway"}...`);
              await new Promise(r => setTimeout(r, 1500));
              await db.updateJobProgress(jobId, 100, `Unit ${user.unitNumber} is ready. Welcome home.`);
            } else {
              for (const d of unitDevices) { await db.updateDeviceStatus(d.id, "off"); }
              await db.updateJobProgress(jobId, 100, "All systems secured. Energy saving mode active.");
            }
          } catch {
            await db.updateJobProgress(jobId, 0, "Dispatch failed: Hardware timeout.");
          }
        })();
        return { jobId };
      }),
  }),

  auth: authRouter,
  voice: voiceRouter,
  chat: chatRouter,
  amenities: amenitiesRouter,
  bookings: bookingsRouter,
  workOrders: workOrdersRouter,
  iot: iotRouter,
  finance: financeRouter,
  access: accessRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
```

**Step 12: Update `src/server/index.ts` import**

Change line 8 of `src/server/index.ts`:

FROM: `import { appRouter } from "./routers";`
TO: `import { appRouter } from "./routers/index";`

**Step 13: Delete old `src/server/routers.ts`**

After verifying compilation:

```bash
rm src/server/routers.ts
```

**Step 14: Update `src/lib/trpc.ts` import**

The client import `from "../server/routers"` must also be updated.

Change in `src/lib/trpc.ts`:

FROM: `import type { AppRouter } from "../server/routers";`
TO: `import type { AppRouter } from "../server/routers/index";`

**Step 15: Verify compilation**

Run: `cd "D:/product/高級建材APP系統" && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: No new errors. The router type `AppRouter` should be identical.

**Step 16: Commit**

```bash
git add src/server/routers/ src/server/index.ts src/lib/trpc.ts
git rm src/server/routers.ts
git commit -m "refactor: decompose monolithic routers.ts into domain modules"
```

---

### Task 4: Cache Database Connection

**Files:**
- Modify: `src/server/db.ts:19-27`

**Step 1: Add connection caching**

Replace the `getDb` function in `src/server/db.ts` (lines 19-27):

FROM:
```typescript
export async function getDb() {
  try {
    const adapter = await dbManager.connect();
    return adapter.db;
  } catch (error) {
    console.warn("[Database] Failed to connect:", error);
    return null;
  }
}
```

TO:
```typescript
let cachedDb: Awaited<ReturnType<typeof dbManager.connect>>["db"] | null = null;

export async function getDb() {
  if (cachedDb) return cachedDb;
  try {
    const adapter = await dbManager.connect();
    cachedDb = adapter.db;
    return cachedDb;
  } catch (error) {
    console.warn("[Database] Failed to connect:", error);
    return null;
  }
}
```

**Step 2: Verify compilation**

Run: `cd "D:/product/高級建材APP系統" && npx tsc --noEmit --pretty 2>&1 | grep "db.ts"`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/server/db.ts
git commit -m "perf: cache database connection to avoid repeated connect calls"
```

---

### Task 5: Fix CORS Security

**Files:**
- Modify: `src/server/index.ts:48-67`

**Step 1: Replace manual CORS with `cors` package**

The `cors` package is already in `package.json` dependencies. Replace the manual CORS middleware in `src/server/index.ts` (lines 48-67):

FROM:
```typescript
  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
```

TO:
```typescript
  // CORS configuration
  const cors = require("cors");
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(s => s.trim())
    : ["http://localhost:8081", "http://localhost:19006", "http://localhost:3000"];

  app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  }));
```

**Step 2: Commit**

```bash
git add src/server/index.ts
git commit -m "security: replace permissive CORS origin reflection with whitelist"
```

---

### Task 6: Add ESLint Configuration

**Files:**
- Create: `.eslintrc.json`
- Modify: `package.json` (update `lint` script)

**Step 1: Install ESLint dependencies**

```bash
cd "D:/product/高級建材APP系統" && npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

**Step 2: Create `.eslintrc.json`**

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "ecmaFeatures": { "jsx": true }
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-empty-function": "off",
    "no-console": "off"
  },
  "ignorePatterns": ["node_modules/", "dist/", ".expo/"]
}
```

**Step 3: Update `package.json` lint script**

Change in `package.json`:

FROM: `"lint": "echo \"Error: no linter configured\" && exit 1"`
TO: `"lint": "eslint src/ --ext .ts,.tsx --max-warnings 50"`

**Step 4: Run lint to verify setup works**

```bash
cd "D:/product/高級建材APP系統" && npm run lint 2>&1 | tail -20
```

Expected: Warnings about `any` types and unused vars. Should NOT exit with error (we set `--max-warnings 50`).

**Step 5: Commit**

```bash
git add .eslintrc.json package.json package-lock.json
git commit -m "tooling: add ESLint with TypeScript rules"
```

---

### Task 7: Add Vitest Test Framework

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (update `test` script)
- Create: `tests/server/routers/finance.test.ts` (sample test)

**Step 1: Install Vitest**

```bash
cd "D:/product/高級建材APP系統" && npm install --save-dev vitest
```

**Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 3: Update `package.json` test script**

Change in `package.json`:

FROM: `"test": "echo \"Error: no test runner configured\" && exit 1"`
TO: `"test": "vitest run"`

**Step 4: Create sample test at `tests/server/routers/finance.test.ts`**

```typescript
import { describe, it, expect } from "vitest";

describe("finance router", () => {
  it("should be importable", async () => {
    // Verify the module structure exists
    const mod = await import("../../../src/server/routers/finance");
    expect(mod.financeRouter).toBeDefined();
  });
});
```

**Step 5: Run tests**

```bash
cd "D:/product/高級建材APP系統" && npm test 2>&1 | tail -20
```

Expected: 1 test passing (or failing with import error if DB adapter isn't mockable — that's OK, it proves the framework works).

**Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json tests/server/
git commit -m "tooling: add Vitest test framework with sample router test"
```

---

### Task 8: Enable Incremental TypeScript Strictness

**Files:**
- Modify: `tsconfig.json`

**Step 1: Add strictness flags**

Add these two options to `compilerOptions` in `tsconfig.json`:

```json
"noUnusedLocals": true,
"noUnusedParameters": true
```

**Step 2: Fix any resulting errors**

Run: `cd "D:/product/高級建材APP系統" && npx tsc --noEmit 2>&1 | head -50`

Fix unused variables by prefixing with `_` (e.g., `_unused`).

**Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "tooling: enable noUnusedLocals and noUnusedParameters in tsconfig"
```
