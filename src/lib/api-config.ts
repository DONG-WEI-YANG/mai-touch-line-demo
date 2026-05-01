/**
 * API Configuration
 * Centralized API endpoints and configuration
 * 
 * 預留給未來真實主機使用
 */

// API Base URLs
export const API_CONFIG = {
  // Development
  development: {
    apiUrl: "http://localhost:3000",
    nlpUrl: "http://localhost:8000",
    wsUrl: "ws://localhost:3000",
  },
  
  // Staging (預留)
  staging: {
    apiUrl: "https://staging-api.maitouch.com",
    nlpUrl: "https://staging-nlp.maitouch.com",
    wsUrl: "wss://staging-api.maitouch.com",
  },
  
  // Production (預留)
  production: {
    apiUrl: "https://api.maitouch.com",
    nlpUrl: "https://nlp.maitouch.com",
    wsUrl: "wss://api.maitouch.com",
  },
};

// Get current environment
export function getEnvironment(): keyof typeof API_CONFIG {
  if (typeof window === "undefined") {
    // Server-side
    return (process.env.NODE_ENV as keyof typeof API_CONFIG) || "development";
  }
  
  // Client-side
  const hostname = window.location.hostname;
  
  if (hostname.includes("staging")) {
    return "staging";
  }
  
  if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
    return "development";
  }
  
  return "production";
}

// Get API base URL
export function getApiBaseUrl(): string {
  const env = getEnvironment();
  return API_CONFIG[env].apiUrl;
}

// Get NLP service URL
export function getNlpBaseUrl(): string {
  const env = getEnvironment();
  return API_CONFIG[env].nlpUrl;
}

// Get WebSocket URL
export function getWsBaseUrl(): string {
  const env = getEnvironment();
  return API_CONFIG[env].wsUrl;
}

// API Endpoints
export const ENDPOINTS = {
  // Health
  HEALTH: "/api/health",
  
  // tRPC
  TRPC: "/api/trpc",
  
  // Auth
  AUTH_LOGIN: "/auth/login",
  AUTH_LOGOUT: "/auth/logout",
  AUTH_CALLBACK: "/auth/callback",
  
  // Admin
  ADMIN_DASHBOARD: "/admin",
  ADMIN_USERS: "/admin/users",
  ADMIN_BOOKINGS: "/admin/bookings",
  ADMIN_WORK_ORDERS: "/admin/work-orders",
  
  // NLP Service
  NLP_ANALYZE: "/analyze",
  NLP_BATCH: "/batch-analyze",
  NLP_HEALTH: "/health",
  NLP_STATS: "/stats",
};

// Request timeout configuration
export const TIMEOUTS = {
  DEFAULT: 10000, // 10 seconds
  UPLOAD: 60000, // 60 seconds
  NLP: 5000, // 5 seconds
  VOICE: 30000, // 30 seconds
};

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_FACTOR: 2,
};

/**
 * Build full API URL
 */
export function buildApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${endpoint}`;
}

/**
 * Build full NLP URL
 */
export function buildNlpUrl(endpoint: string): string {
  const baseUrl = getNlpBaseUrl();
  return `${baseUrl}${endpoint}`;
}

/**
 * Check if API is available
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(buildApiUrl(ENDPOINTS.HEALTH), {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if NLP service is available
 */
export async function checkNlpHealth(): Promise<boolean> {
  try {
    const response = await fetch(buildNlpUrl(ENDPOINTS.NLP_HEALTH), {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
