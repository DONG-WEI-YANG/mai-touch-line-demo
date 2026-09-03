/**
 * LLM (Large Language Model) integration
 * OpenAI GPT API wrapper
 */
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file";
  file_id: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage = {
  role: Role;
  content: string | Array<TextContent | ImageContent | FileContent>;
  tool_calls?: ToolCall[];
};

export type LLMResponse = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type LLMOptions = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  timeoutMs?: number;
  response_format?: { type: "text" | "json_object" | "json_schema"; json_schema?: JsonSchema };
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
};

export type LLMProviderErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_TIMEOUT"
  | "AI_RATE_LIMITED"
  | "AI_AUTHENTICATION_FAILED"
  | "AI_REQUEST_REJECTED"
  | "AI_UNAVAILABLE"
  | "AI_INVALID_RESPONSE";

/** Safe error exposed to application services. Provider bodies are deliberately
 * omitted because they can contain prompts, resident data, or credentials. */
export class LLMProviderError extends Error {
  readonly code: LLMProviderErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    code: LLMProviderErrorCode,
    message: string,
    options: { status?: number; retryable: boolean; cause?: unknown },
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "LLMProviderError";
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

export interface LLMHealthReport {
  status: "healthy" | "degraded" | "unavailable" | "unconfigured";
  configured: boolean;
  reachable: boolean;
  code?: LLMProviderErrorCode;
  checkedAt: number;
  latencyMs: number;
}

function providerUrl(path: string): string {
  const baseUrl = (ENV.openaiBaseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  return `${baseUrl}/${path.replace(/^\/+/, "")}`;
}

/** Authenticated metadata probe. It never sends a resident prompt and never
 * reads the provider response body, so diagnostics cannot echo provider data. */
export async function checkLLMHealth(timeoutMs = 3_000): Promise<LLMHealthReport> {
  const startedAt = Date.now();
  if (!ENV.openaiApiKey) {
    return {
      status: "unconfigured",
      configured: false,
      reachable: false,
      checkedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
    };
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const response = await fetch(providerUrl("models"), {
      method: "GET",
      headers: { Authorization: `Bearer ${ENV.openaiApiKey}` },
      signal: controller.signal,
    });
    const common = {
      configured: true,
      reachable: true,
      checkedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
    } as const;
    if (response.ok) return { status: "healthy", ...common };
    if (response.status === 401 || response.status === 403) {
      return { status: "degraded", code: "AI_AUTHENTICATION_FAILED", ...common };
    }
    if (response.status === 429) {
      return { status: "degraded", code: "AI_RATE_LIMITED", ...common };
    }
    return {
      status: response.status >= 500 ? "unavailable" : "degraded",
      code: response.status >= 500 ? "AI_UNAVAILABLE" : "AI_REQUEST_REJECTED",
      ...common,
    };
  } catch {
    return {
      status: "unavailable",
      configured: true,
      reachable: false,
      code: controller.signal.aborted ? "AI_TIMEOUT" : "AI_UNAVAILABLE",
      checkedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(deadline);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isContentPart(value: unknown): value is TextContent | ImageContent | FileContent {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "text") return typeof value.text === "string";
  if (value.type === "file") return typeof value.file_id === "string";
  if (value.type === "image_url") {
    return isRecord(value.image_url) && typeof value.image_url.url === "string";
  }
  return false;
}

function isLLMResponse(value: unknown): value is LLMResponse {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.created !== "number" || typeof value.model !== "string") {
    return false;
  }
  if (!Array.isArray(value.choices) || value.choices.length === 0) return false;

  return value.choices.every((choice) => {
    if (!isRecord(choice) || typeof choice.index !== "number" || !isRecord(choice.message)) return false;
    const { role, content } = choice.message;
    const roleValid = role === "system" || role === "user" || role === "assistant";
    const contentValid = typeof content === "string"
      || (Array.isArray(content) && content.every(isContentPart));
    return roleValid && contentValid
      && (choice.finish_reason === null || typeof choice.finish_reason === "string");
  });
}

function errorForStatus(status: number): LLMProviderError {
  if (status === 429) {
    return new LLMProviderError("AI_RATE_LIMITED", "AI provider rate limit reached", {
      status,
      retryable: true,
    });
  }
  if (status === 401 || status === 403) {
    return new LLMProviderError("AI_AUTHENTICATION_FAILED", "AI provider authentication failed", {
      status,
      retryable: false,
    });
  }
  if (status >= 500) {
    return new LLMProviderError("AI_UNAVAILABLE", "AI provider is unavailable", {
      status,
      retryable: true,
    });
  }
  return new LLMProviderError("AI_REQUEST_REJECTED", "AI provider rejected the request", {
    status,
    retryable: false,
  });
}

/**
 * Invoke OpenAI GPT API
 */
export async function invokeLLM(options: LLMOptions): Promise<LLMResponse> {
  const {
    messages,
    model = "gpt-4o-mini",
    temperature = 0.7,
    max_tokens = 1000,
    timeoutMs = 30_000,
    response_format,
    tools,
  } = options;

  if (!ENV.openaiApiKey) {
    throw new LLMProviderError("AI_NOT_CONFIGURED", "AI provider is not configured", {
      retryable: false,
    });
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  let response: Response;
  try {
    response = await fetch(providerUrl("chat/completions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.openaiApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
        response_format,
        tools,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw new LLMProviderError("AI_TIMEOUT", "AI provider request timed out", {
        retryable: true,
        cause: error,
      });
    }
    throw new LLMProviderError("AI_UNAVAILABLE", "AI provider could not be reached", {
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(deadline);
  }

  if (!response.ok) {
    throw errorForStatus(response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new LLMProviderError("AI_INVALID_RESPONSE", "AI provider returned invalid JSON", {
      retryable: true,
      cause: error,
    });
  }
  if (!isLLMResponse(payload)) {
    throw new LLMProviderError("AI_INVALID_RESPONSE", "AI provider returned an invalid response", {
      retryable: true,
    });
  }
  return payload;
}
