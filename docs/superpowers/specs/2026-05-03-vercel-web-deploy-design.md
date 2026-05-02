# Vercel Web Deploy + Token Auth — Design Spec

- **Date**: 2026-05-03
- **Owner**: ydw331@gmail.com
- **Status**: Approved (delegated decision authority)
- **Related**: `docs/superpowers/specs/2026-05-01-line-online-demo-design.md` (LINE bot already deployed; this spec extends to admin/logistics web pages)

---

## 0. Goal & Scope

Deploy the existing Expo Router app's **admin + logistics pages** to Vercel as a web app, fronting the already-live Render backend. Provide simple token-based authentication so internal staff (admin, logistics) and demo presenters can access role-specific dashboards by URL.

### 0.1 Confirmed Requirements (brainstorm)

| Decision | Value |
|---|---|
| **Audience** | Internal staff: admin + logistics + (demo) resident |
| **Auth** | Token-based passwordless — 3 env tokens, 1 per role |
| **Web ↔ API** | Vercel direct → Render; Render CORS allow-lists Vercel domain |
| **Page scope (M)** | 4 pages: `admin-dashboard`, `admin/index`, `admin/amenity-iot`, `logistics-dashboard` (+ `/login`, `/`) |
| **Token flow** | URL bootstrap (`?token=…`) → `localStorage` → `Authorization: Bearer` header on every tRPC call |

### 0.2 Out of scope (v1)

- Resident-facing pages (`wallet`, `amenities/[id]`, `my-bookings`, etc.) — they will exist in the bundle but receive no QA attention. If they crash on web, accept (out of scope).
- Real OAuth (Google/Apple/MS) — backend `oauth.ts` exists but not wired to web demo.
- Mobile native build (EAS) — separate concern.
- Cookie-based session — explicitly chose Authorization header (no cross-origin cookie complexity).
- Per-page role guards beyond what role redirects + tRPC procedure middlewares already enforce.

---

## 1. Architecture

```
                 ┌─────────────────────────────────────────────┐
                 │                Vercel (web)                  │
                 │  ┌──────────────────────────────────────┐   │
   Browser ─────▶│  │  Expo Router static bundle (dist/)    │   │
                 │  │   /login, /, /admin/*, /logistics-*    │   │
                 │  │   token in localStorage                │   │
                 │  └──────────────────────────────────────┘   │
                 └─────────────────────────────────────────────┘
                                    │ Authorization: Bearer <token>
                                    ▼
                 ┌─────────────────────────────────────────────┐
                 │              Render (existing)               │
                 │  Express + tRPC + LINE webhook               │
                 │  + tokenAuthMiddleware (NEW)                 │
                 │   — reads Authorization header               │
                 │   — maps env token → synthetic ctx.user      │
                 └─────────────────────────────────────────────┘
```

### 1.1 Component responsibilities

| Component | Responsibility |
|---|---|
| `src/server/_core/context.ts` | `createContext` reads `Authorization: Bearer <token>` from request, looks up matching env token, attaches `ctx.user` (synthetic). Falls back to existing cookie-based auth when no header. |
| `src/server/_core/token-auth.ts` (new) | Pure mapping `token → { role, userId, email, name } | null`. 3 env vars: `WEB_ADMIN_TOKEN`, `WEB_LOGISTICS_TOKEN`, `WEB_RESIDENT_TOKEN`. Synthetic users map to seeded `users.id` rows (1=resident, 2=admin, 3=logistics). |
| `src/lib/trpc.ts` | `httpBatchLink.headers()` reads `localStorage.mai_touch_demo_token`, sets `Authorization: Bearer <token>` if present. |
| `src/hooks/use-auth.ts` | Replace stub `Api`/`Auth` with real `trpc.auth.me.useQuery()` + localStorage helpers. Returns `{ user, loading, error, refresh, logout }`. |
| `src/app/_layout.tsx` (new — root layout) | On mount: read `?token=` from URL, write to `localStorage.mai_touch_demo_token`, `history.replaceState` to strip token from URL. Call `useAuth().refresh()`. If `user` resolved with role, redirect to role-specific landing. If no user, redirect to `/login`. |
| `src/app/login.tsx` (new) | Token paste form + 3 quick-login buttons (admin/logistics/resident) using known env tokens (read from `EXPO_PUBLIC_*` for demo convenience — only for demo, since Vercel bundles them into client JS). |
| `scripts/init-db-demo.ts` | Add `INSERT OR IGNORE` for `users.id=3` (`logistics@demo.local`, role `logistics`). |
| `vercel.json` (new) | Build command, output dir, SPA rewrites. |

### 1.2 Token → user mapping

```ts
// src/server/_core/token-auth.ts
type SyntheticUser = {
  id: number; openId: string; email: string; name: string;
  role: 'resident' | 'admin' | 'logistics';
  loginMethod: 'token';
  createdAt: Date; updatedAt: Date; lastSignedIn: Date;
};

const TOKEN_TO_USER: Array<[envName: string, user: () => SyntheticUser]> = [
  ['WEB_ADMIN_TOKEN',     () => ({ id: 2, openId: 'demo-admin-001',     email: 'admin@demo.local',     name: 'Demo Admin',     role: 'admin',     loginMethod: 'token', createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() })],
  ['WEB_LOGISTICS_TOKEN', () => ({ id: 3, openId: 'demo-logistics-001', email: 'logistics@demo.local', name: 'Demo Logistics', role: 'logistics', loginMethod: 'token', createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() })],
  ['WEB_RESIDENT_TOKEN',  () => ({ id: 1, openId: 'demo-seed-001',      email: 'seed@demo.local',      name: 'Demo Resident',  role: 'resident',  loginMethod: 'token', createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() })],
];

export function userFromToken(token: string | null | undefined): SyntheticUser | null {
  if (!token) return null;
  for (const [envName, factory] of TOKEN_TO_USER) {
    const expected = process.env[envName];
    if (expected && token === expected) return factory();
  }
  return null;
}
```

### 1.3 Auth precedence in `createContext`

```
1. Authorization: Bearer <token> header → userFromToken → ctx.user
2. (existing) Session cookie → cookie-based user
3. (existing) `lineAdmin` ctx for LINE admin tRPC procedures (Phase 9B)
4. No auth → ctx.user = null (publicProcedure only)
```

Header-based wins over cookie. tRPC procedures (`adminProcedure`, `residentProcedure`, `logisticsProcedure`) work unchanged because they only check `ctx.user.role`.

---

## 2. Data Flow

### 2.1 First-time visit with token

```
User: opens https://your-app.vercel.app/admin?token=ADMIN_TOKEN

[Browser]
  /admin
    ↓
[expo-router root _layout.tsx]
  - URL has ?token → localStorage.setItem('mai_touch_demo_token', token)
  - history.replaceState(null, '', '/admin')   // strips token from URL
  - useAuth() → trpc.auth.me.useQuery()
    ↓
[trpc client httpBatchLink]
  - headers(): { Authorization: 'Bearer ADMIN_TOKEN' }
  - POST https://mai-touch-demo.onrender.com/api/trpc/auth.me
    ↓
[Render createContext]
  - reads req.headers.authorization
  - userFromToken('ADMIN_TOKEN') → { id:2, role:'admin', ... }
  - ctx.user = synthetic admin user
    ↓
[trpc auth.me.query]
  - returns ctx.user
    ↓
[useAuth hook]
  - user = { role:'admin', ... }
    ↓
[_layout.tsx useEffect]
  - role === 'admin' → already on /admin, no redirect
[admin/index.tsx renders]
```

### 2.2 Subsequent navigation (no URL token)

```
User: navigates to /admin/amenity-iot

[Browser navigation]
  - localStorage still has token
  - useAuth() returns cached user OR re-queries auth.me
  - tRPC client adds Authorization header on every call
  - Page renders, calls trpc.amenities.adminList(), succeeds
```

### 2.3 Logout

```
User: clicks logout button (in admin landing)

[useAuth.logout]
  - localStorage.removeItem('mai_touch_demo_token')
  - setUser(null)
  - router.push('/login')
```

### 2.4 Wrong role redirect

```
User: opens /admin?token=LOGISTICS_TOKEN

[trpc auth.me] → returns user with role='logistics'
[_layout.tsx] sees role !== 'admin' (current route's required role)
  → router.replace('/logistics-dashboard')
```

(Required role per route is hard-coded in `_layout.tsx` route matching, since per-page guards add ceremony.)

---

## 3. Error Handling

| Scenario | Behaviour |
|---|---|
| URL has no `?token=` and `localStorage` empty | Redirect to `/login` |
| URL token doesn't match any env token | Render returns 401; client clears localStorage; redirect to `/login` with error toast |
| Render is asleep (cold-start) | First request 30-60s; show full-page loading spinner (`useAuth.loading=true`) |
| Render is down | tRPC throws network error; show error page with retry button |
| Token expires (env rotated by admin) | Same as wrong token: 401 → clear → /login |
| User has correct token but visits wrong-role page | Redirect to their role's landing |

All transient errors logged to browser console; non-PII info shown in user-visible toast.

---

## 4. CORS & Build

### 4.1 Render CORS update

```
CORS_ORIGINS=https://<vercel-project>.vercel.app,http://localhost:8081,http://localhost:19006,http://localhost:3000
```

Set via Render API at deploy time (we have API key; one curl call). Existing dev origins kept for local development.

### 4.2 Vercel project config

`vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm ci && npx expo export -p web --output-dir dist",
  "outputDirectory": "dist",
  "framework": null,
  "installCommand": "echo skip-install (handled in buildCommand)",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The catch-all rewrite gives Expo Router its SPA navigation; static assets like `/_expo/static/*` short-circuit because Vercel checks file existence first.

### 4.3 Vercel env vars

| Name | Value | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://mai-touch-demo.onrender.com` | Read by `src/lib/trpc.ts` |
| `EXPO_PUBLIC_DEMO_ADMIN_TOKEN`     | (32-char random) | For login page quick-buttons (demo only — bundled into client JS) |
| `EXPO_PUBLIC_DEMO_LOGISTICS_TOKEN` | (32-char random) | Same |
| `EXPO_PUBLIC_DEMO_RESIDENT_TOKEN`  | (32-char random) | Same |

### 4.4 Render env additions

| Name | Value |
|---|---|
| `WEB_ADMIN_TOKEN`     | (matches `EXPO_PUBLIC_DEMO_ADMIN_TOKEN`) |
| `WEB_LOGISTICS_TOKEN` | (matches `EXPO_PUBLIC_DEMO_LOGISTICS_TOKEN`) |
| `WEB_RESIDENT_TOKEN`  | (matches `EXPO_PUBLIC_DEMO_RESIDENT_TOKEN`) |

These are **the same secret string** on both sides. Bundling them into the Vercel client JS is acceptable for demo (they grant role to anyone who reads the page source — same threat model as the LINE admin URL token); for production, replace with email/password or OAuth (out of scope).

---

## 5. Testing Strategy

### 5.1 Unit (vitest, in repo)

- `src/server/_core/token-auth.test.ts` — 6 cases:
  - admin token → admin user
  - logistics token → logistics user
  - resident token → resident user
  - empty token → null
  - unknown token → null
  - matching env unset → null

- `src/server/_core/context.test.ts` (extend) — verify Authorization header takes precedence over cookie

### 5.2 Integration (manual smoke)

After Vercel deploy:
1. Visit `https://<vercel>.vercel.app/admin?token=ADMIN` → should land on admin dashboard (not redirected to /login)
2. Open devtools, inspect network: Authorization header on each tRPC call
3. Visit `https://<vercel>.vercel.app/logistics-dashboard?token=ADMIN` → redirect to /admin (wrong role)
4. Visit `/login` directly, paste resident token → land on resident home
5. Hard refresh after login → still authenticated (localStorage persisted)

### 5.3 Not tested (accepted risk)

- Resident-facing pages (`wallet`, `amenities/[id]`, etc.) — out of scope, may render incorrectly on web
- IE / older browsers — Vercel & Expo target evergreen
- Cross-tab token sync — accept that closing one tab doesn't affect another

---

## 6. Files Changed

### New

```
src/server/_core/token-auth.ts              # token → synthetic user map
src/server/_core/token-auth.test.ts         # 6 unit tests
src/app/_layout.tsx                         # root layout: bootstrap token + role redirect
src/app/login.tsx                           # token paste form + quick-login buttons
vercel.json                                  # build command + SPA rewrites
docs/superpowers/specs/2026-05-03-vercel-web-deploy-design.md  # this file
```

### Modified

| File | Change |
|---|---|
| `src/server/_core/context.ts` | Read `Authorization` header → `userFromToken` → ctx.user (before existing cookie path) |
| `src/server/_core/trpc.ts` | (no change — existing `protectedProcedure`/`adminProcedure`/`logisticsProcedure`/`residentProcedure` work unchanged) |
| `src/hooks/use-auth.ts` | Remove stub Api/Auth; use `trpc.auth.me.useQuery()` + localStorage helpers |
| `src/lib/trpc.ts` | `httpBatchLink.headers()` reads `localStorage.mai_touch_demo_token`, sets `Authorization: Bearer …` |
| `src/app/index.tsx` | Add role-based redirect: `admin → /admin-dashboard`, `logistics → /logistics-dashboard`; resident sees existing chat home |
| `scripts/init-db-demo.ts` | Add INSERT OR IGNORE for users id=3 (logistics) |
| `.env.example` | Document `WEB_ADMIN_TOKEN`, `WEB_LOGISTICS_TOKEN`, `WEB_RESIDENT_TOKEN` |
| `render.yaml` | Add 3 token envs (sync:false), restore `CORS_ORIGINS` env entry |
| `package.json` | Add npm script `web:build` = `expo export -p web` for local sanity |

### Not changed

- LINE bot, dashboard, all other Render-side code — completely independent

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Vercel build fails because `expo export -p web` errors on some `react-native-only` import | Pre-test locally; if fails, mark offending pages with `if (Platform.OS !== 'web') return null` or remove from build via `_layout.tsx` route registration |
| First Render request after deploy times out (cold start) | Already mitigated by recommending cron-job.org keepalive (separate task user is responsible for) |
| Vercel free tier 100 GB bandwidth/month exhausted | Demo traffic well under threshold; if exceeded, upgrade Vercel Pro ($20/mo) |
| Tokens leaked via Vercel client JS bundle | Documented as accepted risk; tokens grant only demo role access; rotate by changing env vars on both sides |
| Cross-origin Authorization header blocked by CORS preflight | Render CORS already allows `Authorization` header; explicitly verify with `OPTIONS` preflight test |
| Existing cookie-based auth path breaks | Preserve as fallback — header check returns `null` if no token, falls through to cookie |

---

## 8. Phase Plan (preview)

| Phase | Outcome |
|---|---|
| **0** | Generate tokens, set Render env (CORS + 3 tokens), restart deploy verify |
| **1** | Backend: `token-auth.ts` + `context.ts` integration + 6 unit tests + tRPC verify with curl `Authorization: Bearer …` |
| **2** | Frontend: `useAuth` rewire + `lib/trpc` headers + `_layout.tsx` + `login.tsx` (local `npm start` verify) |
| **3** | Local `npx expo export -p web` builds clean; manually serve `dist/` via `npx serve dist` and verify auth flow |
| **4** | Vercel project setup: connect repo, set env, add `vercel.json`, deploy; verify `https://<vercel>.vercel.app/login` works |
| **5** | End-to-end smoke from production Vercel: 4 page navigation as 3 roles |
| **6** | Update README + `docs/LINE_INTEGRATION.md` with web URLs |
