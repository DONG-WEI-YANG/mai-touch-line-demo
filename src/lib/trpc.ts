import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/routers/index";

/** API base URL — reads from env or defaults to localhost */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// ── localStorage token helpers ────────────────────────────────────────────────
const TOKEN_STORAGE_KEY = 'mai_touch_demo_token';

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
