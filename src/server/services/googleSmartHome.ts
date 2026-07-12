/**
 * Google Smart Home (Cloud-to-Cloud) fulfillment.
 *
 * This is the "Google 音箱 → 你們後端" path for DEVICE CONTROL (開燈/開冷氣) —
 * the ONLY still-supported way a Nest speaker can reach a custom backend. It does
 * NOT and CANNOT do voice booking (no transcript, no slots); that lives in the
 * self-built voice pipeline (routers/voice.ts). See the hardware decision in
 * docs/superpowers/specs/2026-07-12-voice-booking-design.md.
 *
 * Google POSTs one of three intents to our fulfillment webhook, each carrying the
 * account-linked user (resolved from the OAuth bearer token by the route layer):
 *   SYNC    → list the user's devices in Google's schema
 *   QUERY   → report current on/off state
 *   EXECUTE → run an OnOff command → our device control
 *
 * Pure + dependency-injected so the intent mapping is unit-tested without a live
 * Google Actions project. The Express route wires `deps` to db + the hardware
 * gateway; external setup (Actions Console, OAuth account linking) is the
 * operator's, documented in docs/security/ / the spec.
 */

export type SmartHomeDevice = {
  id: number;
  name: string;
  type: string; // light | climate | curtain | security | media | power
  status: string; // "on" | "off" | "22°C" | …
  unitId?: number | null;
  amenityId?: number | null;
};

export type SmartHomeDeps = {
  listDevices: (userId: number) => Promise<SmartHomeDevice[]>;
  getDevice: (deviceId: number) => Promise<SmartHomeDevice | undefined>;
  setDeviceStatus: (deviceId: number, status: string) => Promise<void>;
};

type GoogleRequest = {
  requestId: string;
  inputs: Array<{ intent: string; payload?: any }>;
};

/** Map our device.type → a Google device type. Unknown → generic SWITCH. */
export function googleTypeFor(type: string): string {
  switch (type) {
    case "light": return "action.devices.types.LIGHT";
    case "climate": return "action.devices.types.AC_UNIT";
    case "curtain": return "action.devices.types.BLINDS";
    case "media": return "action.devices.types.TV";
    case "power": return "action.devices.types.OUTLET";
    case "security": return "action.devices.types.SECURITYSYSTEM";
    default: return "action.devices.types.SWITCH";
  }
}

/** A device is "on" for the OnOff trait unless its status is explicitly off/empty. */
function isOn(status: string): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s !== "" && s !== "off" && s !== "false" && s !== "0";
}

export async function handleSmartHomeRequest(
  body: GoogleRequest,
  userId: number,
  deps: SmartHomeDeps,
): Promise<{ requestId: string; payload: any }> {
  const requestId = body?.requestId ?? "";
  const input = body?.inputs?.[0];
  const intent = input?.intent;

  switch (intent) {
    case "action.devices.SYNC":
      return { requestId, payload: await handleSync(userId, deps) };
    case "action.devices.QUERY":
      return { requestId, payload: await handleQuery(input.payload, deps) };
    case "action.devices.EXECUTE":
      return { requestId, payload: await handleExecute(input.payload, userId, deps) };
    default:
      return { requestId, payload: { errorCode: "notSupported", debugString: `Unsupported intent: ${intent}` } };
  }
}

async function handleSync(userId: number, deps: SmartHomeDeps) {
  const devices = await deps.listDevices(userId);
  return {
    agentUserId: String(userId),
    devices: devices.map((d) => ({
      id: String(d.id),
      type: googleTypeFor(d.type),
      traits: ["action.devices.traits.OnOff"],
      name: { name: d.name },
      willReportState: false,
      roomHint: d.amenityId ? `Amenity ${d.amenityId}` : undefined,
      deviceInfo: { manufacturer: "Luxury Building", model: d.type },
    })),
  };
}

async function handleQuery(payload: any, deps: SmartHomeDeps) {
  const ids: string[] = (payload?.devices ?? []).map((d: any) => d.id);
  const states: Record<string, any> = {};
  for (const id of ids) {
    const device = await deps.getDevice(Number(id));
    if (!device) {
      states[id] = { online: false, status: "ERROR", errorCode: "deviceNotFound" };
      continue;
    }
    states[id] = { online: true, status: "SUCCESS", on: isOn(device.status) };
  }
  return { devices: states };
}

async function handleExecute(payload: any, userId: number, deps: SmartHomeDeps) {
  const owned = new Set((await deps.listDevices(userId)).map((d) => String(d.id)));
  const results: any[] = [];

  for (const cmd of payload?.commands ?? []) {
    const targetIds: string[] = (cmd.devices ?? []).map((d: any) => d.id);
    for (const exec of cmd.execution ?? []) {
      if (exec.command !== "action.devices.commands.OnOff") {
        results.push({ ids: targetIds, status: "ERROR", errorCode: "functionNotSupported" });
        continue;
      }
      const on = Boolean(exec.params?.on);
      const okIds: string[] = [];
      const errIds: string[] = [];
      for (const id of targetIds) {
        // Only act on devices this user actually owns — never let one linked
        // account drive another resident's hardware.
        if (!owned.has(id)) { errIds.push(id); continue; }
        try {
          await deps.setDeviceStatus(Number(id), on ? "on" : "off");
          okIds.push(id);
        } catch {
          errIds.push(id);
        }
      }
      if (okIds.length) {
        results.push({ ids: okIds, status: "SUCCESS", states: { on, online: true } });
      }
      if (errIds.length) {
        results.push({ ids: errIds, status: "ERROR", errorCode: "deviceNotFound" });
      }
    }
  }
  return { commands: results };
}
