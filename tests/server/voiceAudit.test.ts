import { describe, it, expect, beforeEach } from "vitest";
import { VoiceAuditService } from "../../src/server/services/voiceAuditService";

describe("VoiceAuditService", () => {
  let svc: VoiceAuditService;
  beforeEach(() => { svc = new VoiceAuditService(5); }); // small buffer to test capping

  it("records a proposed command and returns it in history (newest first)", () => {
    svc.record({ actorUserId: 1, source: "resident", phase: "command", intent: "facility.book", kind: "booking", outcome: "proposed", transcript: "預約健身房" });
    svc.record({ actorUserId: 1, source: "resident", phase: "commit", intent: "facility.book", kind: "booking", outcome: "committed", ref: "BK-9" });
    const hist = svc.getHistory();
    expect(hist).toHaveLength(2);
    expect(hist[0].phase).toBe("commit"); // newest first
    expect(hist[0].ref).toBe("BK-9");
    expect(hist[0].id).toBeGreaterThan(0);
    expect(typeof hist[0].timestamp).toBe("string");
  });

  it("caps history at the buffer size, dropping the oldest", () => {
    for (let i = 0; i < 8; i++) {
      svc.record({ actorUserId: 1, source: "resident", phase: "command", intent: "repair.report", kind: "work_order", outcome: "proposed" });
    }
    expect(svc.getHistory()).toHaveLength(5);
  });

  it("honours the limit argument", () => {
    for (let i = 0; i < 5; i++) {
      svc.record({ actorUserId: 1, source: "resident", phase: "command", intent: "facility.book", kind: "booking", outcome: "proposed" });
    }
    expect(svc.getHistory(2)).toHaveLength(2);
  });

  it("records staff-on-behalf actions with the target user", () => {
    svc.record({ actorUserId: 3, targetUserId: 42, source: "staff", phase: "commit", intent: "facility.book", kind: "booking", outcome: "committed", ref: "BK-1" });
    const [entry] = svc.getHistory();
    expect(entry.actorUserId).toBe(3);
    expect(entry.targetUserId).toBe(42);
    expect(entry.source).toBe("staff");
  });

  it("computes stats: totals by outcome + last write ref", () => {
    svc.record({ actorUserId: 1, source: "resident", phase: "command", intent: "facility.book", kind: "booking", outcome: "proposed" });
    svc.record({ actorUserId: 1, source: "resident", phase: "commit", intent: "facility.book", kind: "booking", outcome: "committed", ref: "BK-9" });
    svc.record({ actorUserId: 1, source: "resident", phase: "commit", intent: "facility.book", kind: "booking", outcome: "rejected", error: "Capacity exceeded" });
    const stats = svc.getStats();
    expect(stats.total).toBe(3);
    expect(stats.committed).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.proposed).toBe(1);
  });
});
