# LINE 互動 Demo Implementation Plan (Part 2: Phases 4-6)

> Continues from `2026-05-01-line-online-demo-plan.md`. Same conventions: TDD, exact file paths, commit per task.

---

# PHASE 4 — Sessions, Flex Builders, Resident Slot-Filling

Phase 4 is split into:
- **4A** infrastructure (sessions, postback, line_user repo, lineMessageLog logger)
- **4B** Flex builders (i18n + 7 templates)
- **4C** resident handler (state machine, integrates 4A + 4B)

## Task 4A.1: `session-store.ts` with TTL

**Files:**
- Create: `src/server/line/session-store.ts`
- Test: `tests/line/session-store.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { SessionStore } from '../../src/server/line/session-store';

describe('SessionStore', () => {
  const base = { userId:'U1', role:'resident' as const, step:'IDLE' as const,
                 slots:{}, missingSlots:[], language:'zh-TW' as const, updatedAt: 0 };

  it('stores and retrieves a session', () => {
    const s = new SessionStore({ ttlMs: 1000 });
    s.set('U1', base);
    expect(s.get('U1')?.step).toBe('IDLE');
  });

  it('evicts after TTL', () => {
    let now = 0;
    const s = new SessionStore({ ttlMs: 1, now: () => now });
    s.set('U1', { ...base, updatedAt: now });
    now = 100;
    s.evictExpired();
    expect(s.get('U1')).toBeUndefined();
  });

  it('clear removes a session', () => {
    const s = new SessionStore({ ttlMs: 1000 });
    s.set('U1', base);
    s.clear('U1');
    expect(s.get('U1')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { Lang, IntentName } from './ai/types';

export type SessionStep = 'IDLE'|'CLASSIFYING'|'SLOT_FILLING'|'CONFIRMING'|'EXECUTING';

export type SessionState = {
  userId: string;
  role: 'resident' | 'housekeeper' | 'admin';
  step: SessionStep;
  intent?: IntentName;
  slots: Record<string, unknown>;
  missingSlots: string[];
  language: Lang;
  updatedAt: number;
  history?: string[];
  demoScriptId?: string;
  demoStep?: number;
};

export class SessionStore {
  private map = new Map<string, SessionState>();
  private ttlMs: number;
  private now: () => number;

  constructor(opts: { ttlMs?: number; now?: () => number } = {}) {
    this.ttlMs = opts.ttlMs ?? 30 * 60 * 1000;
    this.now = opts.now ?? Date.now;
  }

  get(userId: string): SessionState | undefined { return this.map.get(userId); }
  set(userId: string, state: SessionState): void {
    this.map.set(userId, { ...state, updatedAt: this.now() });
  }
  clear(userId: string): void { this.map.delete(userId); }

  evictExpired(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [k, v] of this.map.entries()) {
      if (v.updatedAt < cutoff) this.map.delete(k);
    }
  }

  size(): number { return this.map.size; }
}

export const sessionStore = new SessionStore();
```

- [ ] **Step 3: Run pass + commit**

```
npx vitest run tests/line/session-store.test.ts
git add src/server/line/session-store.ts tests/line/session-store.test.ts
git commit -m "feat(line): add in-memory SessionStore with TTL eviction"
```

## Task 4A.2: `parsePostback` helper

**Files:**
- Create: `src/server/line/postback.ts`
- Test: `tests/line/postback.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parsePostback } from '../../src/server/line/postback';

describe('parsePostback', () => {
  it('parses act+slot+val', () => {
    expect(parsePostback('act=book&fac=gym')).toEqual({ act:'book', fac:'gym' });
  });
  it('returns empty object on empty data', () => {
    expect(parsePostback('')).toEqual({});
  });
  it('decodes URL-encoded values', () => {
    expect(parsePostback('issue=' + encodeURIComponent('水龍頭壞了'))).toEqual({ issue: '水龍頭壞了' });
  });
  it('rejects oversized data (>300 chars)', () => {
    expect(parsePostback('k=' + 'x'.repeat(2000))).toEqual({});
  });
});
```

- [ ] **Step 2: Implement**

```ts
export function parsePostback(data: string): Record<string, string> {
  if (!data) return {};
  if (data.length > 300) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(data)) out[k] = v;
  return out;
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/postback.test.ts
git add src/server/line/postback.ts tests/line/postback.test.ts
git commit -m "feat(line): add parsePostback with size cap"
```

## Task 4A.3: `line_user` repository

**Files:**
- Create: `src/server/line/line-user-repo.ts`
- Test: `tests/line/line-user-repo.test.ts`

- [ ] **Step 1: Failing test (in-memory better-sqlite3 + migration 006 SQL)**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { makeLineUserRepo } from '../../src/server/line/line-user-repo';

const SQL = fs.readFileSync(path.join(process.cwd(), 'migrations/sqlite/006_line_integration.sql'), 'utf8');

let db: Database.Database;
let repo: ReturnType<typeof makeLineUserRepo>;

beforeEach(() => {
  db = new Database(':memory:');
  db.prepare('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, role TEXT)').run();
  // run migration 006 SQL via the better-sqlite3 multi-statement API
  for (const stmt of SQL.split(';').map(s => s.trim()).filter(Boolean)) db.prepare(stmt).run();
  repo = makeLineUserRepo(db);
});

describe('lineUserRepo', () => {
  it('upserts and reads back', () => {
    repo.upsert({ channelId:'C', lineUserId:'U1', displayName:'Bob' });
    const u = repo.byLineId('C', 'U1');
    expect(u?.displayName).toBe('Bob');
    expect(u?.role).toBe('resident');
  });
  it('updates role', () => {
    repo.upsert({ channelId:'C', lineUserId:'U1' });
    repo.setRole('C', 'U1', 'housekeeper');
    expect(repo.byLineId('C','U1')?.role).toBe('housekeeper');
  });
  it('lists by role', () => {
    repo.upsert({ channelId:'C', lineUserId:'U1', role:'housekeeper' });
    repo.upsert({ channelId:'C', lineUserId:'U2', role:'housekeeper' });
    repo.upsert({ channelId:'C', lineUserId:'U3', role:'resident' });
    expect(repo.listByRole('C','housekeeper').map(u=>u.lineUserId).sort()).toEqual(['U1','U2']);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type Database from 'better-sqlite3';

export type LineUserRow = {
  id: number; channelId: string; lineUserId: string; appUserId: number | null;
  role: 'resident'|'housekeeper'|'admin'; displayName: string | null;
  pictureUrl: string | null; language: 'zh-TW'|'en'|'ja' | null; isDemo: number;
};

export function makeLineUserRepo(db: Database.Database) {
  const upsertStmt = db.prepare(`
    INSERT INTO line_user (channel_id, line_user_id, display_name, picture_url, role, language, is_demo)
    VALUES (@channelId, @lineUserId, @displayName, @pictureUrl, @role, @language, @isDemo)
    ON CONFLICT(channel_id, line_user_id) DO UPDATE SET
      display_name=COALESCE(excluded.display_name, line_user.display_name),
      picture_url =COALESCE(excluded.picture_url,  line_user.picture_url),
      updated_at=CURRENT_TIMESTAMP
  `);
  const byLineStmt = db.prepare(`SELECT id, channel_id as channelId, line_user_id as lineUserId,
      app_user_id as appUserId, role, display_name as displayName, picture_url as pictureUrl,
      language, is_demo as isDemo FROM line_user WHERE channel_id=? AND line_user_id=?`);
  const setRoleStmt = db.prepare(`UPDATE line_user SET role=?, updated_at=CURRENT_TIMESTAMP
                                  WHERE channel_id=? AND line_user_id=?`);
  const setLangStmt = db.prepare(`UPDATE line_user SET language=?, updated_at=CURRENT_TIMESTAMP
                                  WHERE channel_id=? AND line_user_id=?`);
  const listByRoleStmt = db.prepare(`SELECT id, channel_id as channelId, line_user_id as lineUserId,
      app_user_id as appUserId, role, display_name as displayName, picture_url as pictureUrl,
      language, is_demo as isDemo FROM line_user WHERE channel_id=? AND role=?`);

  return {
    upsert(input: { channelId: string; lineUserId: string; displayName?: string|null;
                    pictureUrl?: string|null; role?: 'resident'|'housekeeper'|'admin';
                    language?: 'zh-TW'|'en'|'ja'; isDemo?: 0|1 }) {
      upsertStmt.run({
        channelId: input.channelId, lineUserId: input.lineUserId,
        displayName: input.displayName ?? null, pictureUrl: input.pictureUrl ?? null,
        role: input.role ?? 'resident', language: input.language ?? 'zh-TW',
        isDemo: input.isDemo ?? 0,
      });
    },
    byLineId(channelId: string, lineUserId: string): LineUserRow | undefined {
      return byLineStmt.get(channelId, lineUserId) as LineUserRow | undefined;
    },
    setRole(channelId: string, lineUserId: string, role: 'resident'|'housekeeper'|'admin') {
      setRoleStmt.run(role, channelId, lineUserId);
    },
    setLanguage(channelId: string, lineUserId: string, language: 'zh-TW'|'en'|'ja') {
      setLangStmt.run(language, channelId, lineUserId);
    },
    listByRole(channelId: string, role: 'resident'|'housekeeper'|'admin'): LineUserRow[] {
      return listByRoleStmt.all(channelId, role) as LineUserRow[];
    },
  };
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/line-user-repo.test.ts
git add src/server/line/line-user-repo.ts tests/line/line-user-repo.test.ts
git commit -m "feat(line): add line_user repository (upsert, byLineId, setRole, setLanguage, listByRole)"
```

## Task 4A.4: `message-log.ts` writer

**Files:**
- Create: `src/server/line/message-log.ts`
- Test: `tests/line/message-log.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { makeMessageLog } from '../../src/server/line/message-log';

const SQL = fs.readFileSync('migrations/sqlite/006_line_integration.sql', 'utf8');

let db: Database.Database;
let log: ReturnType<typeof makeMessageLog>;

beforeEach(() => {
  db = new Database(':memory:');
  for (const stmt of SQL.split(';').map(s=>s.trim()).filter(Boolean)) db.prepare(stmt).run();
  log = makeMessageLog(db);
});

describe('message-log', () => {
  it('writes inbound text and reads back', () => {
    log.write({ lineUserId:'U1', direction:'inbound', messageType:'text',
                content:'hi', intent:'small_talk' });
    const rows = db.prepare('SELECT * FROM line_message_log').all() as any[];
    expect(rows[0].direction).toBe('inbound');
    expect(rows[0].intent).toBe('small_talk');
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type Database from 'better-sqlite3';

export function makeMessageLog(db: Database.Database) {
  const ins = db.prepare(`INSERT INTO line_message_log
    (line_user_id, direction, message_type, content, intent, session_id)
    VALUES (?, ?, ?, ?, ?, ?)`);
  return {
    write(e: { lineUserId: string; direction: 'inbound'|'outbound'|'outbound:debug';
               messageType: string; content?: unknown; intent?: string; sessionId?: string }) {
      const c = e.content == null ? null : (typeof e.content === 'string' ? e.content : JSON.stringify(e.content));
      ins.run(e.lineUserId, e.direction, e.messageType, c, e.intent ?? null, e.sessionId ?? null);
    },
  };
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/message-log.test.ts
git add src/server/line/message-log.ts tests/line/message-log.test.ts
git commit -m "feat(line): add line_message_log writer"
```

## Task 4B.1: `flex/i18n.ts` dictionary + `t()` helper

**Files:**
- Create: `src/server/line/flex/i18n.ts`
- Test: `tests/line/flex-i18n.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { t } from '../../src/server/line/flex/i18n';

describe('i18n t()', () => {
  it('returns zh-TW by default', () => {
    expect(t('booking.confirm.title', 'zh-TW')).toBe('預約確認');
  });
  it('returns english', () => {
    expect(t('booking.confirm.title', 'en')).toBe('Booking confirmation');
  });
  it('falls back to zh-TW when key missing in lang', () => {
    expect(t('booking.confirm.title', 'ja')).toMatch(/予約確認|預約確認/);
  });
  it('returns key itself if completely missing (with warning)', () => {
    expect(t('totally.unknown.key' as any, 'zh-TW')).toBe('totally.unknown.key');
  });
});
```

- [ ] **Step 2: Implement (covers all keys we'll use across templates)**

```ts
import type { Lang } from '../ai/types';

export type I18nKey =
  | 'booking.confirm.title' | 'booking.confirm.facility' | 'booking.confirm.date' | 'booking.confirm.time'
  | 'booking.btn.confirm' | 'booking.btn.edit' | 'booking.btn.cancel'
  | 'booking.done.title' | 'booking.done.orderNo' | 'booking.done.again'
  | 'facility.gym' | 'facility.pool' | 'facility.meeting_room' | 'facility.lounge' | 'facility.bbq' | 'facility.sauna'
  | 'welcome.title' | 'welcome.subtitle' | 'welcome.btn.start' | 'welcome.btn.demo'
  | 'workorder.new.title' | 'workorder.new.from' | 'workorder.new.btn.accept' | 'workorder.new.btn.reassign' | 'workorder.new.btn.reject'
  | 'workorder.status.title' | 'workorder.status.empty'
  | 'ask.facility' | 'ask.date' | 'ask.time' | 'ask.issue' | 'ask.location' | 'ask.urgency' | 'ask.visitor.name' | 'ask.visitor.count'
  | 'msg.smallTalk' | 'msg.unknown' | 'msg.busy' | 'msg.rateLimited' | 'msg.demoEnded' | 'msg.sessionReset';

const dict: Record<I18nKey, Record<Lang, string>> = {
  'booking.confirm.title':    { 'zh-TW':'預約確認', en:'Booking confirmation', ja:'予約確認' },
  'booking.confirm.facility': { 'zh-TW':'設施',     en:'Facility',             ja:'施設' },
  'booking.confirm.date':     { 'zh-TW':'日期',     en:'Date',                 ja:'日付' },
  'booking.confirm.time':     { 'zh-TW':'時段',     en:'Time',                 ja:'時間' },
  'booking.btn.confirm':      { 'zh-TW':'確認預約', en:'Confirm',              ja:'確認' },
  'booking.btn.edit':         { 'zh-TW':'修改',     en:'Edit',                 ja:'修正' },
  'booking.btn.cancel':       { 'zh-TW':'取消',     en:'Cancel',               ja:'キャンセル' },
  'booking.done.title':       { 'zh-TW':'預約成功', en:'Booked',               ja:'予約完了' },
  'booking.done.orderNo':     { 'zh-TW':'單號',     en:'Order',                ja:'注文番号' },
  'booking.done.again':       { 'zh-TW':'再預約一次', en:'Book again',         ja:'もう一度予約' },
  'facility.gym':             { 'zh-TW':'健身房',   en:'Gym',                  ja:'ジム' },
  'facility.pool':            { 'zh-TW':'游泳池',   en:'Pool',                 ja:'プール' },
  'facility.meeting_room':    { 'zh-TW':'會議室',   en:'Meeting room',         ja:'会議室' },
  'facility.lounge':          { 'zh-TW':'交誼廳',   en:'Lounge',               ja:'ラウンジ' },
  'facility.bbq':             { 'zh-TW':'BBQ 區',  en:'BBQ',                  ja:'BBQ' },
  'facility.sauna':           { 'zh-TW':'三溫暖',   en:'Sauna',                ja:'サウナ' },
  'welcome.title':            { 'zh-TW':'歡迎使用 m\'AI Touch', en:'Welcome to m\'AI Touch', ja:'m\'AI Touchへようこそ' },
  'welcome.subtitle':         { 'zh-TW':'AI 管家為您服務 24/7', en:'AI housekeeper at your service 24/7', ja:'AI執事が24時間対応' },
  'welcome.btn.start':        { 'zh-TW':'開始使用', en:'Get started',          ja:'はじめる' },
  'welcome.btn.demo':         { 'zh-TW':'觀看 Demo', en:'View demo',           ja:'デモを見る' },
  'workorder.new.title':      { 'zh-TW':'新工單',   en:'New work order',       ja:'新しい依頼' },
  'workorder.new.from':       { 'zh-TW':'住戶',     en:'Resident',             ja:'住人' },
  'workorder.new.btn.accept':   { 'zh-TW':'接單',   en:'Accept',               ja:'受ける' },
  'workorder.new.btn.reassign': { 'zh-TW':'轉派',   en:'Reassign',             ja:'転送' },
  'workorder.new.btn.reject':   { 'zh-TW':'拒絕',   en:'Reject',               ja:'拒否' },
  'workorder.status.title':   { 'zh-TW':'我的工單', en:'My work orders',       ja:'依頼一覧' },
  'workorder.status.empty':   { 'zh-TW':'目前沒有工單', en:'No active orders', ja:'依頼はありません' },
  'ask.facility':             { 'zh-TW':'要預約哪個設施?', en:'Which facility?', ja:'どの施設?' },
  'ask.date':                 { 'zh-TW':'哪一天?',   en:'Which date?',         ja:'いつ?' },
  'ask.time':                 { 'zh-TW':'幾點?',     en:'What time?',          ja:'何時?' },
  'ask.issue':                { 'zh-TW':'發生什麼問題?', en:'What\'s the issue?', ja:'何の問題?' },
  'ask.location':             { 'zh-TW':'在哪個位置?', en:'Where?',            ja:'場所は?' },
  'ask.urgency':              { 'zh-TW':'緊急程度?', en:'Urgency?',            ja:'緊急度?' },
  'ask.visitor.name':         { 'zh-TW':'訪客姓名?', en:'Visitor name?',       ja:'訪問者の名前?' },
  'ask.visitor.count':        { 'zh-TW':'幾位訪客?', en:'How many visitors?',  ja:'何人?' },
  'msg.smallTalk':            { 'zh-TW':'您好!有什麼可以為您服務?', en:'Hi! How can I help?', ja:'こんにちは!何かお手伝いできますか?' },
  'msg.unknown':              { 'zh-TW':'不太懂您的意思,可以再說一次嗎?', en:'Sorry, I didn\'t catch that.', ja:'すみません、もう一度お願いします。' },
  'msg.busy':                 { 'zh-TW':'系統忙碌,請稍候再試 🙏', en:'System busy, please try again 🙏', ja:'システムが混雑しています' },
  'msg.rateLimited':          { 'zh-TW':'已達 demo 用量上限,請稍後再試', en:'Demo rate limit reached', ja:'デモ利用上限に達しました' },
  'msg.demoEnded':            { 'zh-TW':'Demo 已終止',  en:'Demo ended',       ja:'デモ終了' },
  'msg.sessionReset':         { 'zh-TW':'對話已重置,請重新開始', en:'Session reset, please start over', ja:'セッションをリセットしました' },
};

export function t(key: I18nKey, lang: Lang): string {
  const entry = dict[key];
  if (!entry) { console.warn('[i18n] missing key', key); return key as string; }
  return entry[lang] ?? entry['zh-TW'];
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/flex-i18n.test.ts
git add src/server/line/flex/i18n.ts tests/line/flex-i18n.test.ts
git commit -m "feat(line/flex): add i18n dictionary covering all template strings"
```

## Task 4B.2: `flex/welcome.ts`

**Files:**
- Create: `src/server/line/flex/welcome.ts`
- Test: `tests/line/flex-welcome.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { welcome } from '../../src/server/line/flex/welcome';

describe('welcome flex', () => {
  it('returns flex with localized title', () => {
    const m = welcome('zh-TW');
    expect(m.type).toBe('flex');
    expect(m.altText).toContain('歡迎');
  });
  it('localizes to en', () => {
    expect(welcome('en').altText).toContain('Welcome');
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { Lang } from '../ai/types';
import { t } from './i18n';

export function welcome(lang: Lang) {
  return {
    type: 'flex',
    altText: t('welcome.title', lang),
    contents: {
      type: 'bubble', size: 'mega',
      header: { type:'box', layout:'vertical', backgroundColor:'#1a1a1a', paddingAll:'16px',
        contents: [
          { type:'text', text: t('welcome.title', lang), color:'#C9A96E', weight:'bold', size:'lg', wrap: true },
          { type:'text', text: t('welcome.subtitle', lang), color:'#999999', size:'sm', margin:'sm', wrap: true },
        ] },
      footer: { type:'box', layout:'horizontal', spacing:'sm',
        contents: [
          { type:'button', style:'primary', color:'#C9A96E',
            action:{ type:'message', label: t('welcome.btn.start', lang), text:'/help' } },
          { type:'button', style:'secondary',
            action:{ type:'message', label: t('welcome.btn.demo', lang), text:'/demo list' } },
        ] },
    },
  } as const;
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/flex-welcome.test.ts
git add src/server/line/flex/welcome.ts tests/line/flex-welcome.test.ts
git commit -m "feat(line/flex): add welcome flex builder"
```

## Task 4B.3: `flex/facilityCarousel.ts`

**Files:**
- Create: `src/server/line/flex/facilityCarousel.ts`
- Test: `tests/line/flex-facility-carousel.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { facilityCarousel } from '../../src/server/line/flex/facilityCarousel';

describe('facilityCarousel', () => {
  it('returns 6 bubbles with correct postback data', () => {
    const m = facilityCarousel('zh-TW');
    expect(m.contents.type).toBe('carousel');
    expect(m.contents.contents.length).toBe(6);
    const acts = m.contents.contents.map((b: any) =>
      b.footer.contents[0].action.data);
    expect(acts).toContain('act=book&fac=gym');
    expect(acts).toContain('act=book&fac=pool');
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { Lang } from '../ai/types';
import { t } from './i18n';

const FACILITIES = ['gym','pool','meeting_room','lounge','bbq','sauna'] as const;
const ICONS: Record<typeof FACILITIES[number], string> = {
  gym:'🏋️', pool:'🏊', meeting_room:'💼', lounge:'🛋️', bbq:'🔥', sauna:'♨️',
};

export function facilityCarousel(lang: Lang) {
  return {
    type: 'flex',
    altText: t('ask.facility', lang),
    contents: {
      type: 'carousel',
      contents: FACILITIES.map(f => ({
        type: 'bubble', size: 'micro',
        body: { type:'box', layout:'vertical', spacing:'sm', paddingAll:'12px',
          contents: [
            { type:'text', text: ICONS[f], size:'xxl', align:'center' },
            { type:'text', text: t(`facility.${f}` as any, lang), weight:'bold', align:'center', wrap:true },
          ] },
        footer: { type:'box', layout:'vertical',
          contents: [
            { type:'button', style:'primary', color:'#C9A96E', height:'sm',
              action:{ type:'postback', label: t('booking.btn.confirm', lang),
                       data: `act=book&fac=${f}`, displayText: t(`facility.${f}` as any, lang) } },
          ] },
      })),
    },
  } as const;
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/flex-facility-carousel.test.ts
git add src/server/line/flex/facilityCarousel.ts tests/line/flex-facility-carousel.test.ts
git commit -m "feat(line/flex): add facilityCarousel builder (6 facilities)"
```

## Task 4B.4: `flex/dateTimePicker.ts`

**Files:**
- Create: `src/server/line/flex/dateTimePicker.ts`
- Test: `tests/line/flex-datetime.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { dateTimePicker } from '../../src/server/line/flex/dateTimePicker';

describe('dateTimePicker', () => {
  it('returns text + quick reply with picker action', () => {
    const m = dateTimePicker('time', 'zh-TW');
    expect(m.type).toBe('text');
    expect(m.text).toBe('幾點?');
    expect(m.quickReply.items.some((i: any) => i.action.type === 'datetimepicker')).toBe(true);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { Lang } from '../ai/types';
import { t } from './i18n';

export function dateTimePicker(slot: 'date' | 'time', lang: Lang) {
  const presets = slot === 'time'
    ? ['18:00','19:00','20:00','21:00']
    : ['today','tomorrow','this-saturday','this-sunday'];

  return {
    type: 'text',
    text: t(`ask.${slot}` as any, lang),
    quickReply: {
      items: [
        ...presets.map(p => ({
          type: 'action',
          action: { type: 'postback', label: p, data: `slot=${slot}&val=${p}`, displayText: p },
        })),
        { type: 'action',
          action: { type: 'datetimepicker',
                    label: lang === 'zh-TW' ? '其他' : 'Other',
                    data: `slot=${slot}&picker=1`,
                    mode: slot } },
      ],
    },
  } as const;
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/flex-datetime.test.ts
git add src/server/line/flex/dateTimePicker.ts tests/line/flex-datetime.test.ts
git commit -m "feat(line/flex): add dateTimePicker quick-reply builder"
```

## Task 4B.5: `flex/bookingConfirm.ts`

**Files:**
- Create: `src/server/line/flex/bookingConfirm.ts`
- Test: `tests/line/flex-booking-confirm.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { bookingConfirm } from '../../src/server/line/flex/bookingConfirm';

describe('bookingConfirm', () => {
  it('renders facility/date/time and confirm postback', () => {
    const m = bookingConfirm({ facility:'gym', date:'2026-05-09', time:'19:00' }, 'zh-TW');
    const json = JSON.stringify(m);
    expect(json).toContain('健身房');
    expect(json).toContain('2026-05-09');
    expect(json).toContain('19:00');
    expect(json).toContain('act=confirm&intent=facility.book');
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { Lang } from '../ai/types';
import { t } from './i18n';

export function bookingConfirm(input: { facility: string; date: string; time: string }, lang: Lang) {
  const row = (label: string, value: string) => ({
    type: 'box', layout: 'baseline',
    contents: [
      { type:'text', text: label, color:'#999999', flex: 2 },
      { type:'text', text: value, weight:'bold', flex: 5, wrap: true },
    ],
  });
  return {
    type: 'flex',
    altText: `${t('booking.confirm.title', lang)}: ${input.facility} ${input.date} ${input.time}`,
    contents: {
      type: 'bubble', size: 'mega',
      header: { type:'box', layout:'vertical', backgroundColor:'#1a1a1a', paddingAll:'16px',
        contents: [{ type:'text', text: t('booking.confirm.title', lang), color:'#C9A96E', weight:'bold', size:'lg' }] },
      body: { type:'box', layout:'vertical', spacing:'md', contents: [
        row(t('booking.confirm.facility', lang), t(`facility.${input.facility}` as any, lang)),
        row(t('booking.confirm.date', lang), input.date),
        row(t('booking.confirm.time', lang), input.time),
      ] },
      footer: { type:'box', layout:'horizontal', spacing:'sm', contents: [
        { type:'button', style:'primary', color:'#C9A96E',
          action: { type:'postback', label: t('booking.btn.confirm', lang),
                    data: 'act=confirm&intent=facility.book', displayText: t('booking.btn.confirm', lang) } },
        { type:'button', style:'secondary',
          action: { type:'postback', label: t('booking.btn.edit', lang), data:'act=edit&intent=facility.book' } },
        { type:'button', style:'secondary',
          action: { type:'postback', label: t('booking.btn.cancel', lang), data:'act=cancel', displayText: t('booking.btn.cancel', lang) } },
      ] },
    },
  } as const;
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/flex-booking-confirm.test.ts
git add src/server/line/flex/bookingConfirm.ts tests/line/flex-booking-confirm.test.ts
git commit -m "feat(line/flex): add bookingConfirm flex builder"
```

## Task 4B.6: `flex/bookingDone.ts` + `flex/workOrderCard.ts` + `flex/workOrderStatus.ts`

**Files:**
- Create: 3 files under `src/server/line/flex/`
- Test: 3 files under `tests/line/`

- [ ] **Step 1: Write `bookingDone.ts`**

```ts
import type { Lang } from '../ai/types';
import { t } from './i18n';

export function bookingDone(input: { orderId: string }, lang: Lang) {
  return {
    type: 'flex',
    altText: `${t('booking.done.title', lang)} ${input.orderId}`,
    contents: {
      type: 'bubble',
      header: { type:'box', layout:'vertical', backgroundColor:'#0a5d0a', paddingAll:'12px',
        contents: [{ type:'text', text:`✅ ${t('booking.done.title', lang)}`, color:'#fff', weight:'bold' }] },
      body: { type:'box', layout:'vertical', spacing:'sm', contents: [
        { type:'text', text:`${t('booking.done.orderNo', lang)}: ${input.orderId}`, weight:'bold' },
      ] },
      footer: { type:'box', layout:'horizontal', contents: [
        { type:'button', style:'secondary',
          action:{ type:'message', label: t('booking.done.again', lang), text: t('ask.facility', lang) } },
      ] },
    },
  } as const;
}
```

- [ ] **Step 2: Write `workOrderCard.ts`**

```ts
import type { Lang } from '../ai/types';
import { t } from './i18n';

export function workOrderCard(
  input: { orderId: string; from: string; intent: string; summary: string },
  lang: Lang
) {
  return {
    type: 'flex',
    altText: `${t('workorder.new.title', lang)}: ${input.orderId}`,
    contents: {
      type: 'bubble',
      header: { type:'box', layout:'vertical', backgroundColor:'#C9A96E', paddingAll:'12px',
        contents: [{ type:'text', text:`🛎️ ${t('workorder.new.title', lang)}`, color:'#1a1a1a', weight:'bold' }] },
      body: { type:'box', layout:'vertical', spacing:'sm', contents: [
        { type:'text', text:`#${input.orderId}`, weight:'bold' },
        { type:'text', text:`${t('workorder.new.from', lang)}: ${input.from}`, size:'sm', color:'#666' },
        { type:'text', text: input.summary, wrap: true, margin:'md' },
      ] },
      footer: { type:'box', layout:'horizontal', spacing:'xs', contents: [
        { type:'button', style:'primary', color:'#C9A96E',
          action:{ type:'postback', label: t('workorder.new.btn.accept', lang),
                   data: `act=accept&wo=${input.orderId}` } },
        { type:'button', style:'secondary',
          action:{ type:'postback', label: t('workorder.new.btn.reassign', lang),
                   data: `act=reassign&wo=${input.orderId}` } },
        { type:'button', style:'secondary',
          action:{ type:'postback', label: t('workorder.new.btn.reject', lang),
                   data: `act=reject&wo=${input.orderId}` } },
      ] },
    },
  } as const;
}
```

- [ ] **Step 3: Write `workOrderStatus.ts`**

```ts
import type { Lang } from '../ai/types';
import { t } from './i18n';

type Order = { id: string; facility: string; date: string; time: string; status: 'pending'|'in_progress'|'done' };
const STATUS_COLOR: Record<Order['status'], string> = { pending:'#888', in_progress:'#C9A96E', done:'#0a5d0a' };

export function workOrderStatus(orders: Order[], lang: Lang) {
  if (orders.length === 0) {
    return { type:'text', text: t('workorder.status.empty', lang) } as const;
  }
  return {
    type: 'flex',
    altText: t('workorder.status.title', lang),
    contents: {
      type: 'carousel',
      contents: orders.slice(0, 5).map(o => ({
        type: 'bubble', size: 'micro',
        body: { type:'box', layout:'vertical', spacing:'sm', contents: [
          { type:'text', text: `#${o.id}`, weight:'bold' },
          { type:'text', text: t(`facility.${o.facility}` as any, lang), size:'sm' },
          { type:'text', text: `${o.date} ${o.time}`, size:'xs', color:'#666' },
          { type:'text', text: o.status, color: STATUS_COLOR[o.status], align:'end', size:'xs' },
        ] },
      })),
    },
  } as const;
}
```

- [ ] **Step 4: Write three matching test files (one per builder, snapshot key fields)**

Each test file follows the same pattern:

```ts
// tests/line/flex-booking-done.test.ts
import { describe, it, expect } from 'vitest';
import { bookingDone } from '../../src/server/line/flex/bookingDone';
describe('bookingDone', () => {
  it('contains orderId in altText and body', () => {
    const m = bookingDone({ orderId: 'WO-001' }, 'zh-TW');
    expect(JSON.stringify(m)).toContain('WO-001');
  });
});
```

Likewise for `workOrderCard` and `workOrderStatus` — each test asserts key fields appear in JSON.stringify of the output.

- [ ] **Step 5: Pass + commit**

```
npx vitest run tests/line/flex-booking-done.test.ts tests/line/flex-workorder-card.test.ts tests/line/flex-workorder-status.test.ts
git add src/server/line/flex/bookingDone.ts src/server/line/flex/workOrderCard.ts src/server/line/flex/workOrderStatus.ts \
        tests/line/flex-booking-done.test.ts tests/line/flex-workorder-card.test.ts tests/line/flex-workorder-status.test.ts
git commit -m "feat(line/flex): add bookingDone, workOrderCard, workOrderStatus builders"
```

## Task 4C.1: `handlers/resident.ts` — slot-filling state machine

**Files:**
- Create: `src/server/line/handlers/resident.ts`
- Test: `tests/line/handlers-resident.test.ts`

- [ ] **Step 1: Failing test (full happy path through state machine)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleResident } from '../../src/server/line/handlers/resident';
import { SessionStore } from '../../src/server/line/session-store';

const mkAi = (intent: any) => ({ classify: vi.fn().mockResolvedValue(intent) });
const mkClient = () => ({ reply: vi.fn().mockResolvedValue(undefined),
                          push: vi.fn().mockResolvedValue(undefined),
                          replyOrPush: vi.fn().mockResolvedValue(undefined) });
const baseEv = (text: string, replyToken='rt') => ({ type:'message', replyToken, source:{userId:'U1'}, message:{type:'text', text} });

describe('resident handler — facility.book happy path', () => {
  let store: SessionStore;
  beforeEach(() => { store = new SessionStore({ ttlMs: 60_000 }); });

  it('asks for missing slot when facility known, time missing', async () => {
    const ai = mkAi({ intent:'facility.book', confidence:0.9, slots:{ facility:'gym' }, language:'zh-TW' });
    const client = mkClient();
    await handleResident(baseEv('預約健身房'), {
      ai, client: client as any, store, channelId:'C',
      lineUser: { lineUserId:'U1', role:'resident', language:'zh-TW' } as any,
      bookFn: vi.fn(), pushHousekeepers: vi.fn(),
    });
    // either asked for date or time
    expect(client.replyOrPush).toHaveBeenCalled();
    const session = store.get('U1');
    expect(session?.step).toBe('SLOT_FILLING');
    expect(session?.slots.facility).toBe('gym');
  });

  it('moves to CONFIRMING when all slots filled', async () => {
    const ai = mkAi({ intent:'facility.book', confidence:0.95,
      slots:{ facility:'gym', date:'2026-05-09', time:'19:00' }, language:'zh-TW' });
    const client = mkClient();
    await handleResident(baseEv('預約週六晚上7點健身房'), {
      ai, client: client as any, store, channelId:'C',
      lineUser: { lineUserId:'U1', role:'resident', language:'zh-TW' } as any,
      bookFn: vi.fn(), pushHousekeepers: vi.fn(),
    });
    expect(store.get('U1')?.step).toBe('CONFIRMING');
  });

  it('on /confirm postback, calls bookFn, pushes housekeepers, returns to IDLE', async () => {
    const ai = mkAi({ intent:'facility.book', confidence:0.95,
      slots:{ facility:'gym', date:'2026-05-09', time:'19:00' }, language:'zh-TW' });
    const client = mkClient();
    const bookFn = vi.fn().mockResolvedValue({ id: 'WO-42' });
    const pushHousekeepers = vi.fn();

    // round 1: classify, fill slots, end at CONFIRMING
    await handleResident(baseEv('預約週六晚上7點健身房'), {
      ai, client: client as any, store, channelId:'C',
      lineUser: { lineUserId:'U1', role:'resident', language:'zh-TW' } as any,
      bookFn, pushHousekeepers,
    });
    // round 2: postback confirm
    await handleResident({ type:'postback', replyToken:'rt2', source:{userId:'U1'},
      postback:{ data:'act=confirm&intent=facility.book' } } as any, {
      ai, client: client as any, store, channelId:'C',
      lineUser: { lineUserId:'U1', role:'resident', language:'zh-TW' } as any,
      bookFn, pushHousekeepers,
    });

    expect(bookFn).toHaveBeenCalledWith({ facility:'gym', date:'2026-05-09', time:'19:00' });
    expect(pushHousekeepers).toHaveBeenCalled();
    expect(store.get('U1')?.step).toBe('IDLE');
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { SessionStore, SessionState } from '../session-store';
import type { IntentClassifier, Lang } from '../ai/types';
import type { LineClient } from '../line-client';
import { parsePostback } from '../postback';
import { facilityCarousel } from '../flex/facilityCarousel';
import { dateTimePicker } from '../flex/dateTimePicker';
import { bookingConfirm } from '../flex/bookingConfirm';
import { bookingDone } from '../flex/bookingDone';
import { t } from '../flex/i18n';

const REQUIRED_SLOTS: Record<string, string[]> = {
  'facility.book':   ['facility','date','time'],
  'repair.report':   ['issue','location','urgency'],
  'visitor.notify':  ['visitor_name','visitor_count','date','time'],
  'complaint.file':  ['issue'],
};

export type ResidentDeps = {
  ai: IntentClassifier;
  client: LineClient;
  store: SessionStore;
  channelId: string;
  lineUser: { lineUserId: string; role: 'resident'|'housekeeper'|'admin'; language: Lang };
  bookFn: (input: { facility: string; date: string; time: string }) => Promise<{ id: string }>;
  pushHousekeepers: (msg: any) => Promise<void>;
};

export async function handleResident(ev: any, deps: ResidentDeps): Promise<void> {
  const userId = deps.lineUser.lineUserId;
  const lang = deps.lineUser.language;
  let session = deps.store.get(userId) ?? newSession(userId, lang);

  // postback handling
  if (ev.type === 'postback') {
    const params = parsePostback(ev.postback?.data ?? '');
    if (params.act === 'cancel') {
      deps.store.clear(userId);
      await deps.client.replyOrPush(ev.replyToken, userId, { type:'text', text: t('booking.btn.cancel', lang) });
      return;
    }
    if (params.act === 'book' && params.fac) {
      session = { ...session, intent:'facility.book', slots:{ ...session.slots, facility: params.fac }, step:'SLOT_FILLING' };
    }
    if (params.slot && params.val) {
      session = { ...session, slots:{ ...session.slots, [params.slot]: params.val }, step:'SLOT_FILLING' };
    }
    if (params.act === 'confirm' && session.step === 'CONFIRMING' && session.intent === 'facility.book') {
      session = { ...session, step:'EXECUTING' };
      deps.store.set(userId, session);
      const order = await deps.bookFn(session.slots as any);
      await deps.client.replyOrPush(ev.replyToken, userId, bookingDone({ orderId: order.id }, lang));
      await deps.pushHousekeepers({ orderId: order.id, from: userId, intent: session.intent, summary: JSON.stringify(session.slots) });
      deps.store.clear(userId);
      return;
    }
  }

  // text handling — classify if no active intent
  if (ev.type === 'message' && ev.message?.type === 'text' && !session.intent) {
    const text = ev.message.text as string;
    const r = await deps.ai.classify(text, { userId, history: session.history });
    session = { ...session, intent: r.intent, slots: { ...session.slots, ...r.slots }, language: r.language, history: [...(session.history ?? []), text].slice(-4) };
    if (r.intent === 'small_talk') {
      await deps.client.replyOrPush(ev.replyToken, userId, { type:'text', text: t('msg.smallTalk', lang) });
      return;
    }
    if (r.intent === 'unknown' || r.confidence < 0.6) {
      await deps.client.replyOrPush(ev.replyToken, userId, { type:'text', text: t('msg.unknown', lang) });
      return;
    }
  }

  // recompute missing slots and advance state
  const required = REQUIRED_SLOTS[session.intent ?? ''] ?? [];
  const missing = required.filter(k => !(k in session.slots));
  session = { ...session, missingSlots: missing };

  if (missing.length === 0 && session.intent === 'facility.book') {
    session = { ...session, step: 'CONFIRMING' };
    deps.store.set(userId, session);
    await deps.client.replyOrPush(ev.replyToken, userId,
      bookingConfirm(session.slots as any, lang));
    return;
  }

  // ask next missing slot
  const next = missing[0];
  if (next === 'facility') {
    deps.store.set(userId, session);
    await deps.client.replyOrPush(ev.replyToken, userId, facilityCarousel(lang));
    return;
  }
  if (next === 'date' || next === 'time') {
    deps.store.set(userId, session);
    await deps.client.replyOrPush(ev.replyToken, userId, dateTimePicker(next, lang));
    return;
  }
  // generic ask
  if (next) {
    deps.store.set(userId, session);
    await deps.client.replyOrPush(ev.replyToken, userId, { type:'text', text: t(`ask.${next.replace('_','.')}` as any, lang) });
  }
}

function newSession(userId: string, language: Lang): SessionState {
  return { userId, role:'resident', step:'IDLE', slots:{}, missingSlots:[], language, updatedAt: Date.now() };
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/handlers-resident.test.ts
git add src/server/line/handlers/resident.ts tests/line/handlers-resident.test.ts
git commit -m "feat(line): resident handler with slot-filling state machine for facility.book"
```

## Task 4C.2: Wire resident handler into dispatcher

**Files:**
- Modify: `src/server/line/dispatcher.ts`
- Modify: `src/server/line/dispatcher.ts` test (extend)

- [ ] **Step 1: Extend `DispatchDeps`** to include `ai`, `store`, `lineUserRepo`, `channelId`, `bookFn`, `pushHousekeepers`. The `getDefaultDispatchDeps()` factory should construct them lazily from `getAi()`, the global `sessionStore`, the better-sqlite3 db handle (via `src/server/db.ts`), and a `bookFn` that calls `appRouter.createCaller(ctx).amenities.book(...)`.

- [ ] **Step 2: Replace echo logic** with a switchboard:

```ts
import { handleResident } from './handlers/resident';
import { sessionStore } from './session-store';

export async function dispatch(events: any[], deps: DispatchDeps): Promise<void> {
  sessionStore.evictExpired();
  for (const ev of events) {
    const userId = ev.source?.userId;
    if (!userId) continue;
    const lineUser = deps.lineUserRepo.byLineId(deps.channelId, userId)
      ?? (deps.lineUserRepo.upsert({ channelId: deps.channelId, lineUserId: userId, isDemo: 1 }),
          deps.lineUserRepo.byLineId(deps.channelId, userId)!);

    deps.messageLog.write({ lineUserId: userId, direction:'inbound',
      messageType: ev.type, content: ev });

    if (lineUser.role === 'resident') {
      await handleResident(ev, {
        ai: deps.ai, client: deps.lineClient, store: sessionStore,
        channelId: deps.channelId, lineUser, bookFn: deps.bookFn,
        pushHousekeepers: deps.pushHousekeepers,
      });
    }
    // housekeeper / admin handlers added in Phase 5 / 7
  }
}
```

- [ ] **Step 3: Update echo test or remove it (now obsolete)** — replace with an integration test that exercises text → carousel reply via mocked AI.

- [ ] **Step 4: Type-check + tests**

```
npm run type-check
npm run test
```

- [ ] **Step 5: Commit**

```
git add src/server/line/dispatcher.ts tests/line/dispatcher-echo.test.ts
git commit -m "feat(line): wire resident handler + line_user upsert + message log into dispatcher"
```

## Task 4C.3: Phase 4 wrap

- [ ] **Step 1: All tests + type-check + manual smoke (LINE → 預約 → carousel)** — record on scratch
- [ ] **Step 2: Push** — `git push origin main`

---

# PHASE 5 — Housekeeper Handler + Push Notification

## Task 5.1: `handlers/housekeeper.ts`

**Files:**
- Create: `src/server/line/handlers/housekeeper.ts`
- Test: `tests/line/handlers-housekeeper.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleHousekeeper } from '../../src/server/line/handlers/housekeeper';

describe('housekeeper handler', () => {
  it('on /accept postback, calls updateOrder + replies success', async () => {
    const updateOrder = vi.fn().mockResolvedValue(undefined);
    const client = { replyOrPush: vi.fn() } as any;
    await handleHousekeeper(
      { type:'postback', replyToken:'rt', source:{userId:'H1'},
        postback:{ data:'act=accept&wo=WO-1' } } as any,
      { client, updateOrder, lineUser:{ lineUserId:'H1', role:'housekeeper', language:'zh-TW' } as any });
    expect(updateOrder).toHaveBeenCalledWith('WO-1', { status:'in_progress', acceptedBy:'H1' });
    expect(client.replyOrPush).toHaveBeenCalled();
  });

  it('ignores text messages (not in housekeeper flow yet)', async () => {
    const updateOrder = vi.fn();
    const client = { replyOrPush: vi.fn() } as any;
    await handleHousekeeper(
      { type:'message', replyToken:'rt', source:{userId:'H1'}, message:{type:'text', text:'hi'} } as any,
      { client, updateOrder, lineUser:{ lineUserId:'H1', role:'housekeeper', language:'zh-TW' } as any });
    expect(updateOrder).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { LineClient } from '../line-client';
import type { Lang } from '../ai/types';
import { parsePostback } from '../postback';
import { t } from '../flex/i18n';

export type HousekeeperDeps = {
  client: LineClient;
  updateOrder: (orderId: string, patch: { status: 'pending'|'in_progress'|'done'; acceptedBy?: string; rejectedBy?: string }) => Promise<void>;
  lineUser: { lineUserId: string; role: 'resident'|'housekeeper'|'admin'; language: Lang };
};

export async function handleHousekeeper(ev: any, deps: HousekeeperDeps): Promise<void> {
  if (ev.type !== 'postback') return;
  const p = parsePostback(ev.postback?.data ?? '');
  if (!p.wo) return;

  const lang = deps.lineUser.language;
  switch (p.act) {
    case 'accept':
      await deps.updateOrder(p.wo, { status:'in_progress', acceptedBy: deps.lineUser.lineUserId });
      await deps.client.replyOrPush(ev.replyToken, deps.lineUser.lineUserId,
        { type:'text', text: `✅ ${p.wo} ${t('workorder.new.btn.accept', lang)}` });
      break;
    case 'reject':
      await deps.updateOrder(p.wo, { status:'pending', rejectedBy: deps.lineUser.lineUserId });
      await deps.client.replyOrPush(ev.replyToken, deps.lineUser.lineUserId,
        { type:'text', text: `❌ ${p.wo} ${t('workorder.new.btn.reject', lang)}` });
      break;
    case 'reassign':
      await deps.client.replyOrPush(ev.replyToken, deps.lineUser.lineUserId,
        { type:'text', text: `🔁 ${p.wo} (reassign — coming v2)` });
      break;
  }
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/handlers-housekeeper.test.ts
git add src/server/line/handlers/housekeeper.ts tests/line/handlers-housekeeper.test.ts
git commit -m "feat(line): housekeeper handler for accept/reject/reassign postbacks"
```

## Task 5.2: `pushHousekeepers` helper

**Files:**
- Create: `src/server/line/push-housekeepers.ts`
- Test: `tests/line/push-housekeepers.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { makePushHousekeepers } from '../../src/server/line/push-housekeepers';

describe('pushHousekeepers', () => {
  it('pushes workOrderCard to each housekeeper', async () => {
    const lineUserRepo = { listByRole: vi.fn().mockReturnValue([
      { lineUserId:'H1', language:'zh-TW' }, { lineUserId:'H2', language:'en' }
    ]) } as any;
    const client = { push: vi.fn().mockResolvedValue(undefined) } as any;
    const fn = makePushHousekeepers({ lineUserRepo, client, channelId:'C' });
    await fn({ orderId:'WO-1', from:'U1', intent:'facility.book', summary:'gym 19:00' });
    expect(client.push).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { LineClient } from './line-client';
import type { makeLineUserRepo } from './line-user-repo';
import { workOrderCard } from './flex/workOrderCard';

export function makePushHousekeepers(deps: {
  lineUserRepo: ReturnType<typeof makeLineUserRepo>;
  client: LineClient;
  channelId: string;
}) {
  return async function pushHousekeepers(payload: {
    orderId: string; from: string; intent: string; summary: string;
  }): Promise<void> {
    const housekeepers = deps.lineUserRepo.listByRole(deps.channelId, 'housekeeper');
    await Promise.all(housekeepers.map(h => {
      const card = workOrderCard(payload, (h.language ?? 'zh-TW') as any);
      return deps.client.push(h.lineUserId, card).catch(err =>
        console.error('[LINE] push to housekeeper failed', { hk: h.lineUserId, err }));
    }));
  };
}
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/push-housekeepers.test.ts
git add src/server/line/push-housekeepers.ts tests/line/push-housekeepers.test.ts
git commit -m "feat(line): pushHousekeepers fan-out helper"
```

## Task 5.3: Wire housekeeper handler + pushHousekeepers into dispatcher

**Files:**
- Modify: `src/server/line/dispatcher.ts`

- [ ] **Step 1: Extend dispatch switchboard**

```ts
import { handleHousekeeper } from './handlers/housekeeper';

// inside dispatch loop, after resident branch:
if (lineUser.role === 'housekeeper') {
  await handleHousekeeper(ev, {
    client: deps.lineClient,
    updateOrder: deps.updateOrder,
    lineUser,
  });
}
```

- [ ] **Step 2: Add `updateOrder` to `getDefaultDispatchDeps()`** — calls existing tRPC `workOrders.update` procedure via `appRouter.createCaller`.

- [ ] **Step 3: Add `pushHousekeepers` to default deps** using `makePushHousekeepers({ lineUserRepo, client: lineClient, channelId })`.

- [ ] **Step 4: Type-check + commit**

```
npm run type-check
git add src/server/line/dispatcher.ts
git commit -m "feat(line): wire housekeeper handler + pushHousekeepers into dispatcher"
```

## Task 5.4: Phase 5 wrap

- [ ] **Step 1: All tests + manual two-account smoke** (use a second LINE account; flip its role to housekeeper via DB)
- [ ] **Step 2: Push** — `git push origin main`

---

# PHASE 6 — `/demo` Script Engine + 4 Scripts

## Task 6.1: `demo-scripts/types.ts`

**Files:**
- Create: `src/server/line/demo-scripts/types.ts`

- [ ] **Step 1: Write file**

```ts
import type { Lang } from '../ai/types';

export type DemoStep =
  | { kind: 'bot_say'; message: any; delayMs?: number }
  | { kind: 'wait_user'; expect: 'any' | 'postback'; postbackData?: string }
  | { kind: 'simulate_housekeeper'; message: string; delayMs: number }
  | { kind: 'side_effect'; trpcCall: { router: string; procedure: string; input: unknown } };

export type DemoScript = {
  id: 'facility' | 'repair' | 'visitor' | 'complaint';
  title: Record<Lang, string>;
  steps: DemoStep[];
};
```

- [ ] **Step 2: Commit**

```
git add src/server/line/demo-scripts/types.ts
git commit -m "feat(line/demo): define DemoScript types"
```

## Task 6.2: Write `demo-scripts/facility.ts`

**Files:**
- Create: `src/server/line/demo-scripts/facility.ts`

- [ ] **Step 1: Implement** — full step list per spec §4.5

```ts
import type { DemoScript } from './types';
import { facilityCarousel } from '../flex/facilityCarousel';
import { dateTimePicker } from '../flex/dateTimePicker';
import { bookingConfirm } from '../flex/bookingConfirm';
import { bookingDone } from '../flex/bookingDone';
import { workOrderCard } from '../flex/workOrderCard';

const txt = (s: string) => ({ kind:'bot_say' as const, message:{ type:'text', text:s }, delayMs: 1500 });

export const facilityScript: DemoScript = {
  id: 'facility',
  title: { 'zh-TW':'預約健身房 walkthrough', en:'Book a facility', ja:'施設予約デモ' },
  steps: [
    txt('🎬 開始示範:住戶想預約健身房'),
    txt('👤 住戶: 「想訂禮拜六晚上的健身房」'),
    { kind:'bot_say', message: facilityCarousel('zh-TW'), delayMs: 1000 },
    { kind:'wait_user', expect:'postback', postbackData:'act=book&fac=gym' },
    { kind:'bot_say', message: dateTimePicker('time', 'zh-TW'), delayMs: 500 },
    { kind:'wait_user', expect:'postback' },
    { kind:'bot_say', message: bookingConfirm({ facility:'gym', date:'2026-05-09', time:'19:00' }, 'zh-TW'), delayMs: 500 },
    { kind:'wait_user', expect:'postback', postbackData:'act=confirm' },
    { kind:'side_effect', trpcCall: { router:'amenities', procedure:'book',
        input: { facility:'gym', date:'2026-05-09', time:'19:00', userId: 1 } } },
    { kind:'bot_say', message: bookingDone({ orderId:'WO-DEMO-001' }, 'zh-TW'), delayMs: 500 },
    { kind:'simulate_housekeeper', message:'🛎️ 管家端收到通知…', delayMs: 3000 },
    { kind:'bot_say', message: workOrderCard({ orderId:'WO-DEMO-001', from:'住戶 A', intent:'facility.book',
      summary:'健身房 2026-05-09 19:00' }, 'zh-TW'), delayMs: 500 },
    txt('✅ Demo 完成!輸入 /demo list 查看其他腳本'),
  ],
};
```

- [ ] **Step 2: Commit**

```
git add src/server/line/demo-scripts/facility.ts
git commit -m "feat(line/demo): add facility booking walkthrough script"
```

## Task 6.3: Write `demo-scripts/repair.ts`, `visitor.ts`, `complaint.ts`

- [ ] **Step 1: Implement each** following the same shape as facility.ts. Each should be ~10-13 steps including a `side_effect` that calls a real tRPC procedure.

For brevity show repair only (the others mirror it):

```ts
// repair.ts
import type { DemoScript } from './types';
const txt = (s: string) => ({ kind:'bot_say' as const, message:{ type:'text', text:s }, delayMs: 1500 });

export const repairScript: DemoScript = {
  id: 'repair',
  title: { 'zh-TW':'報修示範', en:'Repair walkthrough', ja:'修理依頼デモ' },
  steps: [
    txt('🎬 開始示範:住戶報修水龍頭'),
    txt('👤 住戶: 「12 樓 A 戶水龍頭一直滴水」'),
    txt('🤖 AI: 收到!正在為您建立工單,請稍候…'),
    { kind:'side_effect', trpcCall:{ router:'workOrders', procedure:'create',
        input:{ type:'repair', issue:'faucet drip', location:'12F-A', urgency:'med', userId: 1 } } },
    txt('✅ 工單 WO-DEMO-002 已建立,管家將在 1 小時內到場'),
    { kind:'simulate_housekeeper', message:'🛎️ (3 秒) 管家收到通知…', delayMs: 3000 },
    txt('🛎️ 管家 王小明: 「收到,正在前往」'),
    txt('✅ Demo 完成'),
  ],
};
```

(Apply same pattern to `visitor.ts` and `complaint.ts`.)

- [ ] **Step 2: Commit each (or batch)**

```
git add src/server/line/demo-scripts/repair.ts src/server/line/demo-scripts/visitor.ts src/server/line/demo-scripts/complaint.ts
git commit -m "feat(line/demo): add repair, visitor, complaint walkthrough scripts"
```

## Task 6.4: `demo-scripts/index.ts` registry

**Files:**
- Create: `src/server/line/demo-scripts/index.ts`

- [ ] **Step 1: Write registry**

```ts
import { facilityScript } from './facility';
import { repairScript } from './repair';
import { visitorScript } from './visitor';
import { complaintScript } from './complaint';
import type { DemoScript } from './types';

export const SCRIPTS: Record<DemoScript['id'], DemoScript> = {
  facility:  facilityScript,
  repair:    repairScript,
  visitor:   visitorScript,
  complaint: complaintScript,
};
export function listScripts(): DemoScript[] { return Object.values(SCRIPTS); }
export function getScript(id: string): DemoScript | undefined { return (SCRIPTS as any)[id]; }
```

- [ ] **Step 2: Commit**

```
git add src/server/line/demo-scripts/index.ts
git commit -m "feat(line/demo): add scripts registry"
```

## Task 6.5: `handlers/demo.ts` engine

**Files:**
- Create: `src/server/line/handlers/demo.ts`
- Test: `tests/line/handlers-demo.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startDemo, continueDemo } from '../../src/server/line/handlers/demo';
import { SessionStore } from '../../src/server/line/session-store';

describe('demo engine', () => {
  let store: SessionStore;
  beforeEach(() => { store = new SessionStore({ ttlMs: 60_000 }); });

  it('startDemo runs bot_say steps until first wait_user', async () => {
    const client = { push: vi.fn().mockResolvedValue(undefined) };
    await startDemo('facility', {
      store, client: client as any, lineUser:{ lineUserId:'U1', language:'zh-TW' } as any,
      runSideEffect: vi.fn(),
    });
    expect(client.push.mock.calls.length).toBeGreaterThan(0);
    const s = store.get('U1');
    expect(s?.demoScriptId).toBe('facility');
    expect(s?.demoStep).toBeGreaterThan(0);
  });

  it('continueDemo proceeds after wait_user', async () => {
    const client = { push: vi.fn().mockResolvedValue(undefined) };
    await startDemo('facility', { store, client: client as any,
      lineUser:{ lineUserId:'U1', language:'zh-TW' } as any, runSideEffect: vi.fn() });
    const before = store.get('U1')?.demoStep ?? 0;
    await continueDemo({ type:'postback', source:{userId:'U1'}, postback:{ data:'act=book&fac=gym' } } as any,
      { store, client: client as any, lineUser:{ lineUserId:'U1', language:'zh-TW' } as any, runSideEffect: vi.fn() });
    const after = store.get('U1')?.demoStep ?? 0;
    expect(after).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { getScript } from '../demo-scripts';
import type { DemoStep } from '../demo-scripts/types';
import type { SessionStore } from '../session-store';
import type { LineClient } from '../line-client';
import type { Lang } from '../ai/types';

export type DemoDeps = {
  store: SessionStore;
  client: LineClient;
  lineUser: { lineUserId: string; language: Lang };
  runSideEffect: (call: { router: string; procedure: string; input: unknown }) => Promise<void>;
};

export async function startDemo(scriptId: string, deps: DemoDeps): Promise<void> {
  const script = getScript(scriptId);
  if (!script) {
    await deps.client.push(deps.lineUser.lineUserId, { type:'text', text:`unknown script: ${scriptId}` });
    return;
  }
  const userId = deps.lineUser.lineUserId;
  deps.store.set(userId, {
    userId, role:'resident', step:'IDLE', slots:{}, missingSlots:[],
    language: deps.lineUser.language, updatedAt: Date.now(),
    demoScriptId: scriptId, demoStep: 0,
  });
  await runFromCurrentStep(deps, script.steps);
}

export async function continueDemo(ev: any, deps: DemoDeps): Promise<void> {
  const session = deps.store.get(deps.lineUser.lineUserId);
  if (!session?.demoScriptId) return;
  const script = getScript(session.demoScriptId);
  if (!script) return;

  const cur = script.steps[session.demoStep ?? 0];
  if (cur?.kind === 'wait_user') {
    if (cur.expect === 'postback' && ev.type !== 'postback') return;
    if (cur.postbackData && ev.postback?.data !== cur.postbackData) return;
    deps.store.set(deps.lineUser.lineUserId, { ...session, demoStep: (session.demoStep ?? 0) + 1 });
    await runFromCurrentStep(deps, script.steps);
  }
}

async function runFromCurrentStep(deps: DemoDeps, steps: DemoStep[]): Promise<void> {
  while (true) {
    const s = deps.store.get(deps.lineUser.lineUserId);
    if (!s) return;
    const idx = s.demoStep ?? 0;
    const step = steps[idx];
    if (!step) {
      deps.store.set(deps.lineUser.lineUserId, { ...s, demoScriptId: undefined, demoStep: undefined });
      return;
    }
    if (step.kind === 'wait_user') return;
    if (step.kind === 'bot_say') {
      await deps.client.push(deps.lineUser.lineUserId, step.message);
      if (step.delayMs) await sleep(step.delayMs);
    } else if (step.kind === 'simulate_housekeeper') {
      await sleep(step.delayMs);
      await deps.client.push(deps.lineUser.lineUserId, { type:'text', text: step.message });
    } else if (step.kind === 'side_effect') {
      await deps.runSideEffect(step.trpcCall);
    }
    deps.store.set(deps.lineUser.lineUserId, { ...s, demoStep: idx + 1 });
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
```

- [ ] **Step 3: Pass + commit**

```
npx vitest run tests/line/handlers-demo.test.ts
git add src/server/line/handlers/demo.ts tests/line/handlers-demo.test.ts
git commit -m "feat(line/demo): demo script engine (start/continue/runSideEffect)"
```

## Task 6.6: Phase 6 wrap

- [ ] **Step 1: All tests + manual smoke** — send `/demo facility` to bot
- [ ] **Step 2: Push** — `git push origin main`

---

**End of Part 2 (Phases 4-6).** Continue with Part 3: `2026-05-01-line-online-demo-plan-part3.md` for Phases 7-9.
