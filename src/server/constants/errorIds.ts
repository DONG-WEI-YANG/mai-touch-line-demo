/**
 * Stable error-id registry. Each id is a short, greppable, alert-friendly slug
 * passed to logError() at a failure site. Keeping them centralised means log
 * dashboards / alerts can key off a fixed vocabulary, and support can correlate a
 * user-facing "error id" back to a specific code path.
 *
 * Add new ids here rather than inlining string literals at call sites.
 */
export const ErrorIds = {
  // Boot / schema
  BOOT_MIGRATION_FAILED: "boot.migration_failed",
  BOOT_SEED_FAILED: "boot.seed_failed",
  LINE_DISPATCHER_SETUP_FAILED: "line.dispatcher_setup_failed",

  // Data layer
  DB_UNAVAILABLE: "db.unavailable",

  // Auth
  AUTH_TOKEN_LOOKUP_FAILED: "auth.token_lookup_failed",

  // Hardware / IoT
  HARDWARE_DISPATCH_FAILED: "hardware.dispatch_failed",

  // Admin dashboards
  ADMIN_RENDER_FAILED: "admin.render_failed",

  // Google Smart Home fulfillment
  GOOGLE_FULFILLMENT_ERROR: "google.fulfillment_error",
} as const;

export type ErrorId = (typeof ErrorIds)[keyof typeof ErrorIds];
