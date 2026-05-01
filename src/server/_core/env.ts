/**
 * Environment variables configuration
 */

export const ENV = {
  // General
  nodeEnv: process.env.NODE_ENV || "development",
  
  // Database
  databaseUrl: process.env.DATABASE_URL || "",
  dbType: process.env.DB_TYPE || "sqlite",
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: process.env.DB_PORT || "3306",
  dbUser: process.env.DB_USER || "root",
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME || "mai_touch",
  sqliteFilename: process.env.SQLITE_FILENAME || "./data/mai-touch.db",
  
  // OAuth
  ownerOpenId: process.env.OWNER_OPEN_ID || "",
  oauthEnabled: process.env.OAUTH_ENABLED === "true",
  sessionSecret: process.env.SESSION_SECRET || "change-this-secret-in-production",
  sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || "86400000"),
  cookieDomain: process.env.COOKIE_DOMAIN,
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:8081",
  
  // OAuth Providers
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  appleClientId: process.env.APPLE_CLIENT_ID || "",
  appleClientSecret: process.env.APPLE_CLIENT_SECRET || "",
  microsoftClientId: process.env.MICROSOFT_CLIENT_ID || "",
  microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
  githubClientId: process.env.GITHUB_CLIENT_ID || "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  customOauthClientId: process.env.CUSTOM_OAUTH_CLIENT_ID || "",
  customOauthClientSecret: process.env.CUSTOM_OAUTH_CLIENT_SECRET || "",
  customOauthAuthorizationUrl: process.env.CUSTOM_OAUTH_AUTHORIZATION_URL || "",
  customOauthTokenUrl: process.env.CUSTOM_OAUTH_TOKEN_URL || "",
  customOauthUserinfoUrl: process.env.CUSTOM_OAUTH_USERINFO_URL || "",
  customOauthScope: process.env.CUSTOM_OAUTH_SCOPE || "openid profile email",
  
  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  
  // Storage
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL || "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || "",
  
  // NLP Service
  nlpServiceUrl: process.env.NLP_SERVICE_URL || "http://localhost:8000",
  nlpServiceEnabled: process.env.NLP_SERVICE_ENABLED === "true",
  nlpServiceTimeout: parseInt(process.env.NLP_SERVICE_TIMEOUT || "5000"),
  
  // Email Service
  emailHost: process.env.EMAIL_HOST || "",
  emailPort: process.env.EMAIL_PORT || "587",
  emailUser: process.env.EMAIL_USER || "",
  emailPass: process.env.EMAIL_PASS || "",
  emailFrom: process.env.EMAIL_FROM || "",
  emailDryRun: process.env.EMAIL_DRY_RUN === "true",
  
  // SMS Service
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  smsDryRun: process.env.SMS_DRY_RUN === "true",
  
  // Server
  port: parseInt(process.env.PORT || "3000"),
  
  // CORS
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:8081,http://localhost:19006").split(","),
  
  // Rate Limiting
  trustedIps: (process.env.TRUSTED_IPS || "127.0.0.1,::1").split(","),
  
  // Cache
  cacheTtl: parseInt(process.env.CACHE_TTL || "300"),
  
  // Notifications
  pushNotificationsEnabled: process.env.PUSH_NOTIFICATIONS_ENABLED === "true",
  expoProjectId: process.env.EXPO_PROJECT_ID || "",
  
  // Offline
  offlineSyncInterval: parseInt(process.env.OFFLINE_SYNC_INTERVAL || "30000"),
  offlineMaxRetries: parseInt(process.env.OFFLINE_MAX_RETRIES || "3"),
  
  // Development
  debug: process.env.DEBUG === "true",
  logLevel: process.env.LOG_LEVEL || "info",
};

export const env = ENV; // Alias for convenience

// Validate required environment variables
export function validateEnv() {
  const required = [
    { key: "OPENAI_API_KEY", value: ENV.openaiApiKey, optional: ENV.nodeEnv !== "production" },
  ];

  const missing = required.filter(({ value, optional }) => !value && !optional);

  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    missing.forEach(({ key }) => console.error(`  - ${key}`));
    throw new Error("Missing required environment variables");
  }

  const warnings = required.filter(({ value, optional }) => !value && optional);
  if (warnings.length > 0) {
    console.warn("⚠️  Missing optional environment variables (using defaults):");
    warnings.forEach(({ key }) => console.warn(`  - ${key}`));
  }
}
