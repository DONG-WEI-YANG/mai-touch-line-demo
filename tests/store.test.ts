import { describe, it, expect } from "vitest";
import {
  QUICK_ACTIONS,
  SERVICES,
  SAMPLE_WORK_ORDERS,
  DEFAULT_PROFILE,
  getAIResponse,
  generateId,
} from "@/lib/store";

describe("Store data", () => {
  it("should have 6 quick actions", () => {
    expect(QUICK_ACTIONS).toHaveLength(6);
    QUICK_ACTIONS.forEach((action) => {
      expect(action.id).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.prompt).toBeTruthy();
      expect(action.icon).toBeTruthy();
    });
  });

  it("should have 6 services (3 operations + 3 lifestyle)", () => {
    expect(SERVICES).toHaveLength(6);
    const ops = SERVICES.filter((s) => s.category === "operations");
    const lf = SERVICES.filter((s) => s.category === "lifestyle");
    expect(ops).toHaveLength(3);
    expect(lf).toHaveLength(3);
  });

  it("should have sample work orders with valid statuses", () => {
    expect(SAMPLE_WORK_ORDERS.length).toBeGreaterThan(0);
    const validStatuses = ["pending", "in_progress", "completed"];
    const validTypes = ["maintenance", "security", "concierge"];
    SAMPLE_WORK_ORDERS.forEach((wo) => {
      expect(validStatuses).toContain(wo.status);
      expect(validTypes).toContain(wo.type);
      expect(wo.createdAt).toBeLessThanOrEqual(Date.now());
    });
  });

  it("should have a valid default profile", () => {
    expect(DEFAULT_PROFILE.name).toBe("Alexander Whitmore");
    expect(DEFAULT_PROFILE.unit).toBe("Penthouse 42A");
    expect(["Platinum", "Diamond", "Black"]).toContain(DEFAULT_PROFILE.tier);
  });
});

describe("getAIResponse", () => {
  it("should return apartment preparation response for 'prepare apartment'", () => {
    const response = getAIResponse("Please prepare apartment for me");
    expect(response).toContain("lighting");
  });

  it("should return guest response for 'guest arriving'", () => {
    const response = getAIResponse("Guest arriving tomorrow");
    expect(response).toContain("entry");
  });

  it("should return privacy response for 'privacy mode'", () => {
    const response = getAIResponse("Enable privacy mode");
    expect(response).toContain("Privacy Mode");
  });

  it("should return noise response for noise complaints", () => {
    const response = getAIResponse("Neighbors are making noise again");
    expect(response).toContain("discreet");
  });

  it("should return booking response for reservations", () => {
    const response = getAIResponse("I want to book the dining room");
    expect(response).toContain("dining");
  });

  it("should return maintenance response for repair requests", () => {
    const response = getAIResponse("I need maintenance for the bathroom");
    expect(response).toContain("maintenance");
  });

  it("should return default response for unrecognized input", () => {
    const response = getAIResponse("Something completely random xyz");
    expect(response).toContain("Digital Brain");
  });
});

describe("generateId", () => {
  it("should generate unique IDs", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(5);
  });
});
