import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENV } from "../../src/server/_core/env";
import {
  invokeLLM,
  checkLLMHealth,
  LLMProviderError,
  type LLMResponse,
} from "../../src/server/_core/llm";

const validResponse: LLMResponse = {
  id: "chatcmpl-test",
  created: 1_725_000_000,
  model: "gpt-4o-mini",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Welcome home." },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
};

const originalKey = ENV.openaiApiKey;
const originalBaseUrl = ENV.openaiBaseUrl;

beforeEach(() => {
  ENV.openaiApiKey = "test-secret-key";
  ENV.openaiBaseUrl = "";
});

afterEach(() => {
  ENV.openaiApiKey = originalKey;
  ENV.openaiBaseUrl = originalBaseUrl;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("invokeLLM", () => {
  it("rejects before transport when the provider key is absent", async () => {
    ENV.openaiApiKey = "";
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);

    await expect(invokeLLM({ messages: [] })).rejects.toMatchObject({
      name: "LLMProviderError",
      code: "AI_NOT_CONFIGURED",
      retryable: false,
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("sends the declared request and validates a successful provider response", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requestUrl = String(url);
      requestInit = init;
      return new Response(JSON.stringify(validResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    const result = await invokeLLM({
      messages: [{ role: "user", content: "Hello" }],
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 64,
      timeoutMs: 250,
    });

    expect(result).toEqual(validResponse);
    expect(requestUrl).toBe("https://api.openai.com/v1/chat/completions");
    expect(requestInit?.method).toBe("POST");
    expect((requestInit?.headers as Record<string, string>).Authorization).toBe("Bearer test-secret-key");
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello" }],
      temperature: 0.2,
      max_tokens: 64,
    });
  });

  it("uses a configured OpenAI-compatible provider base URL", async () => {
    ENV.openaiBaseUrl = "http://127.0.0.1:4567/v1/";
    const transport = vi.fn(async () => new Response(JSON.stringify(validResponse), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", transport);

    await invokeLLM({ messages: [{ role: "user", content: "Hello" }] });

    expect(String(transport.mock.calls[0][0])).toBe("http://127.0.0.1:4567/v1/chat/completions");
  });

  it("aborts a provider request at the configured deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
    ));

    const result = expect(invokeLLM({ messages: [], timeoutMs: 25 })).rejects.toMatchObject({
      name: "LLMProviderError",
      code: "AI_TIMEOUT",
      retryable: true,
    });
    await vi.advanceTimersByTimeAsync(25);

    await result;
  });

  it("redacts provider bodies and credentials from non-success errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      "upstream debug payload test-secret-key customer@example.com",
      { status: 429 },
    )));

    let caught: unknown;
    try {
      await invokeLLM({ messages: [] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LLMProviderError);
    expect(caught).toMatchObject({
      code: "AI_RATE_LIMITED",
      status: 429,
      retryable: true,
    });
    expect(String(caught)).not.toContain("test-secret-key");
    expect(String(caught)).not.toContain("customer@example.com");
  });

  it("rejects a malformed success payload instead of returning an unsafe cast", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ id: "missing-choices", model: "gpt-4o-mini" }),
      { status: 200, headers: { "content-type": "application/json" } },
    )));

    await expect(invokeLLM({ messages: [] })).rejects.toMatchObject({
      name: "LLMProviderError",
      code: "AI_INVALID_RESPONSE",
      retryable: true,
    });
  });
});

describe("checkLLMHealth", () => {
  it("reports unconfigured without contacting the provider", async () => {
    ENV.openaiApiKey = "";
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);

    const result = await checkLLMHealth();

    expect(result).toMatchObject({ status: "unconfigured", configured: false, reachable: false });
    expect(transport).not.toHaveBeenCalled();
  });

  it("reports healthy only after a successful authenticated provider probe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));

    const result = await checkLLMHealth(250);

    expect(result).toMatchObject({ status: "healthy", configured: true, reachable: true });
    expect(result.latencyMs).toEqual(expect.any(Number));
  });

  it("classifies rejected credentials without reading or returning the provider body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("test-secret-key provider-debug", { status: 401 })));

    const result = await checkLLMHealth(250);

    expect(result).toMatchObject({
      status: "degraded",
      configured: true,
      reachable: true,
      code: "AI_AUTHENTICATION_FAILED",
    });
    expect(JSON.stringify(result)).not.toContain("test-secret-key");
    expect(JSON.stringify(result)).not.toContain("provider-debug");
  });
});
