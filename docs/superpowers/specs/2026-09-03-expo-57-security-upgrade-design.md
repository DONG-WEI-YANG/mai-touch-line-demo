# Expo 57 Security Upgrade Design

## Problem

The production dependency audit reports 26 advisories: 8 high, 17 moderate,
and 1 low. Every high-severity path is rooted in Expo SDK 54's CLI/Metro
toolchain. npm reports that the supported remediation is Expo 57.0.19, a major
upgrade.

The application also declares `expo-av`, which Expo deprecated in SDK 54 and
removed from Expo Go in SDK 55. The only import is the native
`useVoiceRecording` hook. The production web voice-booking UI uses the separate
`useWebVoiceRecorder` hook and must remain behaviorally unchanged.

## Decision

Upgrade incrementally from Expo SDK 54 through 55 and 56 to SDK 57, following
Expo's official upgrade sequence. Before SDK 55, migrate the native recording
hook from `expo-av` to `expo-audio` and configure the `expo-audio` plugin in the
active root `app.json`.

The recorder will use `useAudioRecorder` and `useAudioRecorderState`, return the
real completed recording URI, and derive its waveform level from real metering
data instead of random values. The existing hook return contract remains
unchanged.

## Compatibility boundaries

- Target Expo package: `^57.0.19` or newer SDK 57 patch.
- Target React Native: the version selected by `npx expo install --fix` for SDK
  57 (at least 0.86.3, which contains the SDK 57 Hermes fixes).
- Target React: the SDK 57 supported version (19.2.3 at design time).
- Node remains `>=24 <25` locally, on Vercel, and in GitHub Actions.
- No generated `android/` or `ios/` directories are present; the project uses
  Continuous Native Generation.
- The removed `newArchEnabled` and `edgeToEdgeEnabled` configuration fields
  must not remain in Expo configuration.
- Web voice capture, authentication, tRPC data flows, and UI routes must remain
  unchanged.
- User-owned `docs/slides` changes are excluded from every commit.

## Verification

Each SDK hop must pass `npx expo install --check`, `npx expo-doctor@latest`,
`npm run type-check`, focused tests, and `npm run web:build`. The final SDK 57
state must additionally pass the complete Vitest suite, production dependency
audit with zero high/critical advisories, system smoke test, Vercel dry-run,
GitHub Actions, and production HTTP/error-log checks.
