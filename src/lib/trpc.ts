import { createTRPCReact } from "@trpc/react-query";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "../server/routers/index";

/** 每支 query/mutation 的回傳型別,例如 RouterOutputs["showcase"]["session"]。 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

/** API base URL — reads from env or defaults to localhost */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// ── localStorage token helpers ────────────────────────────────────────────────
const TOKEN_STORAGE_KEY = 'mai_touch_demo_token';

// Synchronous URL→localStorage bootstrap. Runs at module import time, BEFORE
// any React component or tRPC call. This guarantees the Authorization header
// is set on the first useQuery in the app — without it, tRPC fires the first
// request as anonymous and protectedProcedure returns 403, even though the
// URL had a valid ?token=... that would have worked.
if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
  try {
    const url = new URL(window.location.href);
    const t = url.searchParams.get('token');
    if (t) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, t);
      url.searchParams.delete('token');
      const qs = url.searchParams.toString();
      window.history.replaceState({}, '', url.pathname + (qs ? '?' + qs : '') + url.hash);
    }
  } catch { /* non-browser or sandboxed: no-op */ }
}

export function getStoredToken(): string | null {
  if (typeof globalThis.localStorage === 'undefined') return null;
  try { return globalThis.localStorage.getItem(TOKEN_STORAGE_KEY); }
  catch { return null; }
}

export function setStoredToken(token: string): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  try { globalThis.localStorage.setItem(TOKEN_STORAGE_KEY, token); } catch {}
  if(typeof window!=='undefined') window.dispatchEvent(new Event('mai-touch-account-changed'));
}

/** 本機是否存有 token —— authGate 用它判斷「查不出來」該留在原地還是導向登入。 */
export function hasStoredToken(): boolean {
  return !!getStoredToken();
}

export function clearStoredToken(): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  try { globalThis.localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
  if(typeof window!=='undefined') window.dispatchEvent(new Event('mai-touch-account-changed'));
}

export async function offlineOwner(token = getStoredToken()): Promise<string | null> {
  if (!token || !globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

/** Captures the credential before any batching; account switches cannot retarget a queued write. */
export async function offlineClient(owner: string | undefined) {
  const token=getStoredToken();
  if (!owner || !token || owner!==await offlineOwner(token)) throw new Error('請切回原帳戶同步');
  return createTRPCProxyClient<AppRouter>({transformer:superjson,links:[httpBatchLink({
    url:`${API_BASE_URL}/api/trpc`,headers:()=>({Authorization:`Bearer ${token}`}),
    fetch:(url,options)=>fetch(url,{...options,credentials:'omit'}),
  })]});
}

/**
 * tRPC React client for type-safe API calls.
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
    return trpc.createClient({
        transformer: superjson,
        links: [
            httpBatchLink({
                url: `${API_BASE_URL}/api/trpc`,
                async headers() {
                    const token = getStoredToken();
                    return token ? { Authorization: `Bearer ${token}` } : {};
                },
                // Custom fetch to include credentials for cookie-based auth
                fetch(url, options) {
                    return fetch(url, {
                        ...options,
                        credentials: "include",
                    });
                },
            }),
        ],
    });
}

/**
 * Vanilla (non-React) proxy client for code that needs to call tRPC procedures
 * outside the React tree — e.g. the offline sync handler in `lib/offline.ts`.
 * Uses the same Authorization header / credentials behaviour as the React client.
 */
export const trpcProxy = createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
        httpBatchLink({
            url: `${API_BASE_URL}/api/trpc`,
            async headers() {
                const token = getStoredToken();
                return token ? { Authorization: `Bearer ${token}` } : {};
            },
            fetch(url, options) {
                return fetch(url, {
                    ...options,
                    credentials: "include",
                });
            },
        }),
    ],
});
