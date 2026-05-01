# LINE 互動 Demo + 雲端部署 Implementation Plan (Part 1: Phases 0-3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a publicly-reachable LINE Official Account demo of the m'AI Touch AI Housekeeper, deployed to Render free tier, with end-to-end walkthrough scripts, multi-language support, dual resident/housekeeper roles, and a runtime-configurable admin dashboard — all without disturbing the existing prod stack.

**Architecture:** New `src/server/line/` module mounted as sub-routes of the existing Express server. `DEPLOY_PROFILE=demo|prod` env switches between OpenAI-only (demo) and existing Python NLP service (prod). Single LINE channel + `/role` command + `/demo` script engine. Admin dashboard lives in existing Expo Router web (`src/app/admin/line/`) backed by a new `lineAdminRouter` and a `runtime_config` DB table for hot-reload settings.

**Tech Stack:** TypeScript 5.3 + Express 4 + tRPC 10 + Drizzle ORM + SQLite (better-sqlite3) + `@line/bot-sdk` + `openai` + Vitest 4 + supertest + Expo Router 3.

**Spec:** `docs/superpowers/specs/2026-05-01-line-online-demo-design.md`

**Plan files:**
- Part 1 (this file): Phases 0-3 (scaffolding, profile, webhook, AI abstraction)
- Part 2: `2026-05-01-line-online-demo-plan-part2.md` — Phases 4-6 (sessions, flex, resident, housekeeper, demo scripts)
- Part 3: `2026-05-01-line-online-demo-plan-part3.md` — Phases 7-9 (commands/security, deploy, dashboard)

---

## Phase Overview

| Phase | Outcome |
|---|---|
| 0 | Repo + env scaffolding, deps installed |
| 1 | DB migration 006 + profile factory + `/health` |
| 2 | Webhook signature verify + ack + echo bot |
| 3 | AI abstraction + OpenAI intent classifier (mocked tests) |
| 4 | Session store + Flex builders + Resident slot-filling |
| 5 | Housekeeper handler + push notification |
| 6 | `/demo` script engine + 4 scripts |
| 7 | Commands + multilang + rate limit + banner + admin whitelist |
| 8 | Render deployment + cron-job.org + smoke + ops docs |
| 9 | Admin Dashboard (DB 007 + runtime-config + tRPC + 6 web pages) |

**Commit cadence:** every task ends with a commit. Push to `main` only at end of each phase (after phase smoke).

---

# PHASE 0 — Scaffolding

## Task 0.1: Install new npm dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```
npm install @line/bot-sdk@^9.7.0 openai@^4.77.0
```

- [ ] **Step 2: Install dev deps for integration tests**

```
npm install --save-dev supertest@^7.0.0 @types/supertest@^6.0.2 nock@^14.0.0
```

- [ ] **Step 3: Verify install**

```
npm ls @line/bot-sdk openai supertest nock
```

Expected: all 4 listed without UNMET errors.

- [ ] **Step 4: Commit**

```
git add package.json package-lock.json
git commit -m "chore(deps): add @line/bot-sdk, openai, supertest, nock for LINE demo integration"
```

## Task 0.2: Create directory skeleton

**Files:**
- Create: `src/server/line/.gitkeep` and 4 sub-dirs `.gitkeep`
- Create: `tests/line/.gitkeep`

- [ ] **Step 1: Make all directories** — use Bash mkdir + touch

```
mkdir -p src/server/line/handlers src/server/line/ai src/server/line/flex src/server/line/demo-scripts tests/line
touch src/server/line/.gitkeep src/server/line/handlers/.gitkeep src/server/line/ai/.gitkeep src/server/line/flex/.gitkeep src/server/line/demo-scripts/.gitkeep tests/line/.gitkeep
```

- [ ] **Step 2: Commit**

```
git add src/server/line tests/line
git commit -m "chore(line): scaffold directory structure for LINE integration"
```

## Task 0.3: Add new env vars to `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append LINE block at end of `.env.example`** — append exactly:

```bash

# ============================================
# Deploy Profile
# ============================================
# 'demo' = OpenAI-only, 'prod' = existing NLP service
DEPLOY_PROFILE=prod

# ============================================
# LINE Messaging API (demo profile)
# ============================================
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
# Comma-separated LINE userIds allowed /role admin and /demo reset
DEMO_ADMIN_LINE_USERS=

# ============================================
# OpenAI (demo profile only)
# ============================================
OPENAI_MODEL=gpt-4o-mini
```

- [ ] **Step 2: Commit**

```
git add .env.example
git commit -m "docs(env): document LINE, DEPLOY_PROFILE, and OpenAI demo env vars"
```

## Task 0.4: Add `db:init:demo` npm script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Insert script entry**

In the `"scripts"` object, after `"db:init:simple"`, add:

```
"db:init:demo": "ts-node scripts/init-db-demo.ts",
```

- [ ] **Step 2: Verify**

```
node -e "console.log(JSON.parse(require('fs').readFileSync('package.json')).scripts['db:init:demo'])"
```

Expected output: `ts-node scripts/init-db-demo.ts`

- [ ] **Step 3: Commit**

```
git add package.json
git commit -m "chore(scripts): add db:init:demo for demo profile bootstrap"
```

---

# PHASE 1 — Profile Factory + DB Schema + Health

## Task 1.1: Write migration 006_line_integration.sql

**Files:**
- Create: `migrations/sqlite/006_line_integration.sql`

- [ ] **Step 1: Create file with full SQL**

```sql
CREATE TABLE IF NOT EXISTS line_user (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id      TEXT    NOT NULL,
  line_user_id    TEXT    NOT NULL,
  app_user_id     INTEGER REFERENCES users(id),
  role            TEXT    NOT NULL DEFAULT 'resident',
  display_name    TEXT,
  picture_url     TEXT,
  language        TEXT    DEFAULT 'zh-TW',
  is_demo         INTEGER NOT NULL DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel_id, line_user_id)
);
CREATE INDEX IF NOT EXISTS idx_line_user_role ON line_user(role);

CREATE TABLE IF NOT EXISTS line_message_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id    TEXT    NOT NULL,
  direction       TEXT    NOT NULL,
  message_type    TEXT    NOT NULL,
  content         TEXT,
  intent          TEXT,
  session_id      TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_line_message_log_user_time
  ON line_message_log(line_user_id, created_at);
```

- [ ] **Step 2: Run migration**

```
npm run db:migrate
```

Expected: log shows "Applied 006_line_integration.sql".

- [ ] **Step 3: Verify table exists**

```
node -e "const db=require('better-sqlite3')('./data/mai-touch.db');console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'line_%'\").all());"
```

Expected: `[{name:'line_user'},{name:'line_message_log'}]`.

- [ ] **Step 4: Commit**

```
git add migrations/sqlite/006_line_integration.sql
git commit -m "feat(db): add line_user and line_message_log tables (migration 006)"
```

## Task 1.2: Add Drizzle schema entries

**Files:**
- Modify: `src/server/schema.ts`

- [ ] **Step 1: Read existing `schema.ts`** to confirm style (sqliteTable definitions).

- [ ] **Step 2: Append two table definitions matching existing style**

```ts
import { integer, text, sqliteTable, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const lineUser = sqliteTable('line_user', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  channelId:    text('channel_id').notNull(),
  lineUserId:   text('line_user_id').notNull(),
  appUserId:    integer('app_user_id'),
  role:         text('role', { enum: ['resident','housekeeper','admin'] }).notNull().default('resident'),
  displayName:  text('display_name'),
  pictureUrl:   text('picture_url'),
  language:     text('language', { enum: ['zh-TW','en','ja'] }).default('zh-TW'),
  isDemo:       integer('is_demo').notNull().default(0),
  createdAt:    text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt:    text('updated_at').default('CURRENT_TIMESTAMP'),
}, (t) => ({
  uniq:    uniqueIndex('uniq_line_user_channel_user').on(t.channelId, t.lineUserId),
  roleIdx: index('idx_line_user_role').on(t.role),
}));

export const lineMessageLog = sqliteTable('line_message_log', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  lineUserId:   text('line_user_id').notNull(),
  direction:    text('direction', { enum: ['inbound','outbound','outbound:debug'] }).notNull(),
  messageType:  text('message_type').notNull(),
  content:      text('content'),
  intent:       text('intent'),
  sessionId:    text('session_id'),
  createdAt:    text('created_at').default('CURRENT_TIMESTAMP'),
}, (t) => ({
  userTimeIdx: index('idx_line_message_log_user_time').on(t.lineUserId, t.createdAt),
}));
```

- [ ] **Step 3: Type-check**

```
npm run type-check
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```
git add src/server/schema.ts
git commit -m "feat(db): add Drizzle schema for lineUser and lineMessageLog"
```

## Task 1.3: Create `_core/profile.ts` (TDD)

**Files:**
- Create: `src/server/_core/profile.ts`
- Test: `tests/line/profile.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getProfile, resetProfileCache } from '../../src/server/_core/profile';

describe('profile', () => {
  const original = process.env.DEPLOY_PROFILE;
  beforeEach(() => resetProfileCache());
  afterEach(() => { process.env.DEPLOY_PROFILE = original; resetProfileCache(); });

  it('defaults to "prod" when DEPLOY_PROFILE unset', () => {
    delete process.env.DEPLOY_PROFILE;
    expect(getProfile()).toBe('prod');
  });
  it('returns "demo" when DEPLOY_PROFILE=demo', () => {
    process.env.DEPLOY_PROFILE = 'demo';
    expect(getProfile()).toBe('demo');
  });
  it('throws on unknown profile', () => {
    process.env.DEPLOY_PROFILE = 'staging';
    expect(() => getProfile()).toThrow(/DEPLOY_PROFILE/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```
npx vitest run tests/line/profile.test.ts
```

- [ ] **Step 3: Implement**

```ts
export type Profile = 'demo' | 'prod';

let cached: Profile | null = null;

export function getProfile(): Profile {
  if (cached) return cached;
  const raw = process.env.DEPLOY_PROFILE ?? 'prod';
  if (raw !== 'demo' && raw !== 'prod') {
    throw new Error(`DEPLOY_PROFILE must be 'demo' or 'prod', got: ${raw}`);
  }
  cached = raw;
  return cached;
}

export function resetProfileCache(): void { cached = null; }
```

- [ ] **Step 4: Run, expect pass + commit**

```
npx vitest run tests/line/profile.test.ts
git add src/server/_core/profile.ts tests/line/profile.test.ts
git commit -m "feat(profile): add DEPLOY_PROFILE factory with caching"
```

## Task 1.4: Add `/health` endpoint via `createApp` extraction

**Files:**
- Create: `src/server/app.ts`
- Modify: `src/server/index.ts`
- Test: `tests/line/health.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app';

describe('GET /health', () => {
  it('returns 200 with profile and uptime', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.profile).toMatch(/^(demo|prod)$/);
    expect(typeof res.body.uptime_s).toBe('number');
  });
});
```

- [ ] **Step 2: Read current `src/server/index.ts`** to see how Express is bootstrapped.

- [ ] **Step 3: Refactor — extract `createApp()` into `src/server/app.ts`**

Move all Express setup (cors, cookieParser, body parsers, tRPC mount, error middleware) from `index.ts` into a new `src/server/app.ts` exporting `createApp(): express.Express`. Keep `index.ts` as the listen entrypoint:

```ts
// src/server/index.ts
import 'dotenv/config';
import { createApp } from './app';
const PORT = Number(process.env.PORT ?? 3000);
createApp().listen(PORT, () => console.log(`server on ${PORT}`));
```

In `createApp` add `/health` BEFORE tRPC mount:

```ts
import { getProfile } from './_core/profile';

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    profile: getProfile(),
    db: 'ok',
    ai_provider: getProfile() === 'demo' ? 'openai' : 'nlp-service',
    uptime_s: Math.floor(process.uptime()),
  });
});
```

- [ ] **Step 4: Run test, expect pass**

```
npx vitest run tests/line/health.test.ts
```

- [ ] **Step 5: Manual smoke**

```
npm run dev:server
```

Then `curl http://localhost:3000/health` → expect JSON. Stop server.

- [ ] **Step 6: Commit**

```
git add src/server/app.ts src/server/index.ts tests/line/health.test.ts
git commit -m "feat(health): extract createApp + add GET /health with profile info"
```

## Task 1.5: Create `scripts/init-db-demo.ts`

**Files:**
- Create: `scripts/init-db-demo.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Read existing `scripts/init-db.ts`** to understand the migration runner pattern in this repo.

- [ ] **Step 2: Implement init script that reuses the existing runner**

The script should:
1. Read `SQLITE_FILENAME` from env (default `./data/mai-touch-demo.db`)
2. Open a `better-sqlite3` Database
3. Apply each `migrations/sqlite/*.sql` file in alphabetical order using the **same helper function used by `scripts/init-db.ts`** — copy its `applyMigrations(db, dir)` function or import it
4. Seed two users: `id=1 seed@demo.local resident`, `id=2 admin@demo.local admin`
5. Close DB, log done

Skeleton:

```ts
import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { applyMigrations } from './_migration-runner';   // extracted helper

const DB_PATH = process.env.SQLITE_FILENAME ?? './data/mai-touch-demo.db';

function ensureDir(p: string) { fs.mkdirSync(path.dirname(p), { recursive: true }); }

function seedBaseUsers(db: Database.Database) {
  const ins = db.prepare(`INSERT OR IGNORE INTO users (id, email, name, role, login_method, created_at)
                          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`);
  ins.run(1, 'seed@demo.local', 'Demo Seed User', 'user', 'manus');
  ins.run(2, 'admin@demo.local', 'Demo Admin', 'admin', 'manus');
  console.log('[demo-init] seeded base users');
}

function main() {
  ensureDir(DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  applyMigrations(db, path.join(process.cwd(), 'migrations', 'sqlite'));
  seedBaseUsers(db);
  db.close();
  console.log(`[demo-init] done. DB at ${DB_PATH}`);
}

main();
```

- [ ] **Step 3: Extract migration runner** — if `scripts/init-db.ts` does not already export a reusable runner, extract one to `scripts/_migration-runner.ts`. The runner takes the better-sqlite3 db handle, reads each `.sql` file in the directory, and runs it via the database's bulk-script API. **Refer to better-sqlite3 docs for the multi-statement API.**

- [ ] **Step 4: Smoke run locally**

```
DEPLOY_PROFILE=demo SQLITE_FILENAME=./data/mai-touch-demo.db npm run db:init:demo
```

Expected: log lines, `data/mai-touch-demo.db` exists. Verify:

```
node -e "const db=require('better-sqlite3')('./data/mai-touch-demo.db');console.log(db.prepare('SELECT id,email,role FROM users').all());"
```

- [ ] **Step 5: Add demo DB to `.gitignore`**

```
grep -q 'mai-touch-demo' .gitignore || printf '\ndata/mai-touch-demo.db*\n' >> .gitignore
```

- [ ] **Step 6: Commit**

```
git add scripts/init-db-demo.ts scripts/_migration-runner.ts .gitignore
git commit -m "feat(scripts): add init-db-demo to bootstrap demo SQLite + seed users"
```

## Task 1.6: Phase 1 smoke + push

- [ ] **Step 1: Full type-check + tests**

```
npm run type-check
npm run test
```

Expected: zero errors, all tests pass.

- [ ] **Step 2: Manually boot demo profile**

```
DEPLOY_PROFILE=demo SQLITE_FILENAME=./data/mai-touch-demo.db npm run dev:server
```

Then `curl http://localhost:3000/health` → expect `"profile":"demo","ai_provider":"openai"`. Stop.

- [ ] **Step 3: Push Phase 1**

```
git push origin main
```

---

# PHASE 2 — Webhook Signature + Echo Bot

## Task 2.1: Implement signature verification helper (TDD)

**Files:**
- Create: `src/server/line/signature.ts`
- Test: `tests/line/signature.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifySignature } from '../../src/server/line/signature';

const SECRET = 'test-channel-secret';
const BODY = JSON.stringify({ events: [] });
const VALID_SIG = crypto.createHmac('sha256', SECRET).update(BODY).digest('base64');

describe('verifySignature', () => {
  it('accepts a valid signature', () => {
    expect(verifySignature(BODY, VALID_SIG, SECRET)).toBe(true);
  });
  it('rejects a tampered body', () => {
    expect(verifySignature(BODY + 'x', VALID_SIG, SECRET)).toBe(false);
  });
  it('rejects an empty signature', () => {
    expect(verifySignature(BODY, '', SECRET)).toBe(false);
  });
  it('rejects a wrong-length signature without throwing', () => {
    expect(verifySignature(BODY, 'AAAA', SECRET)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```
npx vitest run tests/line/signature.test.ts
```

- [ ] **Step 3: Implement**

```ts
import crypto from 'crypto';

export function verifySignature(rawBody: string, signature: string, channelSecret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', channelSecret).update(rawBody, 'utf8').digest();
  let got: Buffer;
  try { got = Buffer.from(signature, 'base64'); } catch { return false; }
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(got, expected);
}
```

- [ ] **Step 4: Run, expect pass + commit**

```
npx vitest run tests/line/signature.test.ts
git add src/server/line/signature.ts tests/line/signature.test.ts
git commit -m "feat(line): add HMAC-SHA256 signature verification with timingSafeEqual"
```

## Task 2.2: Create `webhook.ts` with raw-body handling and ack

**Files:**
- Create: `src/server/line/webhook.ts`
- Test: `tests/line/webhook.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { mountWebhook } from '../../src/server/line/webhook';

const SECRET = 'test-secret';
process.env.LINE_CHANNEL_SECRET = SECRET;

const sign = (body: string) => crypto.createHmac('sha256', SECRET).update(body).digest('base64');
const makeBody = (events: any[]) => JSON.stringify({ events });

describe('POST /line/webhook', () => {
  let app: express.Express;
  let dispatchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatchSpy = vi.fn().mockResolvedValue(undefined);
    app = express();
    mountWebhook(app, { dispatch: dispatchSpy });
  });

  it('returns 200 for valid signature', async () => {
    const body = makeBody([{ type: 'message', message: { type:'text', text:'hi' } }]);
    const res = await request(app).post('/line/webhook')
      .set('X-Line-Signature', sign(body)).set('Content-Type','application/json').send(body);
    expect(res.status).toBe(200);
  });

  it('returns 401 for invalid signature', async () => {
    const body = makeBody([]);
    const res = await request(app).post('/line/webhook')
      .set('X-Line-Signature', 'wrong').set('Content-Type','application/json').send(body);
    expect(res.status).toBe(401);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('calls dispatch with parsed events', async () => {
    const events = [{ type:'message', message:{type:'text',text:'hi'} }];
    const body = makeBody(events);
    await request(app).post('/line/webhook')
      .set('X-Line-Signature', sign(body)).set('Content-Type','application/json').send(body);
    await new Promise(r => setImmediate(r));
    expect(dispatchSpy).toHaveBeenCalledWith(events);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```
npx vitest run tests/line/webhook.test.ts
```

- [ ] **Step 3: Implement**

```ts
import type { Express, Request, Response } from 'express';
import express from 'express';
import { verifySignature } from './signature';

export type Dispatcher = { dispatch: (events: any[]) => Promise<void> };

export function mountWebhook(app: Express, deps: Dispatcher): void {
  app.post('/line/webhook',
    express.raw({ type: 'application/json' }),
    (req: Request, res: Response) => {
      const secret = process.env.LINE_CHANNEL_SECRET ?? '';
      const sig = (req.header('X-Line-Signature') ?? '').toString();
      const raw = (req.body as Buffer).toString('utf8');

      if (!verifySignature(raw, sig, secret)) {
        console.warn('[LINE] signature verification failed', { ip: req.ip });
        res.status(401).send('invalid signature');
        return;
      }

      let events: any[] = [];
      try { events = JSON.parse(raw).events ?? []; }
      catch { res.status(400).send('bad json'); return; }

      res.status(200).send('ok');
      setImmediate(() => {
        deps.dispatch(events).catch(err => console.error('[LINE] dispatch error', err));
      });
    }
  );
}
```

- [ ] **Step 4: Run pass + commit**

```
npx vitest run tests/line/webhook.test.ts
git add src/server/line/webhook.ts tests/line/webhook.test.ts
git commit -m "feat(line): add /line/webhook with sig verification and async dispatch"
```

## Task 2.3: Stub dispatcher (echo bot)

**Files:**
- Create: `src/server/line/dispatcher.ts`
- Test: `tests/line/dispatcher-echo.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { dispatch } from '../../src/server/line/dispatcher';

describe('dispatcher echo (stub)', () => {
  it('replies with echoed text via injected lineClient', async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    await dispatch([
      { type:'message', replyToken:'rt-1', source:{userId:'U1'}, message:{type:'text', text:'hello'} }
    ], { lineClient: { reply, push: vi.fn() } as any });
    expect(reply).toHaveBeenCalledWith('rt-1', expect.objectContaining({ type:'text', text: expect.stringContaining('hello') }));
  });

  it('ignores non-text messages in stub', async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    await dispatch([{ type:'message', replyToken:'rt', source:{userId:'U2'}, message:{type:'sticker'} }],
      { lineClient: { reply, push: vi.fn() } as any });
    expect(reply).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```ts
export type DispatchDeps = {
  lineClient: { reply: (token: string, msg: any) => Promise<void>; push: (userId: string, msg: any) => Promise<void> };
};

export async function dispatch(events: any[], deps: DispatchDeps): Promise<void> {
  for (const ev of events) {
    if (ev.type !== 'message' || ev.message?.type !== 'text') continue;
    const text = ev.message.text as string;
    await deps.lineClient.reply(ev.replyToken, { type: 'text', text: `echo: ${text}` });
  }
}
```

- [ ] **Step 3: Run pass + commit**

```
npx vitest run tests/line/dispatcher-echo.test.ts
git add src/server/line/dispatcher.ts tests/line/dispatcher-echo.test.ts
git commit -m "feat(line): add stub dispatcher that echoes text messages"
```

## Task 2.4: Implement `line-client.ts` wrapping `@line/bot-sdk`

**Files:**
- Create: `src/server/line/line-client.ts`
- Test: `tests/line/line-client.test.ts`

- [ ] **Step 1: Write failing test (mocks @line/bot-sdk)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const replyMessage = vi.fn().mockResolvedValue({});
const pushMessage  = vi.fn().mockResolvedValue({});

vi.mock('@line/bot-sdk', () => ({
  Client: vi.fn().mockImplementation(() => ({ replyMessage, pushMessage })),
}));

beforeEach(() => { replyMessage.mockClear(); pushMessage.mockClear(); });

describe('LineClient', () => {
  it('reply calls SDK replyMessage', async () => {
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken: 't', channelSecret: 's' });
    await c.reply('rt', { type:'text', text:'hi' });
    expect(replyMessage).toHaveBeenCalledWith('rt', { type:'text', text:'hi' });
  });

  it('push calls SDK pushMessage', async () => {
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken: 't', channelSecret: 's' });
    await c.push('U1', { type:'text', text:'yo' });
    expect(pushMessage).toHaveBeenCalledWith('U1', { type:'text', text:'yo' });
  });

  it('replyOrPush falls back to push on InvalidReplyToken', async () => {
    replyMessage.mockRejectedValueOnce(Object.assign(new Error('Invalid reply token'), { statusCode: 400 }));
    const { LineClient } = await import('../../src/server/line/line-client');
    const c = new LineClient({ channelAccessToken: 't', channelSecret: 's' });
    await c.replyOrPush('rt-expired', 'U1', { type:'text', text:'late' });
    expect(pushMessage).toHaveBeenCalledWith('U1', { type:'text', text:'late' });
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { Client } from '@line/bot-sdk';

export type LineClientOpts = { channelAccessToken: string; channelSecret: string };

export class LineClient {
  private sdk: Client;
  constructor(opts: LineClientOpts) { this.sdk = new Client(opts); }

  async reply(token: string, msg: any | any[]): Promise<void> {
    await this.sdk.replyMessage(token, msg);
  }
  async push(userId: string, msg: any | any[]): Promise<void> {
    await this.sdk.pushMessage(userId, msg);
  }
  async replyOrPush(replyToken: string | undefined, userId: string, msg: any | any[]): Promise<void> {
    if (replyToken) {
      try { await this.reply(replyToken, msg); return; }
      catch (err: any) {
        const expired = err?.statusCode === 400 && /reply token/i.test(err?.message ?? '');
        if (!expired) throw err;
      }
    }
    await this.push(userId, msg);
  }
}
```

- [ ] **Step 3: Run pass + commit**

```
npx vitest run tests/line/line-client.test.ts
git add src/server/line/line-client.ts tests/line/line-client.test.ts
git commit -m "feat(line): wrap @line/bot-sdk with reply/push/replyOrPush"
```

## Task 2.5: Wire webhook + dispatcher + lineClient into Express

**Files:**
- Modify: `src/server/app.ts`
- Modify: `src/server/line/dispatcher.ts`

- [ ] **Step 1: Add a default-deps factory in dispatcher**

Append to `src/server/line/dispatcher.ts`:

```ts
import { LineClient } from './line-client';

let defaultDeps: DispatchDeps | null = null;
export function getDefaultDispatchDeps(): DispatchDeps {
  if (defaultDeps) return defaultDeps;
  defaultDeps = {
    lineClient: new LineClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
      channelSecret:      process.env.LINE_CHANNEL_SECRET ?? '',
    }),
  };
  return defaultDeps;
}
```

- [ ] **Step 2: Mount webhook only when LINE env present**

In `src/server/app.ts`, AFTER `/health` and BEFORE the JSON body parser used by tRPC (because `/line/webhook` needs raw body):

```ts
import { mountWebhook } from './line/webhook';
import { dispatch, getDefaultDispatchDeps } from './line/dispatcher';

if (process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  mountWebhook(app, { dispatch: (events) => dispatch(events, getDefaultDispatchDeps()) });
  console.log('[LINE] webhook mounted at /line/webhook');
} else {
  console.log('[LINE] webhook not mounted (missing LINE_CHANNEL_*)');
}
```

- [ ] **Step 3: Type-check**

```
npm run type-check
```

- [ ] **Step 4: Commit**

```
git add src/server/app.ts src/server/line/dispatcher.ts
git commit -m "feat(line): mount /line/webhook conditionally on LINE env presence"
```

## Task 2.6: Phase 2 smoke (manual via ngrok) + push

- [ ] **Step 1: Run all tests**

```
npm run test
```

- [ ] **Step 2: Manual smoke checklist** — record pass/fail in scratch (do not commit)

1. `npm run dev:server` with `LINE_CHANNEL_SECRET` + `LINE_CHANNEL_ACCESS_TOKEN` set
2. `ngrok http 3000` → copy https URL
3. LINE Developer Console → Messaging API → Webhook URL = `https://<ngrok>/line/webhook` → Verify (expect green)
4. Add bot as friend, send "hello" → expect reply "echo: hello"

- [ ] **Step 3: Push Phase 2**

```
git push origin main
```

---

# PHASE 3 — AI Abstraction + OpenAI Intent

## Task 3.1: Define `ai/types.ts` interface contract

**Files:**
- Create: `src/server/line/ai/types.ts`

- [ ] **Step 1: Write the file**

```ts
export type Lang = 'zh-TW' | 'en' | 'ja';

export type IntentName =
  | 'facility.book' | 'facility.cancel' | 'facility.list'
  | 'repair.report'
  | 'visitor.notify'
  | 'complaint.file'
  | 'workorder.status'
  | 'small_talk' | 'unknown';

export type Slot = {
  date?: string; time?: string;
  facility?: 'gym' | 'pool' | 'meeting_room' | 'lounge' | 'bbq' | 'sauna';
  duration_min?: number; location?: string; issue?: string;
  visitor_name?: string; visitor_count?: number;
  urgency?: 'low' | 'med' | 'high';
  language_detected?: Lang;
};

export type IntentResult = {
  intent: IntentName;
  confidence: number;
  slots: Slot;
  language: Lang;
  rephrase?: string;
};

export interface IntentClassifier {
  classify(text: string, ctx: { userId: string; history?: string[] }): Promise<IntentResult>;
}

export class AiUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message); this.name = 'AiUnavailableError';
  }
}
```

- [ ] **Step 2: Type-check + commit**

```
npm run type-check
git add src/server/line/ai/types.ts
git commit -m "feat(line/ai): define IntentClassifier interface and types"
```

## Task 3.2: Implement `OpenAIIntent` (TDD with mocked OpenAI)

**Files:**
- Create: `src/server/line/ai/openai-intent.ts`
- Test: `tests/line/openai-intent.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const create = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({ chat: { completions: { create } } })),
}));

beforeEach(() => create.mockReset());

const ok = (body: any) => ({ choices: [{ message: { content: JSON.stringify(body) } }] });

describe('OpenAIIntent', () => {
  it('parses facility.book intent + slots', async () => {
    create.mockResolvedValueOnce(ok({
      intent: 'facility.book', confidence: 0.92,
      slots: { facility:'gym', date:'2026-05-09', time:'19:00' },
      language: 'zh-TW', rephrase: '我聽到您想預約週六晚上 7 點的健身房,對嗎?'
    }));
    const { OpenAIIntent } = await import('../../src/server/line/ai/openai-intent');
    const ai = new OpenAIIntent({ apiKey:'k', model:'gpt-4o-mini' });
    const r = await ai.classify('我想預約週六晚上7點的健身房', { userId: 'U1' });
    expect(r.intent).toBe('facility.book');
    expect(r.slots.facility).toBe('gym');
    expect(r.confidence).toBeCloseTo(0.92);
  });

  it('returns unknown on schema-violating output', async () => {
    create.mockResolvedValueOnce(ok({ intent:'NOT_REAL', confidence: 1.5, slots:{}, language:'xx' }));
    const { OpenAIIntent } = await import('../../src/server/line/ai/openai-intent');
    const ai = new OpenAIIntent({ apiKey:'k', model:'gpt-4o-mini' });
    const r = await ai.classify('???', { userId:'U2' });
    expect(r.intent).toBe('unknown');
    expect(r.confidence).toBe(0);
  });

  it('retries once then throws AiUnavailableError', async () => {
    create.mockRejectedValue(new Error('429'));
    const { OpenAIIntent } = await import('../../src/server/line/ai/openai-intent');
    const { AiUnavailableError } = await import('../../src/server/line/ai/types');
    const ai = new OpenAIIntent({ apiKey:'k', model:'gpt-4o-mini' });
    await expect(ai.classify('hi', { userId:'U3' })).rejects.toBeInstanceOf(AiUnavailableError);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import OpenAI from 'openai';
import { z } from 'zod';
import type { IntentClassifier, IntentResult } from './types';
import { AiUnavailableError } from './types';

const SYSTEM_PROMPT = `
You are the intent classifier for "m'AI Touch", a luxury residential building's housekeeper bot.
Output ONLY JSON matching the provided schema.
- Detect language: "zh-TW" | "en" | "ja".
- Extract slots ONLY if user clearly stated them. NEVER invent dates/times.
- "intent"="small_talk" for greetings; "unknown" if you genuinely cannot tell.
- "rephrase" is a one-sentence echo in detected language confirming what you understood.
- "confidence" < 0.6 means you are guessing.
`.trim();

const Schema = z.object({
  intent: z.enum(['facility.book','facility.cancel','facility.list','repair.report',
                  'visitor.notify','complaint.file','workorder.status','small_talk','unknown']),
  confidence: z.number().min(0).max(1),
  slots: z.object({
    date: z.string().optional(),
    time: z.string().optional(),
    facility: z.enum(['gym','pool','meeting_room','lounge','bbq','sauna']).optional(),
    duration_min: z.number().optional(),
    location: z.string().optional(),
    issue: z.string().optional(),
    visitor_name: z.string().optional(),
    visitor_count: z.number().optional(),
    urgency: z.enum(['low','med','high']).optional(),
    language_detected: z.enum(['zh-TW','en','ja']).optional(),
  }).default({}),
  language: z.enum(['zh-TW','en','ja']),
  rephrase: z.string().optional(),
});

export class OpenAIIntent implements IntentClassifier {
  private client: OpenAI;
  constructor(private opts: { apiKey: string; model: string; temperature?: number }) {
    this.client = new OpenAI({ apiKey: opts.apiKey });
  }

  async classify(text: string, ctx: { userId: string; history?: string[] }): Promise<IntentResult> {
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...((ctx.history ?? []).slice(-4).map(h => ({ role:'user' as const, content: h }))),
      { role: 'user' as const, content: text },
    ];

    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await this.client.chat.completions.create({
          model: this.opts.model,
          messages,
          response_format: { type: 'json_object' },
          temperature: this.opts.temperature ?? 0.1,
        });
        const raw = resp.choices[0]?.message?.content ?? '{}';
        const parsed = Schema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          console.warn('[AI] schema parse fail, raw=', raw);
          return { intent: 'unknown', confidence: 0, slots: {}, language: 'zh-TW' };
        }
        return parsed.data;
      } catch (err) {
        lastErr = err;
        console.warn(`[AI] attempt ${attempt + 1} failed:`, err);
      }
    }
    throw new AiUnavailableError('OpenAI classify failed after retry', lastErr);
  }
}
```

- [ ] **Step 3: Run pass + commit**

```
npx vitest run tests/line/openai-intent.test.ts
git add src/server/line/ai/openai-intent.ts tests/line/openai-intent.test.ts
git commit -m "feat(line/ai): add OpenAIIntent classifier with zod validation + 1-retry"
```

## Task 3.3: Implement `NlpBridge` adapter (TDD with nock)

**Files:**
- Create: `src/server/line/ai/nlp-bridge.ts`
- Test: `tests/line/nlp-bridge.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { NlpBridge } from '../../src/server/line/ai/nlp-bridge';
import { AiUnavailableError } from '../../src/server/line/ai/types';

const BASE = 'http://nlp.local';
beforeEach(() => nock.cleanAll());
afterEach(() => nock.cleanAll());

describe('NlpBridge', () => {
  it('adapts NLP service shape to IntentResult', async () => {
    nock(BASE).post('/api/intent/classify').reply(200, {
      intent_class: 'facility_book', score: 0.87,
      entities: [{ type:'facility', value:'gym' }, { type:'date', value:'2026-05-09' }],
      detected_lang: 'zh-TW',
    });
    const ai = new NlpBridge({ baseUrl: BASE, timeoutMs: 2000 });
    const r = await ai.classify('hi', { userId: 'U1' });
    expect(r.intent).toBe('facility.book');
    expect(r.slots.facility).toBe('gym');
    expect(r.slots.date).toBe('2026-05-09');
    expect(r.language).toBe('zh-TW');
  });

  it('throws AiUnavailableError on 5xx', async () => {
    nock(BASE).post('/api/intent/classify').reply(503, 'down');
    const ai = new NlpBridge({ baseUrl: BASE, timeoutMs: 2000 });
    await expect(ai.classify('x', { userId:'U' })).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { IntentClassifier, IntentResult, IntentName, Lang } from './types';
import { AiUnavailableError } from './types';

const INTENT_MAP: Record<string, IntentName> = {
  facility_book:    'facility.book',
  facility_cancel:  'facility.cancel',
  facility_list:    'facility.list',
  repair_report:    'repair.report',
  visitor_notify:   'visitor.notify',
  complaint_file:   'complaint.file',
  workorder_status: 'workorder.status',
  small_talk:       'small_talk',
  unknown:          'unknown',
};

export class NlpBridge implements IntentClassifier {
  constructor(private opts: { baseUrl: string; timeoutMs: number }) {}

  async classify(text: string, ctx: { userId: string; history?: string[] }): Promise<IntentResult> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    try {
      const r = await fetch(`${this.opts.baseUrl}/api/intent/classify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, user_id: ctx.userId, history: ctx.history ?? [] }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new AiUnavailableError(`NLP ${r.status}`);
      const raw = await r.json() as any;
      return adapt(raw);
    } catch (err) {
      if (err instanceof AiUnavailableError) throw err;
      throw new AiUnavailableError('NLP service request failed', err);
    } finally { clearTimeout(t); }
  }
}

function adapt(raw: any): IntentResult {
  const slots: IntentResult['slots'] = {};
  for (const e of (raw.entities ?? []) as Array<{type:string;value:string}>) {
    switch (e.type) {
      case 'facility': slots.facility = e.value as IntentResult['slots']['facility']; break;
      case 'date':     slots.date = e.value; break;
      case 'time':     slots.time = e.value; break;
      case 'location': slots.location = e.value; break;
      case 'issue':    slots.issue = e.value; break;
    }
  }
  return {
    intent: INTENT_MAP[raw.intent_class] ?? 'unknown',
    confidence: typeof raw.score === 'number' ? raw.score : 0,
    slots,
    language: ((raw.detected_lang as Lang) ?? 'zh-TW'),
  };
}
```

- [ ] **Step 3: Run pass + commit**

```
npx vitest run tests/line/nlp-bridge.test.ts
git add src/server/line/ai/nlp-bridge.ts tests/line/nlp-bridge.test.ts
git commit -m "feat(line/ai): add NlpBridge adapter from existing NLP service to IntentResult"
```

## Task 3.4: Wire `getAi()` factory in `_core/profile.ts`

**Files:**
- Modify: `src/server/_core/profile.ts`
- Test: `tests/line/profile-ai.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAi, resetAiCache } from '../../src/server/_core/profile';
import { OpenAIIntent } from '../../src/server/line/ai/openai-intent';
import { NlpBridge } from '../../src/server/line/ai/nlp-bridge';

const orig = { ...process.env };
beforeEach(() => resetAiCache());
afterEach(() => { process.env = { ...orig }; resetAiCache(); });

describe('getAi factory', () => {
  it('returns OpenAIIntent for demo profile', () => {
    process.env.DEPLOY_PROFILE = 'demo';
    process.env.OPENAI_API_KEY = 'k';
    expect(getAi()).toBeInstanceOf(OpenAIIntent);
  });
  it('returns NlpBridge for prod profile', () => {
    process.env.DEPLOY_PROFILE = 'prod';
    process.env.NLP_SERVICE_URL = 'http://x';
    expect(getAi()).toBeInstanceOf(NlpBridge);
  });
});
```

- [ ] **Step 2: Extend `_core/profile.ts` — append**

```ts
import type { IntentClassifier } from '../line/ai/types';

let aiCache: IntentClassifier | null = null;

export function getAi(): IntentClassifier {
  if (aiCache) return aiCache;
  const profile = getProfile();
  if (profile === 'demo') {
    const { OpenAIIntent } = require('../line/ai/openai-intent') as typeof import('../line/ai/openai-intent');
    aiCache = new OpenAIIntent({
      apiKey:      required('OPENAI_API_KEY'),
      model:       process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      temperature: Number(process.env.OPENAI_TEMPERATURE ?? '0.1'),
    });
  } else {
    const { NlpBridge } = require('../line/ai/nlp-bridge') as typeof import('../line/ai/nlp-bridge');
    aiCache = new NlpBridge({
      baseUrl:   required('NLP_SERVICE_URL'),
      timeoutMs: Number(process.env.NLP_TIMEOUT_MS ?? '8000'),
    });
  }
  return aiCache;
}

export function resetAiCache(): void { aiCache = null; }

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
```

- [ ] **Step 3: Run pass + commit**

```
npx vitest run tests/line/profile-ai.test.ts
git add src/server/_core/profile.ts tests/line/profile-ai.test.ts
git commit -m "feat(profile): add getAi() factory choosing OpenAI or NLP bridge by profile"
```

## Task 3.5: Phase 3 wrap

- [ ] **Step 1: Run all tests + type-check**

```
npm run type-check
npm run test
```

- [ ] **Step 2: Push**

```
git push origin main
```

---

**End of Part 1 (Phases 0-3).** Continue with Part 2 for Phases 4-6 (sessions, flex, resident, housekeeper, demo scripts) and Part 3 for Phases 7-9 (commands/security, deploy, dashboard).
