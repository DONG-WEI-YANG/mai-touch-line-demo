export interface AmenityView {
  id: number;
  name: string;
  description: string;
  icon: string;
  capacity: number;
  rules: string[];
  imageColor: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  recreation: "#C9A96E",
  wellness: "#4A90E2",
  entertainment: "#9B7EBD",
  business: "#7F8C8D",
  dining: "#D38C5B",
  outdoor: "#4E9F6D",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Build display-only fields while preserving the server's mutation identity. */
export function toAmenityView(value: unknown): AmenityView | null {
  if (!isRecord(value)
    || !Number.isInteger(value.id)
    || (value.id as number) <= 0
    || typeof value.name !== "string"
    || value.name.trim().length === 0
    || typeof value.icon !== "string"
    || value.icon.trim().length === 0
    || typeof value.category !== "string"
    || !Number.isInteger(value.capacity)
    || (value.capacity as number) <= 0
    || (value.description !== null && typeof value.description !== "string")
    || (value.rules !== null && typeof value.rules !== "string")
    || value.isActive === false || value.isActive === 0) {
    return null;
  }

  const description = value.description as string | null;
  const rules = value.rules as string | null;

  return {
    id: value.id as number,
    name: value.name.trim(),
    description: description?.trim() ?? "",
    icon: value.icon,
    capacity: value.capacity as number,
    rules: rules
      ? rules.split(/\r?\n/).map((rule) => rule.trim()).filter(Boolean)
      : [],
    imageColor: CATEGORY_COLORS[value.category] ?? "#C9A96E",
  };
}
