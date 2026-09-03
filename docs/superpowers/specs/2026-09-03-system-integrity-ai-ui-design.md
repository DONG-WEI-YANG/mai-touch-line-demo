# System Integrity, AI Authenticity, and UI Integration Design

## Purpose

Strengthen the existing m'AI Touch application through twenty evidence-driven
iterations. Every user-visible capability must either call a real application
service or clearly report that the required provider is unavailable. Data
written offline must remain queued until the server confirms the mutation, and
administrators must be able to see the real health of the database, NLP, AI,
and sync layers.

## Current Evidence

- The repository contains an Expo Router client, Express/tRPC server, SQLite and
  PostgreSQL adapters, an optional Python NLP service, LINE integration, voice
  transcription, and hardware gateway integration.
- The initial TypeScript check passes.
- The initial Web export succeeds but reports a missing favicon.
- The initial unit suite reports 307 passing and 75 failing tests. All 75
  failures share one environmental cause: the installed `better-sqlite3`
  binary targets Node ABI 127 while the active Node 24 runtime uses ABI 137.
- The resident chat UI currently generates canned responses in the client even
  though a real authenticated `chat.send` tRPC procedure exists. This is the
  primary AI-authenticity gap.
- System diagnostics are duplicated, contain hard-coded service locations, and
  report configuration presence rather than verified capability.
- ESLint emits 204 warnings and fails its current warning budget.

## Constraints

- Target Node.js is 24 LTS, matching the installed runtime and current Vercel
  default. Native dependencies must support Node 24.
- Preserve the current Expo Router + tRPC architecture and public route names.
- Preserve the user's unrelated files under `docs/slides/`.
- Never expose API keys, bearer tokens, session secrets, or provider response
  bodies in diagnostics.
- Do not fabricate an AI, NLP, database, sync, hardware, or notification status.
- A failed remote mutation remains recoverable; it is never silently marked as
  successful.
- New behavior is introduced test-first. Configuration-only runtime repair is
  verified by reproducing the original failing command before and after.

## Architecture

### Runtime and dependency boundary

`package.json`, `.nvmrc`, the lockfile, CI, and Vercel configuration describe a
single Node 24 runtime. `better-sqlite3` is upgraded to a Node-24-compatible
release and rebuilt by a clean install. The test runner receives explicit
timeouts only when import timing is proven to be legitimate rather than masking
a deadlock.

### AI boundary

The client sends resident messages through `chat.send` and renders the returned
assistant text. The server owns prompts, provider invocation, persistence, and
error classification. Client-side NLP may enrich UI routing suggestions, but it
must not claim a remote action occurred. If the user is offline, the message is
queued and the UI labels it as queued; if AI is unconfigured or unreachable,
the UI receives a typed, honest error and offers retry. Canned copy is limited
to onboarding/help text and is never presented as a completed AI action.

### Data integrity boundary

A focused diagnostics service checks:

1. database connectivity and dialect;
2. SQLite `PRAGMA quick_check` and `foreign_key_check` when SQLite is active;
3. required domain tables and applied migrations;
4. optional provider configuration and bounded reachability;
5. offline queue validity, retry state, and persistence errors.

Checks return structured statuses (`healthy`, `degraded`, `unavailable`, or
`unconfigured`) with timestamps and safe messages. The admin-only tRPC route is
the single source of truth consumed by the admin UI.

### Sync boundary

Persisted queue entries are schema-validated when loaded. Corrupt entries are
quarantined instead of crashing or being silently accepted. Queue persistence
errors propagate to callers. Processing is ordered and single-flight. Every
state transition is saved before a completion event is emitted, and failed
entries support explicit retry without clearing unrelated operations.

### UI boundary

The resident chat displays sending, queued, failed, and confirmed states based
on real transport outcomes. The admin console gains a System Integrity screen
that shows the server diagnostics and client sync queue, including last checked
time and a manual refresh action. Empty, loading, degraded, and error states are
accessible and do not imply success.

## Error Handling

- Provider requests use an abort timeout and convert secrets/provider payloads
  into safe application errors.
- Database checks isolate individual failures so one optional service cannot
  hide database corruption.
- Offline queue serialization failures reject the initiating operation.
- UI mutations always clear their busy state in `finally` and retain a retryable
  message on failure.
- Logs include a stable operation or diagnostic ID but no credentials.

## Verification Strategy

The twenty loops are tracked in the implementation plan. Each behavior loop
uses a red-green-regression cycle. Final acceptance requires:

- the complete Vitest suite passes with zero failed tests;
- TypeScript exits zero;
- ESLint exits zero within the declared warning budget;
- Expo Web export exits zero without missing-asset warnings;
- local API/Web smoke checks pass when their prerequisites are available;
- AI contract tests prove the real server invocation and UI transport path;
- database integrity tests cover healthy, corrupt/foreign-key, and unavailable
  states;
- the final diff contains no unrelated slide changes.

## Scope Control

An iteration may add a capability only when a failing test, integrity check, or
real UI flow demonstrates the need. Broad database replacement, provider
migration, billing-provider provisioning, and production deployment are outside
this strengthening pass unless a verified blocker requires them.
