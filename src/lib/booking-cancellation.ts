interface CancellationDependencies {
  isOnline: () => boolean;
  cancel: (id: number) => Promise<unknown>;
  queue: (id: number) => Promise<unknown>;
}

function isTransportError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { data?: { httpStatus?: number; code?: string }; message?: string; cause?: unknown };
  // A structured server rejection must remain visible, even if its message
  // happens to mention networking. Replaying it cannot make it valid.
  if (value.data?.httpStatus || value.data?.code) return false;
  return error instanceof TypeError || value.cause instanceof TypeError
    || /failed to fetch|network request failed|networkerror|fetch failed/i.test(value.message ?? "");
}

/** Queue persistence failures propagate: queued never means server-confirmed. */
export async function cancelBooking(id: number, deps: CancellationDependencies): Promise<"confirmed" | "queued"> {
  if (deps.isOnline()) {
    try {
      await deps.cancel(id);
      return "confirmed";
    } catch (error) {
      if (!isTransportError(error)) throw error;
    }
  }
  await deps.queue(id);
  return "queued";
}
