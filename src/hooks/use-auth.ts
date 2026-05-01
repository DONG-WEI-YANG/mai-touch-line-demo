// TODO: Replace with real API module when ready
// import * as Api from "@/lib/_core/api";
// import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

// TODO: Replace these stubs with real API/Auth modules
const Api = {
    getMe: async (): Promise<Record<string, unknown> | null> => null,
    logout: async () => { },
};
const Auth = {
    getSessionToken: async (): Promise<string | null> => null,
    setUserInfo: async (_u: Record<string, unknown>) => { },
    clearUserInfo: async () => { },
    getUserInfo: async (): Promise<Record<string, unknown> | null> => null,
    removeSessionToken: async () => { },
};

type UseAuthOptions = {
    autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
    const { autoFetch = true } = options ?? {};
    const [user, setUser] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchUser = useCallback(async () => {
        if (isDev) console.log("[useAuth] fetchUser called");
        try {
            setLoading(true);
            setError(null);

            // Web platform: use cookie-based auth, fetch user from API
            if (Platform.OS === "web") {
                const apiUser = await Api.getMe();

                if (apiUser) {
                    const userInfo = {
                        id: apiUser.id,
                        openId: apiUser.openId,
                        name: apiUser.name,
                        email: apiUser.email,
                        loginMethod: apiUser.loginMethod,
                        lastSignedIn: new Date(apiUser.lastSignedIn as string),
                    };
                    setUser(userInfo);
                    await Auth.setUserInfo(userInfo);
                } else {
                    setUser(null);
                    await Auth.clearUserInfo();
                }
                return;
            }

            // Native platform: use token-based auth
            const sessionToken = await Auth.getSessionToken();
            if (!sessionToken) {
                setUser(null);
                return;
            }

            const cachedUser = await Auth.getUserInfo();
            if (cachedUser) {
                setUser(cachedUser);
            } else {
                setUser(null);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error("Failed to fetch user");
            console.error("[useAuth] fetchUser error:", error);
            setError(error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await Api.logout();
        } catch (err) {
            console.error("[Auth] Logout API call failed:", err);
            // Continue with logout even if API call fails
        } finally {
            await Auth.removeSessionToken();
            await Auth.clearUserInfo();
            setUser(null);
            setError(null);
        }
    }, []);

    const isAuthenticated = useMemo(() => Boolean(user), [user]);

    useEffect(() => {
        if (autoFetch) {
            if (Platform.OS === "web") {
                fetchUser();
            } else {
                Auth.getUserInfo().then((cachedUser) => {
                    if (cachedUser) {
                        setUser(cachedUser);
                        setLoading(false);
                    } else {
                        fetchUser();
                    }
                });
            }
        } else {
            setLoading(false);
        }
    }, [autoFetch, fetchUser]);

    return {
        user,
        loading,
        error,
        isAuthenticated,
        refresh: fetchUser,
        logout,
    };
}
