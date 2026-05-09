import { createTRPCReact } from "@trpc/react-query";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/routers/index";

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

function getStoredToken(): string | null {
  if (typeof globalThis.localStorage === 'undefined') return null;
  try { return globalThis.localStorage.getItem(TOKEN_STORAGE_KEY); }
  catch { return null; }
}

export function setStoredToken(token: string): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  try { globalThis.localStorage.setItem(TOKEN_STORAGE_KEY, token); } catch {}
}

export function clearStoredToken(): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  try { globalThis.localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
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
