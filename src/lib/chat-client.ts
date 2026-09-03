export type ChatClientLanguage = "en" | "zh";

export interface QueuedChatInput {
  message: string;
  language: ChatClientLanguage;
}

export type ChatDeliveryResult =
  | { status: "confirmed"; text: string }
  | { status: "queued"; operationId: string };

export interface ChatDeliveryDependencies {
  isOnline(): boolean;
  send(input: QueuedChatInput): Promise<{ text: string }>;
  enqueue(input: QueuedChatInput): Promise<string>;
}

export class ChatDeliveryError extends Error {
  readonly code: "CHAT_MESSAGE_EMPTY";

  constructor(code: "CHAT_MESSAGE_EMPTY", message: string) {
    super(message);
    this.name = "ChatDeliveryError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isNetworkTransportError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!isRecord(error)) return false;
  if (error.name === "AbortError") return true;
  const message = typeof error.message === "string" ? error.message : "";
  return /failed to fetch|network request failed|networkerror|load failed/i.test(message);
}

export async function deliverChatMessage(
  input: QueuedChatInput,
  deps: ChatDeliveryDependencies,
): Promise<ChatDeliveryResult> {
  const normalized: QueuedChatInput = {
    message: input.message.trim(),
    language: input.language,
  };
  if (!normalized.message) {
    throw new ChatDeliveryError("CHAT_MESSAGE_EMPTY", "Chat message cannot be empty");
  }

  if (!deps.isOnline()) {
    const operationId = await deps.enqueue(normalized);
    return { status: "queued", operationId };
  }

  try {
    const response = await deps.send(normalized);
    return { status: "confirmed", text: response.text };
  } catch (error) {
    if (!isNetworkTransportError(error)) throw error;
    const operationId = await deps.enqueue(normalized);
    return { status: "queued", operationId };
  }
}
