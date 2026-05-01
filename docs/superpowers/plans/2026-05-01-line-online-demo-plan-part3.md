# LINE 互動 Demo Implementation Plan (Part 3: Phases 7-9)

> Continues from `2026-05-01-line-online-demo-plan-part2.md`. Same conventions: TDD, exact file paths, commit per task.

---

# PHASE 7 — Commands, Multilang, Rate Limit, Demo Banner, Admin Whitelist

## Task 7.1: `handlers/command.ts` for `/help`, `/role`, `/lang`, `/reset`, `/whoami`, `/demo` family

**Files:**
- Create: `src/server/line/handlers/command.ts`
- Test: `tests/line/handlers-command.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { isCommand, handleCommand } from '../../src/server/line/handlers/command';

describe('command parser', () => {
  it('detects /help', () => expect(isCommand('/help')).toBe(true));
  it('detects /role resident', () => expect(isCommand('/role resident')).toBe(true));
  it('case-insensitive', () => expect(isCommand('/HELP')).toBe(true));
  it('rejects non-command', () => expect(isCommand('hello')).toBe(false));
});

describe('command handler', () => {
  const mkClient = () => ({ replyOrPush: vi.fn().mockResolvedValue(undefined) });
  const mkRepo = () => ({
    setRole: vi.fn(), setLanguage: vi.fn(),
    byLineId: vi.fn().mockReturnValue({ lineUserId:'U1', role:'resident', language:'zh-TW' }),
  });

  it('/role housekeeper sets role and confirms', async () => {
    const client = mkClient(); const repo = mkRepo();
    await handleCommand('/role housekeeper',
      { type:'message', replyToken:'rt', source:{userId:'U1'}, message:{type:'text', text:'/role housekeeper'} } as any,
      { client: client as any, lineUserRepo: repo as any, channelId:'C',
        lineUser:{ lineUserId:'U1', role:'resident', language:'zh-TW' } as any,
        sessionStore: { clear: vi.fn() } as any,
        adminWhitelist: [], startDemo: vi.fn(), stopDemo: vi.fn(),
        listScripts: () => [], demoReset: vi.fn() });
    expect(repo.setRole).toHaveBeenCalledWith('C', 'U1', 'housekeeper');
    expect(client.replyOrPush).toHaveBeenCalled();
  });

  it('/role admin denied for non-whitelisted user', async () => {
    const client = mkClient(); const repo = mkRepo();
    await handleCommand('/role admin',
      { type:'message', replyToken:'rt', source:{userId:'U1'}, message:{type:'text', text:'/role admin'} } as any,
      { client: client as any, lineUserRepo: repo as any, channelId:'C',
        lineUser:{ lineUserId:'U1', role:'resident', language:'zh-TW' } as any,
        sessionStore: { clear: vi.fn() } as any,
        adminWhitelist: ['Uadmin'], startDemo: vi.fn(), stopDemo: vi.fn(),
        listScripts: () => [], demoReset: vi.fn() });
    expect(repo.setRole).not.toHaveBeenCalled();
  });

  it('/reset clears session', async () => {
    const client = mkClient(); const repo = mkRepo();
    const store = { clear: vi.fn() };
    await handleCommand('/reset',
      { type:'message', replyToken:'rt', source:{userId:'U1'}, message:{type:'text', text:'/reset'} } as any,
      { client: client as any, lineUserRepo: repo as any, channelId:'C',
        lineUser:{ lineUserId:'U1', role:'resident', language:'zh-TW' } as any,
        sessionStore: store as any,
        adminWhitelist: [], startDemo: vi.fn(), stopDemo: vi.fn(),
        listScripts: () => [], demoReset: vi.fn() });
    expect(store.clear).toHaveBeenCalledWith('U1');
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { LineClient } from '../line-client';
import type { Lang } from '../ai/types';
import type { SessionStore } from '../session-store';
import type { makeLineUserRepo } from '../line-user-repo';

export function isCommand(text: string): boolean { return /^\s*\//.test(text); }

export type CommandDeps = {
  client: LineClient;
  lineUserRepo: ReturnType<typeof makeLineUserRepo>;
  channelId: string;
  lineUser: { lineUserId: string; role: 'resident'|'housekeeper'|'admin'; language: Lang };
  sessionStore: SessionStore;
  adminWhitelist: string[];
  startDemo: (id: string) => Promise<void>;
  stopDemo: () => Promise<void>;
  listScripts: () => Array<{ id: string; title: Record<Lang, string> }>;
  demoReset: () => Promise<void>;
};

export async function handleCommand(rawText: string, ev: any, d: CommandDeps): Promise<void> {
  const text = rawText.trim().toLowerCase();
  const userId = d.lineUser.lineUserId;
  const lang = d.lineUser.language;
  const reply = (msg: any) => d.client.replyOrPush(ev.replyToken, userId, msg);

  if (text === '/help')
    return reply({ type:'text', text: helpText(d) });

  if (text === '/whoami')
    return reply({ type:'text', text: `id=${userId.slice(0,8)} role=${d.lineUser.role} lang=${lang}` });

  if (text === '/reset') {
    d.sessionStore.clear(userId);
    return reply({ type:'text', text:'session reset' });
  }

  const roleMatch = text.match(/^\/role\s+(resident|housekeeper|admin)$/);
  if (roleMatch) {
    const newRole = roleMatch[1] as 'resident'|'housekeeper'|'admin';
    if (newRole === 'admin' && !d.adminWhitelist.includes(userId))
      return reply({ type:'text', text:'forbidden: admin role requires whitelist' });
    d.lineUserRepo.setRole(d.channelId, userId, newRole);
    return reply({ type:'text', text: `role => ${newRole}` });
  }

  const langMatch = text.match(/^\/lang\s+(zh|en|ja)$/);
  if (langMatch) {
    const map: Record<string, Lang> = { zh:'zh-TW', en:'en', ja:'ja' };
    d.lineUserRepo.setLanguage(d.channelId, userId, map[langMatch[1]]);
    return reply({ type:'text', text: `lang => ${map[langMatch[1]]}` });
  }

  if (text === '/demo list')
    return reply({ type:'text', text: 'available: ' + d.listScripts().map(s => s.id).join(', ') });

  if (text === '/demo stop') { await d.stopDemo(); return reply({ type:'text', text:'demo stopped' }); }

  if (text === '/demo reset') {
    if (!d.adminWhitelist.includes(userId))
      return reply({ type:'text', text:'forbidden: /demo reset requires admin whitelist' });
    await d.demoReset();
    return reply({ type:'text', text:'demo DB reset complete' });
  }

  const scriptMatch = text.match(/^\/demo\s+(\w+)$/);
  if (scriptMatch) { await d.startDemo(scriptMatch[1]); return; }

  // unknown /command — let main dispatcher pass it to AI
}

function helpText(d: CommandDeps): string {
  return [
    '/help            this menu',
    '/role <r>        switch role: resident | housekeeper | admin',
    '/lang <l>        zh | en | ja',
    '/demo <id>       run demo script (list: /demo list)',
    '/demo stop       stop running demo',
    '/reset           clear your conversation state',
    '/whoami          show your id/role/lang',
    `your role=${d.lineUser.role} lang=${d.lineUser.language}`,
  ].join('\n');
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/handlers-command.test.ts
git add src/server/line/handlers/command.ts tests/line/handlers-command.test.ts
git commit -m "feat(line): /help /role /lang /demo /reset /whoami command handler"
```

## Task 7.2: Per-user rate limiter

**Files:**
- Create: `src/server/line/rate-limit.ts`
- Test: `tests/line/rate-limit.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeRateLimiter } from '../../src/server/line/rate-limit';

describe('rateLimiter', () => {
  it('allows under perMinute', () => {
    let now = 0;
    const rl = makeRateLimiter({ perMinute: 3, perDay: 100, now: () => now });
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false);
  });
  it('refills after a minute', () => {
    let now = 0;
    const rl = makeRateLimiter({ perMinute: 1, perDay: 100, now: () => now });
    rl.check('U1');
    expect(rl.check('U1')).toBe(false);
    now = 61_000;
    expect(rl.check('U1')).toBe(true);
  });
  it('enforces daily cap', () => {
    let now = 0;
    const rl = makeRateLimiter({ perMinute: 1000, perDay: 2, now: () => now });
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

```ts
type Bucket = { minuteStart: number; minuteCount: number; dayStart: number; dayCount: number };

export function makeRateLimiter(opts: { perMinute: number; perDay: number; now?: () => number }) {
  const buckets = new Map<string, Bucket>();
  const now = opts.now ?? Date.now;
  return {
    check(userId: string): boolean {
      const t = now();
      const b = buckets.get(userId) ?? { minuteStart: t, minuteCount: 0, dayStart: t, dayCount: 0 };
      if (t - b.minuteStart >= 60_000) { b.minuteStart = t; b.minuteCount = 0; }
      if (t - b.dayStart >= 86_400_000) { b.dayStart = t; b.dayCount = 0; }
      if (b.minuteCount >= opts.perMinute) { buckets.set(userId, b); return false; }
      if (b.dayCount >= opts.perDay) { buckets.set(userId, b); return false; }
      b.minuteCount++; b.dayCount++;
      buckets.set(userId, b);
      return true;
    },
  };
}
```

- [ ] **Step 3: Wire into dispatcher** — fail closed: if `rl.check(userId)` returns false, reply once with `t('msg.rateLimited', lang)` and return.

- [ ] **Step 4: Pass + commit**

```
npx vitest run tests/line/rate-limit.test.ts
git add src/server/line/rate-limit.ts tests/line/rate-limit.test.ts src/server/line/dispatcher.ts
git commit -m "feat(line): per-user rate limit (perMinute/perDay) with dispatcher integration"
```

## Task 7.3: Webhook event-id de-dup

**Files:**
- Create: `src/server/line/event-dedupe.ts`
- Test: `tests/line/event-dedupe.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeEventDedupe } from '../../src/server/line/event-dedupe';

describe('event-dedupe LRU', () => {
  it('returns false for first occurrence and true for repeat', () => {
    const d = makeEventDedupe(3);
    expect(d.seen('e1')).toBe(false);
    expect(d.seen('e1')).toBe(true);
  });
  it('evicts oldest at capacity', () => {
    const d = makeEventDedupe(2);
    d.seen('e1'); d.seen('e2'); d.seen('e3');
    expect(d.seen('e1')).toBe(false);   // evicted, treated as new again
  });
});
```

- [ ] **Step 2: Implement**

```ts
export function makeEventDedupe(capacity: number) {
  const seen = new Set<string>();
  const order: string[] = [];
  return {
    seen(id: string): boolean {
      if (seen.has(id)) return true;
      seen.add(id); order.push(id);
      if (order.length > capacity) {
        const drop = order.shift()!;
        seen.delete(drop);
      }
      return false;
    },
  };
}
```

- [ ] **Step 3: Wire into dispatcher** — at top of dispatch loop, skip events whose `webhookEventId` was already seen.

- [ ] **Step 4: Pass + commit**

```
npx vitest run tests/line/event-dedupe.test.ts
git add src/server/line/event-dedupe.ts tests/line/event-dedupe.test.ts src/server/line/dispatcher.ts
git commit -m "feat(line): webhook event-id LRU de-dup (capacity 1000)"
```

## Task 7.4: Demo banner prefix in `LineClient`

**Files:**
- Modify: `src/server/line/line-client.ts`
- Test: extend `tests/line/line-client.test.ts`

- [ ] **Step 1: Failing test**

```ts
it('prefixes [DEMO] when banner enabled', async () => {
  const { LineClient } = await import('../../src/server/line/line-client');
  const c = new LineClient({ channelAccessToken:'t', channelSecret:'s', demoBanner: true });
  await c.reply('rt', { type:'text', text:'hello' });
  expect(replyMessage).toHaveBeenCalledWith('rt', expect.objectContaining({ text: expect.stringContaining('[DEMO]') }));
});

it('prefixes altText for flex when banner enabled', async () => {
  const { LineClient } = await import('../../src/server/line/line-client');
  const c = new LineClient({ channelAccessToken:'t', channelSecret:'s', demoBanner: true });
  await c.reply('rt', { type:'flex', altText:'card', contents:{} });
  expect(replyMessage).toHaveBeenCalledWith('rt', expect.objectContaining({ altText: expect.stringContaining('[DEMO]') }));
});
```

- [ ] **Step 2: Modify `LineClient`**

Add `demoBanner?: boolean` to `LineClientOpts`. In both `reply` and `push` and `replyOrPush`, before sending, run `applyBanner(msg, this.opts.demoBanner)`:

```ts
function applyBanner(msg: any, on?: boolean): any {
  if (!on || !msg) return msg;
  const stamp = '🧪 [DEMO] ';
  if (Array.isArray(msg)) return msg.map(m => applyBanner(m, on));
  if (msg.type === 'text' && typeof msg.text === 'string' && !msg.text.startsWith(stamp))
    return { ...msg, text: stamp + msg.text };
  if (msg.type === 'flex' && typeof msg.altText === 'string' && !msg.altText.startsWith(stamp))
    return { ...msg, altText: stamp + msg.altText };
  return msg;
}
```

Wire `demoBanner` in `getDefaultDispatchDeps()`:

```ts
demoBanner: process.env.DEPLOY_PROFILE === 'demo' && (process.env.DEMO_BANNER ?? 'true') !== 'false'
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/line-client.test.ts
git add src/server/line/line-client.ts src/server/line/dispatcher.ts tests/line/line-client.test.ts
git commit -m "feat(line): demo banner [DEMO] prefix on text + flex altText"
```

## Task 7.5: Phase 7 wrap

- [ ] **Step 1: Run all tests + type-check**
- [ ] **Step 2: Manual smoke** — verify `[DEMO]` shows up; rate limit triggers after spamming
- [ ] **Step 3: Push** — `git push origin main`

---

# PHASE 8 — Render Deployment + cron-job.org + Smoke + Ops Docs

## Task 8.1: Write `render.yaml`

**Files:**
- Create: `render.yaml`

- [ ] **Step 1: Write file**

```yaml
services:
  - type: web
    name: mai-touch-demo
    runtime: node
    plan: free
    region: singapore
    branch: main
    buildCommand: npm ci && npm run db:init:demo
    startCommand: npm run server
    envVars:
      - key: DEPLOY_PROFILE
        value: demo
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: DB_TYPE
        value: sqlite
      - key: SQLITE_FILENAME
        value: /var/data/mai-touch-demo.db
      - key: LINE_CHANNEL_SECRET
        sync: false
      - key: LINE_CHANNEL_ACCESS_TOKEN
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: OPENAI_MODEL
        value: gpt-4o-mini
      - key: BASE_URL
        value: https://mai-touch-demo.onrender.com
      - key: DEMO_ADMIN_LINE_USERS
        sync: false
    disk:
      name: demo-data
      mountPath: /var/data
      sizeGB: 1
    healthCheckPath: /health
```

- [ ] **Step 2: Commit**

```
git add render.yaml
git commit -m "chore(deploy): add render.yaml for mai-touch-demo (free plan + persistent disk)"
```

## Task 8.2: Write `docs/LINE_INTEGRATION.md` operator guide

**Files:**
- Create: `docs/LINE_INTEGRATION.md`

- [ ] **Step 1: Write the guide** covering:
  1. LINE Developer Console setup (8 steps from spec §5.5)
  2. Render setup (connect repo, ensure `render.yaml` picked up, set the 3 secret env vars: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `OPENAI_API_KEY`, `DEMO_ADMIN_LINE_USERS`)
  3. cron-job.org setup (URL `https://mai-touch-demo.onrender.com/health`, every 14 min, email `ydw331@gmail.com` on failure)
  4. Bot first-time bootstrap: send `/whoami` to discover your LINE userId, paste into Render `DEMO_ADMIN_LINE_USERS`, redeploy, then send `/role admin` and `/demo reset` to confirm admin path works
  5. Demo presentation playbook: `/demo list` → `/demo facility` → wait for confirmation → done; how to reset between presentations
  6. Troubleshooting: webhook 401 (wrong secret), no reply (cold start, wait or check Render logs), `[DEMO]` prefix missing (`DEMO_BANNER=false` in env)

- [ ] **Step 2: Commit**

```
git add docs/LINE_INTEGRATION.md
git commit -m "docs(line): add operator guide for LINE channel + Render + cron + demo playbook"
```

## Task 8.3: Update `README.md` with LINE demo pointer

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a new section** at the end of the existing README:

```markdown

## 🤖 LINE Demo (Cloud)

A publicly-reachable demo on LINE Official Account is available — see `docs/LINE_INTEGRATION.md` for setup, presentation playbook, and troubleshooting.

- Live URL: `https://mai-touch-demo.onrender.com`
- Health: `/health`
- Webhook: `/line/webhook`
- Profile switch: `DEPLOY_PROFILE=demo` (OpenAI-only) or `=prod` (NLP service)
```

- [ ] **Step 2: Commit**

```
git add README.md
git commit -m "docs(readme): link to LINE demo operator guide"
```

## Task 8.4: First Render deploy + smoke + cron registration

> Manual one-time work — record outcomes in scratch only, do not commit personal credentials or screenshots.

- [ ] **Step 1: In Render dashboard** — New → Blueprint → connect this repo → Render reads `render.yaml` and creates `mai-touch-demo` service
- [ ] **Step 2: Set the four secret env vars** in Render dashboard: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `OPENAI_API_KEY`, `DEMO_ADMIN_LINE_USERS=` (leave empty for now; fill after step 5)
- [ ] **Step 3: Trigger first deploy** — wait for green
- [ ] **Step 4: `curl https://mai-touch-demo.onrender.com/health`** → expect `{ok:true,profile:"demo"}`
- [ ] **Step 5: In LINE Developer Console** — set webhook URL to `https://mai-touch-demo.onrender.com/line/webhook`, click Verify, expect green
- [ ] **Step 6: Add the bot as friend** on your phone, send `/whoami` → bot replies with your LINE userId prefix → search Render logs for the full userId → paste it into Render env `DEMO_ADMIN_LINE_USERS` → redeploy
- [ ] **Step 7: Send `/role admin`** → expect `role => admin`
- [ ] **Step 8: Send `/demo facility`** → expect end-to-end walkthrough plays out
- [ ] **Step 9: cron-job.org** — register, create job hitting `https://mai-touch-demo.onrender.com/health` every 14 min, set failure notification email
- [ ] **Step 10: Wait 20 min, refresh cron-job.org dashboard** — verify successful pings logged

## Task 8.5: Phase 8 wrap + tag

- [ ] **Step 1: Tag the release**

```
git tag -a v0.1.0-demo -m "LINE demo MVP shipped"
git push origin v0.1.0-demo
```

---

# PHASE 9 — Admin Dashboard (DB 007 + runtime-config + tRPC + 6 web pages)

## Task 9.1: Migration 007 — `runtime_config` + `demo_script_config`

**Files:**
- Create: `migrations/sqlite/007_runtime_config_and_demo_scripts.sql`

- [ ] **Step 1: Write SQL** (per spec §10.3)

```sql
CREATE TABLE IF NOT EXISTS runtime_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  type        TEXT NOT NULL,
  description TEXT,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by  TEXT
);

CREATE TABLE IF NOT EXISTS demo_script_config (
  id          TEXT PRIMARY KEY,
  enabled     INTEGER NOT NULL DEFAULT 1,
  steps_json  TEXT,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO runtime_config (key, value, type, description) VALUES
  ('line.rateLimit.perMinute',  '10',            'number', 'Per-LINE-user messages allowed per minute'),
  ('line.rateLimit.perDay',     '200',           'number', 'Per-LINE-user messages allowed per day'),
  ('ai.openai.model',           '"gpt-4o-mini"', 'string', 'OpenAI model for intent classification'),
  ('ai.openai.temperature',     '0.1',           'number', 'OpenAI temperature'),
  ('ai.confidenceThreshold',    '0.6',           'number', 'Below this triggers clarification'),
  ('demo.bannerEnabled',        'true',          'bool',   'Prefix bot replies with 🧪 [DEMO]'),
  ('demo.adminLineUserIds',     '[]',            'json',   'LINE user IDs allowed /role admin and /demo reset');

INSERT OR IGNORE INTO demo_script_config (id, enabled) VALUES
  ('facility', 1), ('repair', 1), ('visitor', 1), ('complaint', 1);
```

- [ ] **Step 2: Run migration locally + commit**

```
npm run db:migrate
git add migrations/sqlite/007_runtime_config_and_demo_scripts.sql
git commit -m "feat(db): runtime_config + demo_script_config (migration 007) with seed defaults"
```

## Task 9.2: `runtime-config.ts` cache

**Files:**
- Create: `src/server/line/runtime-config.ts`
- Test: `tests/line/runtime-config.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import { makeRuntimeConfig } from '../../src/server/line/runtime-config';

const SQL = fs.readFileSync('migrations/sqlite/007_runtime_config_and_demo_scripts.sql', 'utf8');

let db: Database.Database;
let cfg: ReturnType<typeof makeRuntimeConfig>;

beforeEach(() => {
  db = new Database(':memory:');
  for (const stmt of SQL.split(';').map(s=>s.trim()).filter(Boolean)) db.prepare(stmt).run();
  cfg = makeRuntimeConfig(db);
});

describe('runtime-config', () => {
  it('reads seeded value', async () => {
    await cfg.load();
    expect(cfg.get<number>('line.rateLimit.perMinute', 999)).toBe(10);
  });
  it('set updates DB and invalidates cache', async () => {
    await cfg.load();
    await cfg.set('line.rateLimit.perMinute', 50, 'admin@x');
    expect(cfg.get<number>('line.rateLimit.perMinute', 999)).toBe(50);
  });
  it('falls back when key missing', async () => {
    await cfg.load();
    expect(cfg.get<string>('nope', 'default')).toBe('default');
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type Database from 'better-sqlite3';

export function makeRuntimeConfig(db: Database.Database) {
  let cache: Record<string, unknown> | null = null;

  const selectAll = db.prepare(`SELECT key, value FROM runtime_config`);
  const upsert = db.prepare(`
    INSERT INTO runtime_config (key, value, type, description, updated_by, updated_at)
    VALUES (?, ?, COALESCE((SELECT type FROM runtime_config WHERE key=?), 'json'),
            (SELECT description FROM runtime_config WHERE key=?), ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_by=excluded.updated_by,
                                   updated_at=CURRENT_TIMESTAMP
  `);

  return {
    async load() {
      const rows = selectAll.all() as Array<{key:string; value:string}>;
      cache = Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.value)]));
    },
    get<T>(key: string, fallback: T): T {
      if (!cache) throw new Error('runtime-config: load() first');
      return (cache[key] as T) ?? fallback;
    },
    async set(key: string, value: unknown, updatedBy: string) {
      upsert.run(key, JSON.stringify(value), key, key, updatedBy);
      cache = null;
      await this.load();
    },
    invalidate() { cache = null; },
    snapshot(): Record<string, unknown> { return { ...(cache ?? {}) }; },
  };
}
```

- [ ] **Step 3: Refactor consumers** — change rate limiter, OpenAI model, demo banner, admin whitelist to read from `runtimeConfig.get(...)` instead of `process.env`. Env values become only first-deploy seeds.

- [ ] **Step 4: Pass + commit**

```
npx vitest run tests/line/runtime-config.test.ts
git add src/server/line/runtime-config.ts src/server/line/dispatcher.ts src/server/line/line-client.ts src/server/line/rate-limit.ts tests/line/runtime-config.test.ts
git commit -m "feat(line): runtime-config cache with hot-reload + replace env reads"
```

## Task 9.3: `lineAdminRouter.ts` tRPC procedures (logs/config/scripts/users/health/manualPush)

**Files:**
- Create: `src/server/routers/lineAdminRouter.ts`
- Modify: `src/server/routers/index.ts` (mount the router)
- Test: `tests/line/lineAdminRouter.test.ts`

- [ ] **Step 1: Add `adminProcedure` to `_core/trpc.ts`** if not already there

```ts
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== 'admin') throw new TRPCError({ code:'FORBIDDEN', message:'admin only' });
  return next({ ctx });
});
```

- [ ] **Step 2: Failing test (router shape only — full functional tests can come later)**

```ts
import { describe, it, expect } from 'vitest';
import { lineAdminRouter } from '../../src/server/routers/lineAdminRouter';

describe('lineAdminRouter shape', () => {
  it('has expected procedures', () => {
    const proc = lineAdminRouter._def.procedures as any;
    for (const p of ['logsList','configList','configSet','scriptsList','scriptsSetEnabled',
                     'scriptsSetSteps','usersList','usersSetRole','usersPurgeDemo','health','manualPush']) {
      expect(proc[p], `missing ${p}`).toBeDefined();
    }
  });
});
```

- [ ] **Step 3: Implement router** (skeleton — wire to db + runtime-config + lineUserRepo + lineClient)

```ts
import { z } from 'zod';
import { router, adminProcedure } from '../_core/trpc';

export const lineAdminRouter = router({
  logsList: adminProcedure.input(z.object({
    limit: z.number().min(1).max(200).default(100),
    cursor: z.number().optional(),
    intent: z.string().optional(),
    direction: z.enum(['inbound','outbound','outbound:debug']).optional(),
    lineUserId: z.string().optional(),
  })).query(async ({ ctx, input }) => {
    // SELECT FROM line_message_log WHERE ... LIMIT input.limit OFFSET input.cursor
    return { items: [], nextCursor: undefined as number | undefined };
  }),

  configList: adminProcedure.query(async ({ ctx }) => {
    // SELECT * FROM runtime_config
    return [] as Array<{key:string; value:unknown; type:string; description:string|null; updatedAt:string; updatedBy:string|null}>;
  }),

  configSet: adminProcedure.input(z.object({
    key: z.string(),
    value: z.unknown(),
  })).mutation(async ({ ctx, input }) => {
    // validate per-key zod schemas (perMinute > 0 && < 1000, etc.) before writing
    // ctx.runtimeConfig.set(input.key, input.value, ctx.user.email)
    return { ok: true };
  }),

  scriptsList: adminProcedure.query(async () => [] as Array<{id:string; enabled:boolean}>),
  scriptsSetEnabled: adminProcedure.input(z.object({ id: z.string(), enabled: z.boolean() })).mutation(async () => ({ ok: true })),
  scriptsSetSteps:   adminProcedure.input(z.object({ id: z.string(), steps: z.array(z.unknown()) })).mutation(async () => ({ ok: true })),

  usersList: adminProcedure.query(async () => [] as any[]),
  usersSetRole: adminProcedure.input(z.object({ lineUserId: z.string(), role: z.enum(['resident','housekeeper','admin']) })).mutation(async () => ({ ok: true })),
  usersPurgeDemo: adminProcedure.mutation(async () => ({ deleted: 0 })),

  health: adminProcedure.query(async () => ({
    todayCount: 0, openaiTokensToday: 0, avgLatencyMs: 0, errorRate: 0,
  })),

  manualPush: adminProcedure.input(z.object({
    lineUserId: z.string(),
    text: z.string().min(1).max(500),
  })).mutation(async () => ({ ok: true })),
});
```

- [ ] **Step 4: Implement each procedure body** — fill in real DB queries and runtime-config calls. Each should be its own follow-up commit if size warrants.

- [ ] **Step 5: Mount in `src/server/routers/index.ts`**

```ts
import { lineAdminRouter } from './lineAdminRouter';

export const appRouter = router({
  // ... existing routers ...
  lineAdmin: lineAdminRouter,
});
```

- [ ] **Step 6: Pass + commit**

```
npx vitest run tests/line/lineAdminRouter.test.ts
npm run type-check
git add src/server/_core/trpc.ts src/server/routers/lineAdminRouter.ts src/server/routers/index.ts tests/line/lineAdminRouter.test.ts
git commit -m "feat(admin): lineAdminRouter with logs/config/scripts/users/health/manualPush"
```

## Task 9.4: Web — `src/app/admin/line/_layout.tsx` + role guard

**Files:**
- Create: `src/app/admin/line/_layout.tsx`

- [ ] **Step 1: Implement layout with auth guard**

```tsx
import { Redirect, Slot } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { View, Text } from 'react-native';

export default function AdminLineLayout() {
  const { user, loading } = useAuth();
  if (loading) return <View><Text>Loading...</Text></View>;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'admin') return <View><Text>Forbidden — admin only</Text></View>;
  return <Slot />;
}
```

- [ ] **Step 2: Commit**

```
git add src/app/admin/line/_layout.tsx
git commit -m "feat(admin/web): line admin layout with role guard"
```

## Task 9.5: Web page A1 — `/admin/line/logs`

**Files:**
- Create: `src/app/admin/line/logs.tsx`

- [ ] **Step 1: Implement** — table with filters (intent, direction, lineUserId), polling every 5s via `useQuery({ refetchInterval: 5000 })`

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { trpc } from '@/lib/trpc';

export default function LogsPage() {
  const [filter, setFilter] = useState({ intent: '', direction: '', lineUserId: '' });
  const q = trpc.lineAdmin.logsList.useQuery(
    { limit: 100, ...stripEmpty(filter) },
    { refetchInterval: 5000 }
  );
  return (
    <ScrollView>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>LINE Message Log</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput placeholder="intent" value={filter.intent} onChangeText={t => setFilter(f => ({...f, intent:t}))} />
        <TextInput placeholder="direction" value={filter.direction} onChangeText={t => setFilter(f => ({...f, direction:t}))} />
        <TextInput placeholder="lineUserId" value={filter.lineUserId} onChangeText={t => setFilter(f => ({...f, lineUserId:t}))} />
      </View>
      {q.data?.items.map((row: any) => (
        <View key={row.id} style={{ padding: 8, borderBottomWidth: 1, borderColor: '#333' }}>
          <Text style={{ color:'#888' }}>{row.createdAt} | {row.direction} | {row.intent ?? '-'}</Text>
          <Text>{row.lineUserId.slice(0,8)}: {row.content?.slice(0,200) ?? ''}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
const stripEmpty = (o: any) => Object.fromEntries(Object.entries(o).filter(([_,v]) => v));
```

- [ ] **Step 2: Commit**

```
git add src/app/admin/line/logs.tsx
git commit -m "feat(admin/web): logs page with filters and 5s polling"
```

## Task 9.6: Web page A2 — `/admin/line/config`

**Files:**
- Create: `src/app/admin/line/config.tsx`

- [ ] **Step 1: Implement** — list of config keys with inline edit + save mutation; on success invalidate the query so the list refreshes

- [ ] **Step 2: Commit**

```
git add src/app/admin/line/config.tsx
git commit -m "feat(admin/web): config page with inline edit + hot-reload"
```

## Task 9.7: Web pages A3 / A4 / A5 / A6

**Files:**
- Create: `src/app/admin/line/scripts.tsx`, `users.tsx`, `health.tsx`, `push.tsx`

- [ ] **Step 1: scripts.tsx** — list 4 scripts, enable toggle (mutation `scriptsSetEnabled`), expandable JSON editor (lazy import monaco-react only on this page)
- [ ] **Step 2: users.tsx** — table of `line_user`, role dropdown (mutation `usersSetRole`), "Purge demo users" button (confirm dialog → `usersPurgeDemo`)
- [ ] **Step 3: health.tsx** — read-only metrics grid backed by `lineAdmin.health` query, refetch every 30s
- [ ] **Step 4: push.tsx** — form (lineUserId selector + text input), submit triggers `manualPush` mutation, show toast result
- [ ] **Step 5: Commit each**

```
git add src/app/admin/line/scripts.tsx src/app/admin/line/users.tsx src/app/admin/line/health.tsx src/app/admin/line/push.tsx
git commit -m "feat(admin/web): scripts/users/health/push pages"
```

## Task 9.8: Add nav link from existing admin index

**Files:**
- Modify: `src/app/admin/index.tsx` (or wherever the existing admin landing is — locate via Read tool first)

- [ ] **Step 1: Add a card / link to `/admin/line/logs`** matching the existing visual style
- [ ] **Step 2: Commit**

```
git add src/app/admin/index.tsx
git commit -m "feat(admin/web): nav link to LINE admin dashboard"
```

## Task 9.9: Phase 9 wrap

- [ ] **Step 1: All tests + type-check + manual smoke** — log into demo as `admin@demo.local` (default password from README), navigate to `/admin/line/logs`, send a few LINE messages, verify they appear; change `line.rateLimit.perMinute` to `1`, send 2 LINE messages, verify second is rate-limited
- [ ] **Step 2: Push + tag**

```
git push origin main
git tag -a v0.2.0-demo -m "LINE demo + admin dashboard shipped"
git push origin v0.2.0-demo
```

---

## Verification Final Checklist

Before declaring done, walk through this list:

- [ ] `/health` returns `profile=demo, ai_provider=openai`
- [ ] LINE bot replies to `/help` with command list
- [ ] `/role housekeeper` then a real workorder push from another phone is received
- [ ] `/demo facility` runs end-to-end (carousel → time → confirm → done → simulated housekeeper card)
- [ ] `/lang en` switches reply language; AI auto-detect still works for next utterance
- [ ] Send 11 messages in a minute → 11th replies "demo rate limit reached"
- [ ] Change `line.rateLimit.perMinute=20` in dashboard → 11th allowed within minute
- [ ] `/demo reset` (as admin) wipes work_orders and seeded users
- [ ] cron-job.org log shows 4+ green pings in past hour
- [ ] All bot text + flex altText prefixed `🧪 [DEMO]`
- [ ] Render log shows zero unhandled exceptions over 24-hour window
- [ ] `npm run type-check && npm run test` green on `main`

---

**End of plan.** Total: ~60 tasks across 10 phases (0-9). Estimated calendar time at one engineer in steady focus: 2-3 weeks. Demo profile ready to ship after Phase 8; dashboard (Phase 9) can be staged in parallel by a second engineer if available.
