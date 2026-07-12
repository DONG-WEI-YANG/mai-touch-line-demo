import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logError } from "../../src/server/_core/logError";
import { ErrorIds } from "../../src/server/constants/errorIds";

describe("logError", () => {
  let spy: any;
  beforeEach(() => { spy = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { spy.mockRestore(); });

  it("emits the errorId + message and returns the errorId for support correlation", () => {
    const id = logError(ErrorIds.DB_UNAVAILABLE, "cannot reach db");
    expect(id).toBe(ErrorIds.DB_UNAVAILABLE);
    const line = spy.mock.calls[0].join(" ");
    expect(line).toContain(ErrorIds.DB_UNAVAILABLE);
    expect(line).toContain("cannot reach db");
  });

  it("includes structured context and a serialized Error cause (message + stack)", () => {
    logError(ErrorIds.BOOT_MIGRATION_FAILED, "migration failed", {
      context: { version: "0009" },
      cause: new Error("no such column"),
    });
    const payload = spy.mock.calls[0].join(" ");
    expect(payload).toContain("0009");
    expect(payload).toContain("no such column");
  });

  it("does not throw on a non-Error cause", () => {
    expect(() => logError(ErrorIds.AUTH_TOKEN_LOOKUP_FAILED, "x", { cause: "weird string" })).not.toThrow();
  });

  it("errorIds registry values are unique", () => {
    const values = Object.values(ErrorIds);
    expect(new Set(values).size).toBe(values.length);
  });
});
