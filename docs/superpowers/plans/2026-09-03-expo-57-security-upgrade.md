# Expo 57 Security Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Expo 54/Metro high-severity audit chain by upgrading safely to Expo SDK 57 while preserving native and web voice recording behavior.

**Architecture:** Replace the removed `expo-av` recorder with `expo-audio` behind the existing hook contract, then advance Expo one SDK at a time so failures can be attributed to a single compatibility boundary. Keep the root Expo config, dependencies, CI runtime, and deployment checks aligned with SDK 57.

**Tech Stack:** Expo Router, Expo SDK 57, React Native 0.86, React 19.2, TypeScript, Vitest, GitHub Actions, Vercel CLI.

**Spec:** `docs/superpowers/specs/2026-09-03-expo-57-security-upgrade-design.md`

## Global Constraints

- Upgrade Expo incrementally: SDK 54 → 55 → 56 → 57.
- Use the versions selected by `npx expo install --fix` for each SDK.
- Keep Node at `>=24 <25` in package metadata and CI.
- Preserve the public `useVoiceRecording()` return contract.
- Keep the web `useWebVoiceRecorder()` and voice-booking UI behavior unchanged.
- Do not create or retain generated `android/` or `ios/` directories.
- Never stage or modify user-owned `docs/slides` changes.

---

### Task 1: Record the failing security and compatibility baseline

**Files:**
- Inspect: `package.json`
- Inspect: `package-lock.json`

**Interfaces:**
- Consumes: the installed SDK 54 dependency graph.
- Produces: an evidence baseline showing that the current graph is internally
  SDK-compatible but fails the production high-severity audit gate.

- [x] **Step 1: Reproduce the high-severity production audit failure**

Run: `npm audit --omit=dev --audit-level=high`

Expected: FAIL with 8 high-severity advisories rooted in Expo/Metro and npm's
supported remediation pointing to Expo 57.

- [x] **Step 2: Confirm the starting SDK graph is otherwise aligned**

Run: `npx expo install --check`

Expected: PASS for the current SDK 54 package set. This isolates the issue to
an obsolete but internally consistent SDK rather than arbitrary version drift.

### Task 2: Migrate native recording from expo-av to expo-audio

**Files:**
- Modify: `src/hooks/use-voice-recording.ts`
- Create: `src/lib/audio-metering.ts`
- Modify: `app.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/voice-recording-metering.test.ts`
- Test: `tests/voice-recording-metering.test.ts`

**Interfaces:**
- Consumes: `expo-audio` recorder APIs and the existing hook contract.
- Produces: `normalizeRecordingMetering(metering?: number): number` in
  `src/lib/audio-metering.ts` and the
  unchanged `useVoiceRecording()` result object.

- [x] **Step 1: Write the failing metering normalization test**

```ts
expect(normalizeRecordingMetering(undefined)).toBe(0);
expect(normalizeRecordingMetering(-160)).toBe(0);
expect(normalizeRecordingMetering(-80)).toBe(0.5);
expect(normalizeRecordingMetering(0)).toBe(1);
expect(normalizeRecordingMetering(20)).toBe(1);
```

- [x] **Step 2: Run the test and verify the missing export failure**

Run: `npx vitest run tests/voice-recording-metering.test.ts`

Expected: FAIL because `normalizeRecordingMetering` does not exist.

- [x] **Step 3: Install the SDK 54-compatible expo-audio package**

Run: `npx expo install expo-audio`

- [x] **Step 4: Implement the expo-audio recorder**

```ts
export function normalizeRecordingMetering(metering?: number): number {
  if (!Number.isFinite(metering)) return 0;
  return Math.max(0, Math.min(1, ((metering as number) + 160) / 160));
}

const recorder = useAudioRecorder({
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
});
const recorderStatus = useAudioRecorderState(recorder, 100);
```

Use `AudioModule.requestRecordingPermissionsAsync()`, `setAudioModeAsync()`,
`prepareToRecordAsync()`, `record()`, `stop()`, and `recorder.uri`. Remove the
timer and random waveform generation. Add `"expo-audio"` to root `app.json`.

- [x] **Step 5: Remove expo-av and verify the focused behavior**

Run: `npm uninstall expo-av`

Run: `npx vitest run tests/voice-recording-metering.test.ts`

Expected: PASS.

### Task 3: Upgrade Expo SDK 54 to 55

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`
- Modify: `src/app.config.ts`

**Interfaces:**
- Consumes: the expo-audio migration from Task 2.
- Produces: an SDK 55-compatible dependency graph and config.

- [x] **Step 1: Remove SDK 55-deleted config fields**

Remove `newArchEnabled` from both Expo configs and remove
`edgeToEdgeEnabled` from `src/app.config.ts`.

- [x] **Step 2: Upgrade and align SDK 55 dependencies**

Run: `npx expo install expo@^55.0.0 --fix`

- [x] **Step 3: Verify SDK 55 compatibility**

Run: `npx expo install --check`

Run: `npx expo-doctor@latest`

Run: `npm run type-check`

Run: `npm run web:build`

Expected: all commands exit 0.

### Task 4: Upgrade Expo SDK 55 to 56

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: SDK 55-compatible source/config.
- Produces: SDK 56-aligned dependencies without application behavior changes.

- [x] **Step 1: Upgrade and align SDK 56 dependencies**

Run: `npx expo install expo@^56.0.0 --fix`

- [x] **Step 2: Verify SDK 56 compatibility**

Run: `npx expo install --check`

Run: `npx expo-doctor@latest`

Run: `npm run type-check`

Run: `npm run web:build`

Expected: all commands exit 0.

Observed: install check, type-check, lint, focused tests, and web build passed.
Expo Doctor correctly identified the documented SDK 56 Hermes regression and
directed the planned upgrade to SDK 57, where the check passes.

### Task 5: Upgrade Expo SDK 56 to 57 and close the audit issue

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: SDK 56-compatible source/config.
- Produces: final SDK 57 graph with the Task 1 audit gate green.

- [x] **Step 1: Upgrade and align SDK 57 dependencies**

Run: `npx expo install expo@^57.0.19 --fix`

- [x] **Step 2: Verify Expo and dependency contracts**

Run: `npx expo install --check`

Run: `npx expo-doctor@latest`

Run: `npx vitest run tests/deployment-config.test.ts tests/voice-recording-metering.test.ts`

Expected: all commands pass and the Task 1 test is green.

- [x] **Step 3: Verify the production audit**

Run: `npm audit --omit=dev --audit-level=high`

Expected: exit 0 with zero high or critical advisories.

### Task 6: Validate, publish, and observe

**Files:**
- Modify: `README.md` only if the documented runtime/audit baseline is stale.

**Interfaces:**
- Consumes: final SDK 57 source and dependency graph.
- Produces: a pushed commit and verified production deployments.

- [x] **Step 1: Run complete local verification**

Run: `npm test`

Run: `npm run test:coverage`

Run: `npm run lint`

Run: `npm run type-check`

Run: `npm run web:build`

Run: `npm run smoke:system`

Run: `vercel deploy --dry --json`

Expected: all commands exit 0; Vercel input remains below its file limits.

- [ ] **Step 2: Commit only migration files**

```bash
git add -- app.json package.json package-lock.json src/app.config.ts \
  src/hooks/use-voice-recording.ts \
  tests/voice-recording-metering.test.ts docs/superpowers/specs/2026-09-03-expo-57-security-upgrade-design.md
git add -f -- docs/superpowers/plans/2026-09-03-expo-57-security-upgrade.md
git commit -m "fix: upgrade Expo runtime to SDK 57"
```

- [ ] **Step 3: Push and verify CI/deployments**

Run: `git push origin main`

Wait for GitHub Pages and Vercel production to become successful/READY. Verify
both public URLs return HTTP 200 and query Vercel error/5xx logs for the new
deployment.

## Self-review

- Spec coverage: dependency security, incremental migration, removed APIs,
  native recorder truthfulness, configuration, CI, deployment, and observability
  are mapped to Tasks 1–6.
- Placeholder scan: no deferred implementation steps or unspecified error paths
  remain.
- Type consistency: `normalizeRecordingMetering` and the existing
  `useVoiceRecording` return contract are named consistently throughout.
