# System Integrity, AI Authenticity, and UI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete twenty test-backed strengthening loops across runtime, data integrity, offline synchronization, real AI transport, and administrator/resident UI integration.

**Architecture:** Keep Expo Router and tRPC as the client/server boundary. Move truth-bearing behavior to focused server/client services, expose structured diagnostics through one admin-only route, and make the UI render real transport and integrity state.

**Tech Stack:** Node.js 24, TypeScript, Expo Router, React Native Web, tRPC 10, TanStack Query 4, SQLite/`better-sqlite3`, Vitest 4, ESLint 10.

**Spec:** `docs/superpowers/specs/2026-09-03-system-integrity-ai-ui-design.md`

## Global Constraints

- Target Node.js is 24 LTS.
- Preserve existing public tRPC and Expo routes unless a compatibility test proves a correction is required.
- Never report unverified provider or data health as successful.
- Never expose secrets in API responses, logs, snapshots, or tests.
- Preserve unrelated `docs/slides/` changes.
- Follow red-green-refactor for every behavior change.

---

### Loop 01: Reproducible Node 24 Runtime

**Files:** Modify `package.json`, `.nvmrc`, `package-lock.json`; test with the existing SQLite suites.

- [ ] Record `node --version`, ABI, installed `better-sqlite3`, and the failing test signature.
- [ ] Set the engine and `.nvmrc` to Node 24 and install a Node-24-compatible `better-sqlite3` release.
- [ ] Run `npm test -- tests/line/runtime-config.test.ts` and require all six tests to pass.
- [ ] Run `npm ls better-sqlite3` and require a single compatible resolution.

### Loop 02: Restore the Full Test Baseline

**Files:** Modify only files identified by fresh failures after Loop 01.

- [ ] Run `npm test` and group failures by root cause.
- [ ] For each non-environment failure, run its narrowest test to reproduce.
- [ ] Add or refine a regression assertion before changing production behavior.
- [ ] Re-run the narrow test and full suite.

### Loop 03: Deterministic Lint Contract

**Files:** Modify `eslint.config.mjs`, `package.json`, and concrete warning sites.

- [ ] Capture warnings by rule and file.
- [ ] Remove unused variables and replace unsafe `any` at changed boundaries with named/unknown types.
- [ ] Configure a truthful warning budget that exits zero without suppressing correctness rules for new code.
- [ ] Run `npm run lint` and save the resulting count in the loop log.

### Loop 04: AI Provider Request Contract

**Files:** Test `tests/server/llm.test.ts`; modify `src/server/_core/llm.ts`.

- [ ] Add tests for no key, success, timeout, non-2xx redaction, malformed response, and request shape.
- [ ] Run the test and confirm timeout/redaction/malformed cases fail for the intended reason.
- [ ] Add bounded timeout, safe `LLMProviderError`, response validation, and configurable model defaults.
- [ ] Run the narrow test and the full server tests.

### Loop 05: Real Chat Service Boundary

**Files:** Test `tests/server/chat-service.test.ts`; create `src/server/services/chatService.ts`; modify `src/server/routers/chat.ts`.

- [ ] Test ordered history, one persisted user message, one persisted assistant message, and provider failure without a fake success message.
- [ ] Confirm the new service tests fail before the service exists.
- [ ] Extract prompt/history/provider/persistence orchestration into `sendResidentChat(input, deps)`.
- [ ] Keep the router schema compatible and delegate to the tested service.

### Loop 06: Client Uses the Real Chat Route

**Files:** Test `tests/chat-client.test.ts`; create `src/lib/chat-client.ts`; modify `src/lib/app-context.tsx`.

- [ ] Test online success, offline enqueue, provider error, and language propagation against a dependency-injected transport.
- [ ] Confirm the tests fail while the UI still uses `getAIResponse`.
- [ ] Route messages to `trpcProxy.chat.send.mutate`; enqueue only on network failure/offline state.
- [ ] Remove client copy that claims work was completed without a confirmed server mutation.

### Loop 07: Chat Message Delivery States

**Files:** Test `tests/chat-messages.test.ts`; modify `src/lib/types.ts`, `src/lib/app-context.tsx`, `src/app/index.tsx`.

- [ ] Add assertions for `sending`, `queued`, `confirmed`, and `failed` assistant/user presentation states.
- [ ] Add typed delivery metadata to chat messages and reducer actions.
- [ ] Render localized status text and an accessible retry control for failed messages.
- [ ] Verify the reducer/unit tests and Web type-check.

### Loop 08: Persisted Chat History Hydration

**Files:** Test `tests/chat-history.test.ts`; modify `src/lib/app-context.tsx` and `src/server/routers/chat.ts` only if contract gaps are proven.

- [ ] Test chronological ordering, deduplication, empty history, and malformed timestamps.
- [ ] Hydrate authenticated residents from `chat.history` without duplicating the welcome item.
- [ ] Invalidate/refetch history after a confirmed send.
- [ ] Verify user switching cannot retain the previous resident's history.

### Loop 09: Offline Queue Schema Validation

**Files:** Test `tests/offline.test.ts`; modify `src/lib/offline.ts`; optionally create `src/lib/offline-schema.ts`.

- [ ] Add failing tests for corrupt JSON, invalid type/status, duplicate IDs, and unsupported payloads.
- [ ] Validate persisted entries and quarantine invalid records under a separate storage key.
- [ ] Emit one safe `queue:quarantined` event containing counts, not payload secrets.
- [ ] Verify valid legacy entries still load.

### Loop 10: Durable Offline State Transitions

**Files:** Test `tests/offline.test.ts`; modify `src/lib/offline.ts`.

- [ ] Test persistence before queued/completed events, save failure propagation, and restart recovery from `processing`.
- [ ] Reset interrupted `processing` entries to `pending` during hydration.
- [ ] Save each transition and serialize sync attempts through one in-flight promise.
- [ ] Verify no operation is silently removed after handler or storage failure.

### Loop 11: Explicit Retry and Queue Observability

**Files:** Test `tests/offline.test.ts`; modify `src/lib/offline.ts`; create `src/hooks/use-offline-status.ts`.

- [ ] Test retry-one, retry-all, pending/failed counts, last sync time, and subscription cleanup.
- [ ] Expose immutable `OfflineQueueSnapshot` and retry methods.
- [ ] Implement a hook based on queue/network events without polling.
- [ ] Verify listeners are released when the hook unmounts.

### Loop 12: Database Integrity Service

**Files:** Test `tests/server/database-integrity.test.ts`; create `src/server/services/databaseIntegrity.ts`; modify `src/server/database/adapter.ts` only for a narrow raw-query interface.

- [ ] Test healthy SQLite, failed `quick_check`, foreign-key violations, missing required tables, and unavailable database.
- [ ] Return a structured `DatabaseIntegrityReport` with safe issue codes.
- [ ] Use SQLite PRAGMAs when SQLite is active and portable connectivity/table checks otherwise.
- [ ] Bound the check duration and never mutate application data.

### Loop 13: Unified System Diagnostics

**Files:** Test `tests/server/system-diagnostics.test.ts`; create `src/server/services/systemDiagnostics.ts`; modify `src/server/routers/index.ts`; remove or delegate `src/server/_core/systemRouter.ts`.

- [ ] Test aggregate healthy/degraded/unconfigured states and secret redaction.
- [ ] Replace hard-coded NLP URL and fake `forge_api` status with environment-backed checks.
- [ ] Include database integrity, AI configuration/reachability, NLP health, runtime version, and check timestamp.
- [ ] Keep diagnostics admin-only and `system.health` lightweight/public.

### Loop 14: Diagnostics Admin UI

**Files:** Test `tests/system-integrity-view.test.ts`; create `src/app/admin/system-integrity.tsx` and `src/components/admin/system-status-card.tsx`; modify `src/app/admin/index.tsx`, `src/app/_layout.tsx`.

- [ ] Test status-to-label/color mapping independently from React Native rendering.
- [ ] Build loading, healthy, degraded, unavailable, unconfigured, and request-error states.
- [ ] Add manual refresh and last-checked time using `trpc.system.diagnostics`.
- [ ] Register the route in the admin menu and hidden tab list.

### Loop 15: Sync Status in Resident UI

**Files:** Test `tests/sync-status-presenter.test.ts`; create `src/components/sync-status-banner.tsx`; modify `src/app/index.tsx`.

- [ ] Test hidden/queued/syncing/failed/offline presentation models and localized text.
- [ ] Render the event-driven queue snapshot near the chat input.
- [ ] Wire retry actions to the real queue methods.
- [ ] Confirm the banner never labels an unconfirmed message as sent.

### Loop 16: Data Conversion Integrity

**Files:** Test `tests/api-types.test.ts`; modify `src/lib/api-types.ts`.

- [ ] Add tests for invalid dates, unknown enum values, null fields, duplicate IDs, and stable chronological ordering.
- [ ] Replace unchecked casts with parsing/normalization that drops or reports invalid records.
- [ ] Return conversion diagnostics so UI can distinguish empty data from rejected data.
- [ ] Verify existing valid API shapes remain backward compatible.

### Loop 17: Mutation Cache Consistency

**Files:** Extend domain router/UI tests; modify affected screens and query invalidation helpers.

- [ ] Inventory every create/update/cancel mutation and its consuming query key.
- [ ] Add failing tests for at least booking, work-order, package, parking, invoice, and announcement refresh paths.
- [ ] Centralize on-success invalidation and rollback behavior.
- [ ] Verify UI lists reflect confirmed server state without a full reload.

### Loop 18: Web Asset and Deployment Integrity

**Files:** Modify `app.json`/assets, `package.json`, and Vercel configuration; test build output.

- [ ] Reproduce the missing-favicon warning and assert the configured asset exists.
- [ ] Add/reuse a valid favicon and ensure Expo exports it.
- [ ] Align the deployment runtime/build command with Node 24 and the repository script.
- [ ] Run `npm run web:build` and require exit zero without missing-asset warnings.

### Loop 19: End-to-End Local Smoke and AI Truth Audit

**Files:** Modify `scripts/local-smoke.cjs` and tests only when an observed gap requires it.

- [ ] Start the server with an isolated SQLite database and deterministic demo credentials.
- [ ] Exercise health, auth, chat failure/success contract, diagnostics authorization, one write/read domain round trip, and queue recovery.
- [ ] Run the Python NLP service tests when dependencies are installed; otherwise report an explicit unavailable prerequisite.
- [ ] Search UI source for canned claims and verify remaining templates are labeled demo/onboarding only.

### Loop 20: Final Regression, Coverage, and Completeness Review

**Files:** Update `README.md` and this plan's checkboxes with measured evidence.

- [ ] Run `npm test -- --coverage` if the configured provider is present; otherwise install/configure the Vitest coverage provider and re-run.
- [ ] Run `npm test`, `npm run type-check`, `npm run lint`, and `npm run web:build` fresh.
- [ ] Run `npm audit --omit=dev`, inspect the final diff, and verify no secret or unrelated slide change is included.
- [ ] Re-read the design requirement-by-requirement, document any external prerequisite, and record exact pass/fail counts.
