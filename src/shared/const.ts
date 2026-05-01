/**
 * Shared constants between client and server
 */

export const COOKIE_NAME = "mai_touch_session";

export const API_ENDPOINTS = {
  HEALTH: "/api/health",
  TRPC: "/api/trpc",
  ADMIN: "/admin",
  AUTH_CALLBACK: "/auth/callback",
  AUTH_LOGIN: "/auth/login",
  AUTH_LOGOUT: "/auth/logout",
};

export const NLP_INTENTS = [
  "amenity_booking",
  "maintenance_request",
  "security_concern",
  "noise_complaint",
  "guest_management",
  "space_control",
  "privacy_request",
  "concierge_service",
  "lifestyle_service",
  "emergency",
  "greeting",
  "farewell",
  "question",
  "complaint",
  "feedback",
  "cancel_request",
  "modify_request",
  "status_inquiry",
  "general_inquiry",
  "other",
] as const;

export type NLPIntent = (typeof NLP_INTENTS)[number];

export const EMOTIONS = [
  "neutral",
  "fatigue",
  "urgency",
  "frustration",
  "satisfaction",
  "discretion_needed",
  "emergency",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export const URGENCY_LEVELS = ["low", "medium", "high", "critical"] as const;

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];
