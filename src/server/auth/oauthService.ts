/**
 * OAuth Service
 * Handles OAuth authentication flows
 */

import { getOAuthConfig, getProviderConfig, generateState, generatePKCE, getAuthorizationUrl } from './oauthConfig';
import * as db from '../db';

export type OAuthUser = {
  id: number;
  email: string;
  name: string;
  picture?: string;
  provider: string;
  providerId: string;
};

export type OAuthToken = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
};

export class OAuthService {
  private static instance: OAuthService;
  private stateStore = new Map<string, { provider: string; codeVerifier?: string; expiresAt: number }>();

  private constructor() {
    // Clean up expired states every hour
    setInterval(() => this.cleanupExpiredStates(), 60 * 60 * 1000);
  }

  static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }
    return OAuthService.instance;
  }

  /**
   * Clean up expired state parameters
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, data] of this.stateStore.entries()) {
      if (data.expiresAt < now) {
        this.stateStore.delete(state);
      }
    }
  }

  /**
   * Store state parameter
   */
  private storeState(state: string, provider: string, codeVerifier?: string): void {
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    this.stateStore.set(state, { provider, codeVerifier, expiresAt });
  }

  /**
   * Get state data
   */
  private getState(state: string): { provider: string; codeVerifier?: string; expiresAt: number } | null {
    return this.stateStore.get(state) || null;
  }

  /**
   * Remove state
   */
  private removeState(state: string): void {
    this.stateStore.delete(state);
  }

  /**
   * Initiate OAuth flow
   */
  async initiateAuth(provider: string): Promise<{ url: string; state: string }> {
    const config = getOAuthConfig();
    if (!config.enabled) {
      throw new Error('OAuth is not enabled');
    }

    const providerConfig = getProviderConfig(provider as any);
    if (!providerConfig) {
      throw new Error(`OAuth provider ${provider} is not configured`);
    }

    // Generate state for CSRF protection
    const state = generateState();

    // Generate PKCE for providers that support it
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

    if (provider === 'apple' || provider === 'microsoft') {
      const pkce = await generatePKCE();
      codeVerifier = pkce.codeVerifier;
      codeChallenge = pkce.codeChallenge;
    }

    // Store state
    this.storeState(state, provider, codeVerifier);

    // Get authorization URL
    const url = getAuthorizationUrl(provider as any, state, codeChallenge);
    if (!url) {
      throw new Error(`Failed to generate authorization URL for ${provider}`);
    }

    return { url, state };
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(provider: string, code: string, state: string): Promise<OAuthUser> {
    const config = getOAuthConfig();
    if (!config.enabled) {
      throw new Error('OAuth is not enabled');
    }

    // Validate state
    const stateData = this.getState(state);
    if (!stateData) {
      throw new Error('Invalid state parameter');
    }

    if (stateData.provider !== provider) {
      throw new Error('State provider mismatch');
    }

    // Remove state after validation
    this.removeState(state);

    // Exchange code for tokens
    const tokens = await this.exchangeCode(provider, code, stateData.codeVerifier);
    
    // Get user info
    const userInfo = await this.getUserInfo(provider, tokens.accessToken);
    
    // Create or update user in database
    const user = await this.upsertUser(provider, userInfo);
    
    return user;
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCode(provider: string, code: string, codeVerifier?: string): Promise<OAuthToken> {
    const providerConfig = getProviderConfig(provider as any);
    if (!providerConfig) {
      throw new Error(`OAuth provider ${provider} is not configured`);
    }

    const params = new URLSearchParams({
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: providerConfig.redirectUri,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });

    const response = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokenData = await response.json() as any;
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
    };
  }

  /**
   * Get user info from OAuth provider
   */
  private async getUserInfo(provider: string, accessToken: string): Promise<any> {
    const providerConfig = getProviderConfig(provider as any);
    if (!providerConfig) {
      throw new Error(`OAuth provider ${provider} is not configured`);
    }

    const response = await fetch(providerConfig.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get user info: ${error}`);
    }

    return await response.json();
  }

  /**
   * Create or update user in database
   */
  private async upsertUser(provider: string, userInfo: any): Promise<OAuthUser> {
    // Extract user info based on provider
    let email: string;
    let name: string;
    let picture: string | undefined;
    let providerId: string;

    switch (provider) {
      case 'google':
        email = userInfo.email;
        name = userInfo.name;
        picture = userInfo.picture;
        providerId = userInfo.sub;
        break;

      case 'apple':
        email = userInfo.email;
        name = userInfo.name || userInfo.email.split('@')[0];
        providerId = userInfo.sub;
        break;

      case 'microsoft':
        email = userInfo.mail || userInfo.userPrincipalName;
        name = userInfo.displayName;
        picture = undefined; // Microsoft Graph doesn't provide picture by default
        providerId = userInfo.id;
        break;

      case 'github':
        email = userInfo.email;
        name = userInfo.name || userInfo.login;
        picture = userInfo.avatar_url;
        providerId = userInfo.id.toString();
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    if (!email) {
      throw new Error('Email is required but not provided by OAuth provider');
    }

    // Check if user exists
    let user = await db.getUserByEmail(email);
    
    if (user) {
      // Update existing user
      await db.updateUser(user.id, {
        name,
        picture,
        lastSignedIn: new Date(),
      });
    } else {
      // Create new user
      user = await db.createUser({
        email,
        name,
        picture,
        loginMethod: provider,
        openId: providerId,
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      provider,
      providerId,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(provider: string, refreshToken: string): Promise<OAuthToken> {
    const providerConfig = getProviderConfig(provider as any);
    if (!providerConfig) {
      throw new Error(`OAuth provider ${provider} is not configured`);
    }

    const params = new URLSearchParams({
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const tokenData = await response.json() as any;
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
    };
  }

  /**
   * Revoke token
   */
  async revokeToken(provider: string, _token: string, tokenType: 'access_token' | 'refresh_token' = 'access_token'): Promise<boolean> {
    // Not all providers support token revocation
    // This is a placeholder implementation
    console.log(`Token revoked for ${provider}: ${tokenType}`);
    return true;
  }

  /**
   * Get available OAuth providers
   */
  getAvailableProviders(): string[] {
    const config = getOAuthConfig();
    if (!config.enabled) return [];

    return Object.entries(config.providers)
      .filter(([_, providerConfig]) => providerConfig !== null)
      .map(([provider]) => provider);
  }

  /**
   * Check if OAuth is enabled
   */
  isEnabled(): boolean {
    const config = getOAuthConfig();
    return config.enabled;
  }
}

// Export singleton instance
export const oauthService = OAuthService.getInstance();