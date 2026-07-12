import { describe, it, expect, vi } from "vitest";
import { handleSmartHomeRequest, googleTypeFor } from "../../src/server/services/googleSmartHome";

const DEVICES = [
  { id: 1, name: "健身房主燈", type: "light", status: "on", unitId: null, amenityId: 5 },
  { id: 2, name: "健身房冷氣", type: "climate", status: "off", unitId: null, amenityId: 5 },
];

const mkDeps = (overrides: any = {}) => ({
  listDevices: vi.fn().mockResolvedValue(DEVICES),
  getDevice: vi.fn((id: number) => Promise.resolve(DEVICES.find((d) => d.id === id))),
  setDeviceStatus: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const req = (intent: string, payload: any = {}) => ({
  requestId: "req-123",
  inputs: [{ intent, payload }],
});

describe("googleTypeFor", () => {
  it("maps our device types to Google device types", () => {
    expect(googleTypeFor("light")).toBe("action.devices.types.LIGHT");
    expect(googleTypeFor("climate")).toBe("action.devices.types.AC_UNIT");
    expect(googleTypeFor("power")).toBe("action.devices.types.OUTLET");
    expect(googleTypeFor("curtain")).toBe("action.devices.types.BLINDS");
  });
  it("falls back to SWITCH for unknown types", () => {
    expect(googleTypeFor("mystery")).toBe("action.devices.types.SWITCH");
  });
});

describe("SYNC", () => {
  it("returns the user's devices with OnOff trait and the requestId echoed", async () => {
    const deps = mkDeps();
    const res = await handleSmartHomeRequest(req("action.devices.SYNC"), 42, deps);
    expect(res.requestId).toBe("req-123");
    expect(deps.listDevices).toHaveBeenCalledWith(42);
    expect(res.payload.agentUserId).toBe("42");
    expect(res.payload.devices).toHaveLength(2);
    const light = res.payload.devices.find((d: any) => d.id === "1");
    expect(light.type).toBe("action.devices.types.LIGHT");
    expect(light.traits).toContain("action.devices.traits.OnOff");
    expect(light.name.name).toBe("健身房主燈");
  });
});

describe("QUERY", () => {
  it("reports on/off state derived from status", async () => {
    const deps = mkDeps();
    const res = await handleSmartHomeRequest(
      req("action.devices.QUERY", { devices: [{ id: "1" }, { id: "2" }] }),
      42,
      deps,
    );
    expect(res.payload.devices["1"]).toMatchObject({ online: true, status: "SUCCESS", on: true });
    expect(res.payload.devices["2"]).toMatchObject({ online: true, status: "SUCCESS", on: false });
  });

  it("marks an unknown device offline", async () => {
    const deps = mkDeps();
    const res = await handleSmartHomeRequest(
      req("action.devices.QUERY", { devices: [{ id: "999" }] }),
      42,
      deps,
    );
    expect(res.payload.devices["999"]).toMatchObject({ online: false, status: "ERROR" });
  });

  it("does not leak the state of a device the user doesn't own (IDOR)", async () => {
    // getDevice can resolve a foreign device, but it's NOT in the user's own list.
    const foreign = { id: 3, name: "別戶冷氣", type: "climate", status: "on", unitId: 99, amenityId: null };
    const deps = mkDeps({
      getDevice: vi.fn((id: number) => Promise.resolve([...DEVICES, foreign].find((d) => d.id === id))),
    });
    const res = await handleSmartHomeRequest(
      req("action.devices.QUERY", { devices: [{ id: "3" }] }),
      42,
      deps,
    );
    expect(res.payload.devices["3"]).toMatchObject({ online: false, status: "ERROR" });
    expect(res.payload.devices["3"].on).toBeUndefined();
  });
});

describe("EXECUTE", () => {
  it("turns a device on and returns its new state", async () => {
    const deps = mkDeps();
    const res = await handleSmartHomeRequest(
      req("action.devices.EXECUTE", {
        commands: [{
          devices: [{ id: "2" }],
          execution: [{ command: "action.devices.commands.OnOff", params: { on: true } }],
        }],
      }),
      42,
      deps,
    );
    expect(deps.setDeviceStatus).toHaveBeenCalledWith(2, "on");
    const cmd = res.payload.commands[0];
    expect(cmd.ids).toEqual(["2"]);
    expect(cmd.status).toBe("SUCCESS");
    expect(cmd.states).toMatchObject({ on: true, online: true });
  });

  it("turns a device off", async () => {
    const deps = mkDeps();
    await handleSmartHomeRequest(
      req("action.devices.EXECUTE", {
        commands: [{
          devices: [{ id: "1" }],
          execution: [{ command: "action.devices.commands.OnOff", params: { on: false } }],
        }],
      }),
      42,
      deps,
    );
    expect(deps.setDeviceStatus).toHaveBeenCalledWith(1, "off");
  });

  it("reports ERROR for a device the user doesn't have", async () => {
    const deps = mkDeps();
    const res = await handleSmartHomeRequest(
      req("action.devices.EXECUTE", {
        commands: [{
          devices: [{ id: "999" }],
          execution: [{ command: "action.devices.commands.OnOff", params: { on: true } }],
        }],
      }),
      42,
      deps,
    );
    expect(deps.setDeviceStatus).not.toHaveBeenCalled();
    expect(res.payload.commands[0].status).toBe("ERROR");
  });
});

describe("unknown intent", () => {
  it("returns an error payload rather than throwing", async () => {
    const res = await handleSmartHomeRequest(req("action.devices.DISCONNECT"), 42, mkDeps());
    expect(res.payload.errorCode).toBeDefined();
  });
});
