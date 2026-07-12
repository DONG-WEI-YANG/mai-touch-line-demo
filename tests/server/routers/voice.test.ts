import { describe, it, expect } from "vitest";

describe("voice router", () => {
  it("exposes the transcribe, resident, and property-desk procedures", async () => {
    const mod = await import("../../../src/server/routers/voice");
    expect(mod.voiceRouter).toBeDefined();
    const procedures = Object.keys((mod.voiceRouter as any)._def.procedures);
    expect(procedures).toEqual(
      expect.arrayContaining(["transcribe", "command", "commit", "residents", "staffCommand", "staffCommit"]),
    );
  });
});
