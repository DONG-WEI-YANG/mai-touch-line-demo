import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/routers/index";

// TODO: Replace with real auth module when ready
// import { Auth } from "@/lib/_core/auth";
// import { getApiBaseUrl } from "@/lib/_core/api-config";

/** API base URL — reads from env or defaults to localhost */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// TODO: Replace with real Auth module for session tokens
const Auth = {
    getSessionToken: async (): Promise<string | null> => null,
};


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
                    const token = await Auth.getSessionToken();
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
