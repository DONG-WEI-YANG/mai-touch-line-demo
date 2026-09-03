import { describe, expect, it } from "vitest";

import { normalizeRecordingMetering } from "../src/lib/audio-metering";

describe("voice recording metering", () => {
  it.each([
    { metering: undefined, expected: 0 },
    { metering: Number.NaN, expected: 0 },
    { metering: -200, expected: 0 },
    { metering: -160, expected: 0 },
    { metering: -80, expected: 0.5 },
    { metering: 0, expected: 1 },
    { metering: 20, expected: 1 },
  ])("maps $metering dB to $expected", ({ metering, expected }) => {
    expect(normalizeRecordingMetering(metering)).toBe(expected);
  });
});
