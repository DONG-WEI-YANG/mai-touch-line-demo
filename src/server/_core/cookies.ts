/**
 * Cookie configuration for session management
 */
import type { Request } from "express";
import type { CookieOptions } from "express";

export const COOKIE_NAME = "mai_touch_session";

/**
 * Get cookie options based on request protocol
 */
export function getSessionCookieOptions(req: Request): CookieOptions {
  const isSecure = req.protocol === "https";

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/",
  };
}
