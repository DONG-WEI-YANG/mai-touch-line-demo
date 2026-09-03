import type { ChatMessage, MessageRole } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function timestampOf(value: unknown): number | null {
  const timestamp = value instanceof Date
    ? value.getTime()
    : typeof value === "string" || typeof value === "number"
      ? new Date(value).getTime()
      : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function normalizeChatHistory(payload: unknown): ChatMessage[] {
  if (!Array.isArray(payload)) return [];
  const seen = new Set<number>();
  const messages: ChatMessage[] = [];

  for (const item of payload) {
    if (!isRecord(item)) continue;
    const id = item.id;
    const role = item.role;
    const content = item.content;
    const timestamp = timestampOf(item.createdAt);
    if (!Number.isInteger(id) || Number(id) <= 0 || seen.has(Number(id))) continue;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || !content.trim() || timestamp === null) continue;

    seen.add(Number(id));
    const normalizedRole: MessageRole = role;
    messages.push({
      id: `chat-${id}`,
      role: normalizedRole,
      content: content.trim(),
      timestamp,
      delivery: normalizedRole === "user" ? "confirmed" : undefined,
    });
  }

  return messages.sort((left, right) => left.timestamp - right.timestamp);
}
