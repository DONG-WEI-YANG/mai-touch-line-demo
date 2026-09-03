import {
  LLMProviderError,
  type ChatMessage,
  type LLMOptions,
  type LLMResponse,
} from "../_core/llm";

export type ChatLanguage = "en" | "zh";
export type ChatRole = "user" | "assistant";

export interface ChatPersistenceInput {
  userId: number;
  role: ChatRole;
  content: string;
  language?: string;
}

export interface ChatPersistenceRecord extends ChatPersistenceInput {
  id?: number;
  createdAt?: Date | string;
}

export interface ChatServiceDependencies {
  createMessage(input: ChatPersistenceInput): Promise<unknown>;
  getMessages(userId: number, limit: number): Promise<ReadonlyArray<ChatPersistenceRecord>>;
  invoke(options: LLMOptions): Promise<LLMResponse>;
}

export class ChatServiceError extends Error {
  readonly code: "CHAT_MESSAGE_EMPTY";

  constructor(code: "CHAT_MESSAGE_EMPTY", message: string) {
    super(message);
    this.name = "ChatServiceError";
    this.code = code;
  }
}

const SYSTEM_PROMPTS: Record<ChatLanguage, string> = {
  en: "You are the Digital Brain of m'AI Touch, an AI concierge for an elite residential community. You help residents understand property services, booking options, maintenance requests, and guest hosting. Never claim that a physical action, booking, or work order succeeded unless the application context explicitly confirms it. Respond professionally and warmly in no more than three concise sentences.",
  zh: "你是 m'AI Touch 的 Digital Brain，一個為頂級住宅社區服務的 AI 智慧管家。你能協助住戶了解物業服務、設施預約、維修申請與訪客接待。除非應用程式明確提供成功結果，否則不可宣稱任何實體操作、預約或工單已完成。請以專業、優雅且溫暖的繁體中文回應，不超過三句。",
};

function normalizeLanguage(language: string | undefined): ChatLanguage {
  return language?.trim().toLowerCase().startsWith("zh") ? "zh" : "en";
}

function toProviderMessage(record: ChatPersistenceRecord): ChatMessage | null {
  if (record.role !== "user" && record.role !== "assistant") return null;
  return {
    role: record.role,
    content: [{ type: "text", text: record.content }],
  };
}

function extractAssistantText(response: LLMResponse): string {
  const content = response.choices[0]?.message.content;
  const text = typeof content === "string"
    ? content
    : content
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
  if (!text?.trim()) {
    throw new LLMProviderError("AI_INVALID_RESPONSE", "AI provider returned an empty response", {
      retryable: true,
    });
  }
  return text.trim();
}

export async function sendResidentChat(
  input: { userId: number; message: string; language?: string },
  deps: ChatServiceDependencies,
): Promise<{ text: string }> {
  const message = input.message.trim();
  if (!message) {
    throw new ChatServiceError("CHAT_MESSAGE_EMPTY", "Chat message cannot be empty");
  }
  const language = normalizeLanguage(input.language);

  await deps.createMessage({
    userId: input.userId,
    role: "user",
    content: message,
    language,
  });

  const newestFirst = await deps.getMessages(input.userId, 10);
  const history = newestFirst
    .slice()
    .reverse()
    .map(toProviderMessage)
    .filter((record): record is ChatMessage => record !== null);

  const response = await deps.invoke({
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: SYSTEM_PROMPTS[language] }],
      },
      ...history,
    ],
  });
  const assistantText = extractAssistantText(response);

  await deps.createMessage({
    userId: input.userId,
    role: "assistant",
    content: assistantText,
    language,
  });

  return { text: assistantText };
}
