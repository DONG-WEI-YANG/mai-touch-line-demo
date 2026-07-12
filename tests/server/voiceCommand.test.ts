import { describe, it, expect, vi } from "vitest";
import {
  buildVoiceProposal,
  commitVoiceProposal,
  deriveEndTime,
  urgencyToPriority,
  buildFacilityMap,
} from "../../src/server/_core/voiceCommand";

// Mirrors the `mkAi` mock in tests/line/handlers-resident.test.ts — a classifier
// whose classify() resolves to a fixed IntentResult, so tests feed a transcript
// string and skip STT + the real NLP service entirely.
const mkAi = (result: any) => ({ classify: vi.fn().mockResolvedValue(result) });

describe("buildVoiceProposal", () => {
  it("facility.book with all slots → kind 'booking', nothing missing", async () => {
    const classifier = mkAi({
      intent: "facility.book",
      confidence: 0.95,
      slots: { facility: "gym", date: "2026-07-13", time: "19:00" },
      language: "zh-TW",
    });
    const p = await buildVoiceProposal({ transcript: "預約明天晚上七點健身房", classifier, userId: "42" });
    expect(p.kind).toBe("booking");
    expect(p.intent).toBe("facility.book");
    expect(p.missing).toEqual([]);
    expect(p.slots.facility).toBe("gym");
  });

  it("facility.book missing date+time → lists them in `missing`", async () => {
    const classifier = mkAi({
      intent: "facility.book",
      confidence: 0.9,
      slots: { facility: "pool" },
      language: "zh-TW",
    });
    const p = await buildVoiceProposal({ transcript: "我要訂游泳池", classifier, userId: "42" });
    expect(p.kind).toBe("booking");
    expect(p.missing).toEqual(["date", "time"]);
  });

  it("confidence below threshold → kind 'unclear'", async () => {
    const classifier = mkAi({ intent: "facility.book", confidence: 0.4, slots: {}, language: "zh-TW" });
    const p = await buildVoiceProposal({ transcript: "嗯那個…", classifier, userId: "42" });
    expect(p.kind).toBe("unclear");
  });

  it("intent 'unknown' → kind 'unclear'", async () => {
    const classifier = mkAi({ intent: "unknown", confidence: 0.99, slots: {}, language: "zh-TW" });
    const p = await buildVoiceProposal({ transcript: "今天天氣真好", classifier, userId: "42" });
    expect(p.kind).toBe("unclear");
  });

  it("repair.report → kind 'work_order' with required slots computed", async () => {
    const classifier = mkAi({
      intent: "repair.report",
      confidence: 0.9,
      slots: { issue: "漏水" },
      language: "zh-TW",
    });
    const p = await buildVoiceProposal({ transcript: "浴室漏水", classifier, userId: "42" });
    expect(p.kind).toBe("work_order");
    expect(p.missing).toEqual(["location", "urgency"]);
  });

  it("facility.list → kind 'query' (never creates anything)", async () => {
    const classifier = mkAi({ intent: "facility.list", confidence: 0.9, slots: {}, language: "zh-TW" });
    const p = await buildVoiceProposal({ transcript: "有哪些公設", classifier, userId: "42" });
    expect(p.kind).toBe("query");
    expect(p.missing).toEqual([]);
  });

  it("empty transcript → kind 'unclear' without calling the classifier", async () => {
    const classifier = mkAi({ intent: "facility.book", confidence: 0.95, slots: {}, language: "zh-TW" });
    const p = await buildVoiceProposal({ transcript: "   ", classifier, userId: "42" });
    expect(p.kind).toBe("unclear");
    expect(classifier.classify).not.toHaveBeenCalled();
  });
});

describe("commitVoiceProposal — facility.book", () => {
  const deps = () => ({
    resolveAmenityId: vi.fn((f: string) => (f === "gym" ? 3 : undefined)),
    createBooking: vi.fn().mockResolvedValue(77),
    createWorkOrder: vi.fn(),
    assertBookingAllowed: vi.fn().mockResolvedValue(undefined),
  });

  it("creates a booking with resolved amenityId + derived endTime, returns BK-ref", async () => {
    const d = deps();
    const ref = await commitVoiceProposal({
      intent: "facility.book",
      slots: { facility: "gym", date: "2026-07-13", time: "19:00" },
      userId: 42,
      deps: d,
    });
    expect(d.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, amenityId: 3, date: "2026-07-13", startTime: "19:00", endTime: "20:00" }),
    );
    expect(ref).toEqual({ ref: "BK-77" });
    expect(d.createWorkOrder).not.toHaveBeenCalled();
  });

  it("checks capacity before writing, and does not write when the slot is full (C1)", async () => {
    const d = deps();
    // Simulate an over-capacity slot: the capacity guard rejects.
    d.assertBookingAllowed = vi.fn().mockRejectedValue(new Error("Capacity exceeded"));
    await expect(
      commitVoiceProposal({
        intent: "facility.book",
        slots: { facility: "gym", date: "2026-07-20", time: "19:00" },
        userId: 42,
        deps: d,
      }),
    ).rejects.toThrow(/capacity/i);
    expect(d.assertBookingAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ amenityId: 3, date: "2026-07-20", startTime: "19:00", guestCount: 1 }),
    );
    expect(d.createBooking).not.toHaveBeenCalled();
  });

  it("rejects a booking whose required slots are incomplete", async () => {
    const d = deps();
    await expect(
      commitVoiceProposal({ intent: "facility.book", slots: { facility: "gym" }, userId: 42, deps: d }),
    ).rejects.toThrow();
    expect(d.createBooking).not.toHaveBeenCalled();
  });

  it("rejects an invalid date string without writing (C2)", async () => {
    const d = deps();
    await expect(
      commitVoiceProposal({
        intent: "facility.book",
        slots: { facility: "gym", date: "下週一", time: "19:00" },
        userId: 42,
        deps: d,
      }),
    ).rejects.toThrow();
    expect(d.createBooking).not.toHaveBeenCalled();
  });

  it("rejects an invalid time string without writing (C2)", async () => {
    const d = deps();
    await expect(
      commitVoiceProposal({
        intent: "facility.book",
        slots: { facility: "gym", date: "2026-07-20", time: "下午三點" },
        userId: 42,
        deps: d,
      }),
    ).rejects.toThrow();
    expect(d.createBooking).not.toHaveBeenCalled();
  });
});

describe("commitVoiceProposal — work order", () => {
  const deps = () => ({
    resolveAmenityId: vi.fn(),
    createBooking: vi.fn(),
    createWorkOrder: vi.fn().mockResolvedValue(88),
    assertBookingAllowed: vi.fn().mockResolvedValue(undefined),
  });

  it("repair.report → createWorkOrder maintenance/high, returns WO-ref", async () => {
    const d = deps();
    const ref = await commitVoiceProposal({
      intent: "repair.report",
      slots: { issue: "漏水", location: "浴室", urgency: "high" },
      userId: 42,
      deps: d,
    });
    expect(d.createWorkOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, category: "maintenance", priority: "high" }),
    );
    expect(ref).toEqual({ ref: "WO-88" });
  });
});

describe("commitVoiceProposal — guards", () => {
  const deps = () => ({ resolveAmenityId: vi.fn(), createBooking: vi.fn(), createWorkOrder: vi.fn(), assertBookingAllowed: vi.fn().mockResolvedValue(undefined) });

  it("refuses to commit a query intent", async () => {
    const d = deps();
    await expect(
      commitVoiceProposal({ intent: "facility.list", slots: {}, userId: 42, deps: d }),
    ).rejects.toThrow();
  });
});

describe("buildFacilityMap", () => {
  it("maps facility keys to amenity ids by matching name substrings", () => {
    const map = buildFacilityMap([
      { id: 10, name: "健身房 Gym" },
      { id: 11, name: "游泳池 Pool" },
      { id: 12, name: "會議室 Meeting Room" },
    ]);
    expect(map.get("gym")).toBe(10);
    expect(map.get("pool")).toBe(11);
    // 'meeting' and 'meeting_room' both resolve to the meeting room amenity
    expect(map.get("meeting_room")).toBe(12);
  });

  it("leaves unmatched facility keys absent", () => {
    const map = buildFacilityMap([{ id: 10, name: "健身房 Gym" }]);
    expect(map.get("sauna")).toBeUndefined();
  });
});

describe("helpers", () => {
  it("deriveEndTime adds one hour by default and wraps midnight", () => {
    expect(deriveEndTime("19:00")).toBe("20:00");
    expect(deriveEndTime("23:30")).toBe("00:30");
  });

  it("deriveEndTime honours an explicit duration in minutes", () => {
    expect(deriveEndTime("19:00", 90)).toBe("20:30");
  });

  it("deriveEndTime throws on an unparseable time instead of returning NaN:NaN (C2)", () => {
    expect(() => deriveEndTime("下午三點")).toThrow();
    expect(() => deriveEndTime("19:00", -30)).toThrow();
  });

  it("urgencyToPriority maps NLP urgency to work-order priority", () => {
    expect(urgencyToPriority("high")).toBe("high");
    expect(urgencyToPriority("med")).toBe("medium");
    expect(urgencyToPriority("low")).toBe("low");
    expect(urgencyToPriority(undefined)).toBe("medium");
  });
});
