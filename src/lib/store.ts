import type { ResidentProfile } from "./types";

/** Neutral placeholder shown only until the authenticated profile arrives. */
export const DEFAULT_PROFILE: ResidentProfile = {
  name: "Resident",
  unit: "Unassigned",
  tier: "Platinum",
};

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
