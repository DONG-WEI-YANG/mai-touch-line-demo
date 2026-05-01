/**
 * OAuth Configuration
 * Configuration for OAuth providers
 */

import { env } from '../_core/env';

export type OAuthProvider = 'google' | 'apple' | 'microsoft' | 'github' | 'custom';

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  redirectUri: string;
}

export interface OAuthConfig {
  enabled: boolean;
  providers: Record<OAuthProvider, OAuthProviderConfig | null>;
  sessionSecret: string;
  sessionMaxAge: number;
  cookieDomain?: string;
  cookieSecure: boolean;
}

/**
 * Get OAuth configuration from environment variables
 */
export function getOAuthConfig(): OAuthConfig {
  const baseUrl = env.baseUrl || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/auth/callback`;

  return {
    enabled: env.oauthEnabled === true,
    sessionSecret: env.sessionSecret || 'your-session-secret-change-in-production',
    sessionMaxAge: env.sessionMaxAge,
    cookieDomain: env.cookieDomain,
    cookieSecure: env.nodeEnv === 'production',

    providers: {
      google: env.googleClientId ? {
        clientId: env.googleClientId,
        clientSecret: env.googleClientSecret || '',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
        scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        redirectUri,
      } : null,

      apple: env.appleClientId ? {
        clientId: env.appleClientId,
        clientSecret: env.appleClientSecret || '',
        authorizationUrl: 'https://appleid.apple.com/auth/authorize',
        tokenUrl: 'https://appleid.apple.com/auth/token',
        userInfoUrl: 'https://appleid.apple.com/auth/userinfo',
        scope: 'name email',
        redirectUri,
      } : null,

      microsoft: env.microsoftClientId ? {
        clientId: env.microsoftClientId,
        clientSecret: env.microsoftClientSecret || '',
        authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        scope: 'User.Read',
        redirectUri,
      } : null,

      github: env.githubClientId ? {
        clientId: env.githubClientId,
        clientSecret: env.githubClientSecret || '',
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scope: 'read:user user:email',
        redirectUri,
      } : null,

      custom: env.customOauthClientId ? {
        clientId: env.customOauthClientId,
        clientSecret: env.customOauthClientSecret || '',
        authorizationUrl: env.customOauthAuthorizationUrl || '',
        tokenUrl: env.customOauthTokenUrl || '',
        userInfoUrl: env.customOauthUserinfoUrl || '',
        scope: env.customOauthScope || 'openid profile email',
        redirectUri,
      } : null,
    },
  };
}

/**
 * Check if OAuth provider is configured
 */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  const config = getOAuthConfig();
  return config.enabled && config.providers[provider] !== null;
}

/**
 * Get configured providers
 */
export function getConfiguredProviders(): OAuthProvider[] {
  const config = getOAuthConfig();
  if (!config.enabled) return [];

  return Object.entries(config.providers)
    .filter(([_, providerConfig]) => providerConfig !== null)
    .map(([provider]) => provider as OAuthProvider);
}

/**
 * Get provider configuration
 */
export function getProviderConfig(provider: OAuthProvider): OAuthProviderConfig | null {
  const config = getOAuthConfig();
  return config.providers[provider];
}

/**
 * Generate OAuth state parameter for CSRF protection
 */
export function generateState(): string {
  return Buffer.from(Math.random().toString(36).substring(2) + Date.now().toString(36)).toString('base64');
}

/**
 * Generate PKCE code verifier and challenge
 */
export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  // Generate random code verifier
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = Buffer.from(array).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Generate code challenge
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = Buffer.from(hash).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return { codeVerifier, codeChallenge };
}

/**
 * Validate OAuth state parameter
 */
export function validateState(storedState: string, receivedState: string): boolean {
  return storedState === receivedState;
}

/**
 * Get OAuth authorization URL
 */
export function getAuthorizationUrl(provider: OAuthProvider, state: string, codeChallenge?: string): string | null {
  const config = getProviderConfig(provider);
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    state,
    ...(codeChallenge ? {
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    } : {}),
  });

  return `${config.authorizationUrl}?${params.toString()}`;
}