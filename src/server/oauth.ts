/**
 * OAuth authentication routes
 * Complete OAuth implementation for m'AI Touch
 */
import type { Express } from "express";
import { oauthService } from "./auth/oauthService";
import { getOAuthConfig } from "./auth/oauthConfig";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import * as db from "./db";

/**
 * Register OAuth routes
 */
export function registerOAuthRoutes(app: Express) {
  const config = getOAuthConfig();

  // OAuth provider list
  app.get("/api/auth/providers", (_req, res) => {
    const providers = oauthService.getAvailableProviders();
    res.json({
      enabled: config.enabled,
      providers,
    });
  });

  // Initiate OAuth flow
  app.get("/api/auth/:provider", async (req, res) => {
    try {
      const { provider } = req.params;
      
      if (!config.enabled) {
        return res.status(400).json({
          error: "OAuth is not enabled",
          message: "Please contact administrator to enable OAuth",
        });
      }

      const { url, state } = await oauthService.initiateAuth(provider);

      // Set state cookie for CSRF protection
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie("oauth_state", state, {
        ...cookieOptions,
        maxAge: 10 * 60 * 1000, // 10 minutes
        httpOnly: true,
      });

      res.redirect(url);
    } catch (error) {
      console.error("OAuth initiation error:", error);
      res.status(400).json({
        error: "OAuth initiation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // OAuth callback
  app.get("/api/auth/:provider/callback", async (req, res) => {
    try {
      const { provider } = req.params;
      const { code, state, error: oauthError } = req.query;

      // Check for OAuth errors
      if (oauthError) {
        return res.status(400).json({
          error: "OAuth authorization failed",
          message: oauthError,
        });
      }

      if (!code || !state) {
        return res.status(400).json({
          error: "Missing parameters",
          message: "Code and state are required",
        });
      }

      // Validate state cookie
      const stateCookie = req.cookies?.oauth_state;
      if (!stateCookie || stateCookie !== state) {
        return res.status(400).json({
          error: "Invalid state",
          message: "CSRF protection failed",
        });
      }

      // Clear state cookie
      res.clearCookie("oauth_state");

      // Handle OAuth callback
      const user = await oauthService.handleCallback(
        provider,
        code as string,
        state as string
      );

      // Create session
      const sessionToken = await db.createSession({
        userId: user.id,
        provider: user.provider,
        expiresAt: new Date(Date.now() + config.sessionMaxAge),
      });

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: config.sessionMaxAge,
      });

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8081";
      res.redirect(`${frontendUrl}/auth/success?user=${encodeURIComponent(JSON.stringify(user))}`);
    } catch (error) {
      console.error("OAuth callback error:", error);
      
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8081";
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(errorMessage)}`);
    }
  });

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    try {
      const sessionToken = req.cookies?.[COOKIE_NAME];
      if (!sessionToken) {
        return res.status(401).json({
          error: "Not authenticated",
          message: "No session token found",
        });
      }

      const session = await db.getSession(sessionToken);
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({
          error: "Session expired",
          message: "Please login again",
        });
      }

      const user = await db.getUserById(session.userId);
      if (!user) {
        return res.status(404).json({
          error: "User not found",
          message: "User account may have been deleted",
        });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        loginMethod: user.loginMethod,
        lastSignedIn: user.lastSignedIn,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to get user information",
      });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const sessionToken = req.cookies?.[COOKIE_NAME];
      if (sessionToken) {
        await db.deleteSession(sessionToken);
      }

      // Clear session cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        error: "Logout failed",
        message: "Failed to logout",
      });
    }
  });

  // Refresh session
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const sessionToken = req.cookies?.[COOKIE_NAME];
      if (!sessionToken) {
        return res.status(401).json({
          error: "Not authenticated",
          message: "No session token found",
        });
      }

      const session = await db.getSession(sessionToken);
      if (!session) {
        return res.status(401).json({
          error: "Session expired",
          message: "Please login again",
        });
      }

      // Extend session
      const newExpiresAt = new Date(Date.now() + config.sessionMaxAge);
      await db.updateSession(sessionToken, { expiresAt: newExpiresAt });

      // Update cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: config.sessionMaxAge,
      });

      res.json({
        success: true,
        message: "Session refreshed",
        expiresAt: newExpiresAt,
      });
    } catch (error) {
      console.error("Refresh session error:", error);
      res.status(500).json({
        error: "Refresh failed",
        message: "Failed to refresh session",
      });
    }
  });

  console.log("[OAuth] Routes registered");
  console.log(`[OAuth] Enabled: ${config.enabled}`);
  console.log(`[OAuth] Available providers: ${oauthService.getAvailableProviders().join(", ")}`);
}
