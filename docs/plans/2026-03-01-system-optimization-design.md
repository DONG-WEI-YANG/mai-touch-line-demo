# System Optimization Design

**Date:** 2026-03-01
**Goal:** Development quality improvement — fix bugs, improve architecture, add tooling

## Phase 1: Fix Compilation-Breaking Bugs

### 1a. `src/app/_layout.tsx`
- Remove duplicate `Tabs` import (line 1 and line 23)
- Add missing `View`, `ActivityIndicator` imports from `react-native`
- Remove unused `Slot`, `useRouter` imports

### 1b. `src/lib/app-context.tsx`
- Fix `generateNLPResponse(content, nlpResult, state)` — remove extra `state` arg (function only accepts 2 params)
- Remove shadowed `isZh` redeclaration at line 296
- Remove unused `isZh` at line 287

## Phase 2: Router Decomposition

Split `src/server/routers.ts` (547 lines) into domain modules:

```
src/server/routers/
  index.ts          — main router composition + helper functions
  auth.ts           — auth.me, auth.logout, auth.updateProfile
  voice.ts          — voice.transcribe
  chat.ts           — chat.send, chat.history
  amenities.ts      — amenities CRUD + slot availability
  bookings.ts       — booking creation, cancellation, admin listing
  workOrders.ts     — work order CRUD
  iot.ts            — device listing + control
  finance.ts        — wallet + transaction history
  access.ts         — access log creation + live feed
  admin.ts          — dashboard stats, user listing, NLP health
```

Rename original `routers.ts` to `routers.ts.bak` during migration, then delete.

Update imports in `src/server/index.ts` to point to `./routers/index`.

## Phase 3: Database Connection Caching

In `src/server/db.ts`, cache the database connection:

```typescript
let cachedDb: DrizzleDB | null = null;

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

## Phase 4: Security Fixes

### 4a. CORS Whitelist
Replace manual CORS headers in `src/server/index.ts` with `cors` package:
- Allow origins from `CORS_ORIGINS` env var (comma-separated)
- Default to `http://localhost:8081` in development

### 4b. Access Log Endpoint
Change `access.logEntry` from `publicProcedure` to `protectedProcedure`.

## Phase 5: Developer Tooling

### 5a. ESLint
- Install `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`
- Create `.eslintrc.json` with rules for `no-unused-vars`, `no-explicit-any` (warn)
- Update `package.json` lint script

### 5b. TypeScript Strictness
- Enable `noUnusedLocals` and `noUnusedParameters` in tsconfig.json
- Do NOT enable full `strict` mode yet (too many changes at once)

### 5c. Test Framework
- Install `vitest` as dev dependency
- Update `package.json` test script to `vitest run`
- Create sample test for one split router module

## Risk Assessment

- **Phase 1:** Zero risk — fixing clear bugs
- **Phase 2:** Low risk — pure refactor, no logic changes
- **Phase 3:** Low risk — caching is additive, fallback preserved
- **Phase 4:** Medium risk — CORS changes could break dev setup if origins misconfigured
- **Phase 5:** Zero risk — additive tooling, no production impact
