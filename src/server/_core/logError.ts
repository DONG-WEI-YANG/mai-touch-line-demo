/**
 * Structured error logging with a stable error id.
 *
 * The server previously logged failures with bare console.error/console.warn and
 * no consistent key, so no monitor could reliably alert on them (audit finding:
 * "no logError/Sentry path in use"). logError emits one structured, greppable
 * line per failure keyed by an ErrorId, and returns that id so callers can also
 * surface it to the user/operator for support correlation.
 *
 * Dependency-free by design (no Sentry SDK). If a SENTRY_DSN is later configured,
 * forward from the single marked hand-off point below — every failure site
 * already routes through here, so wiring an aggregator is a one-place change.
 */
import type { ErrorId } from "../constants/errorIds";

function serializeCause(cause: unknown): unknown {
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message, stack: cause.stack };
  }
  return cause;
}

export function logError(
  errorId: ErrorId,
  message: string,
  opts?: { context?: Record<string, unknown>; cause?: unknown },
): ErrorId {
  const entry: Record<string, unknown> = {
    level: "error",
    errorId,
    message,
    ts: new Date().toISOString(),
  };
  if (opts?.context) entry.context = opts.context;
  if (opts && "cause" in opts) entry.cause = serializeCause(opts.cause);

  // Single hand-off point: swap/augment for Sentry.captureException(...) here.
  console.error(`[${errorId}] ${message}`, JSON.stringify(entry));

  return errorId;
}
