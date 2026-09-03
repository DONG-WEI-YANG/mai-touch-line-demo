import { describe, expect, it } from "vitest";

import { getSystemStatusPresentation } from "../src/lib/system-status";

describe("getSystemStatusPresentation", () => {
  it("maps every diagnostic state to a truthful tone and bilingual label", () => {
    expect(getSystemStatusPresentation("healthy", "zh")).toEqual({ label: "運作正常", tone: "success" });
    expect(getSystemStatusPresentation("degraded", "en")).toEqual({ label: "Needs attention", tone: "warning" });
    expect(getSystemStatusPresentation("unavailable", "zh")).toEqual({ label: "無法使用", tone: "error" });
    expect(getSystemStatusPresentation("unconfigured", "en")).toEqual({ label: "Not configured", tone: "muted" });
  });

  it("never renders an unknown value as healthy", () => {
    expect(getSystemStatusPresentation("unexpected", "en")).toEqual({
      label: "Unknown status",
      tone: "muted",
    });
  });
});
