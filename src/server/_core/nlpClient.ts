/**
 * NLP Service Client
 * Communicates with the Python NLP microservice
 */
import { ENV } from "./env";

export type NLPTask = "intent" | "sentiment" | "entity" | "all";

export type NLPRequest = {
  text: string;
  task?: NLPTask;
  language?: string;
  timeout?: number;
};

export type IntentResult = {
  primary_intent: string;
  confidence: number;
  sub_intent?: string;
  all_predictions: Array<{
    intent: string;
    confidence: number;
  }>;
};

export type SentimentResult = {
  emotion: string;
  emotion_confidence: number;
  urgency: string;
  urgency_confidence: number;
};

export type EntityResult = {
  entities: Array<{
    text: string;
    type: string;
    position: number;
  }>;
  count: number;
};

export type NLPResponse = {
  success: boolean;
  task: string;
  language: string;
  processing_time_ms: number;
  model_id: string;
  intent?: IntentResult;
  sentiment?: SentimentResult;
  entities?: EntityResult;
  error?: string;
};

/**
 * Analyze text using NLP service
 */
export async function analyzeText(request: NLPRequest): Promise<NLPResponse> {
  if (!ENV.nlpServiceEnabled) {
    // Return mock response when NLP service is disabled
    return {
      success: true,
      task: request.task || "intent",
      language: request.language || "en",
      processing_time_ms: 0,
      model_id: "mock",
      intent: {
        primary_intent: "general_inquiry",
        confidence: 0.5,
        all_predictions: [
          { intent: "general_inquiry", confidence: 0.5 },
        ],
      },
    };
  }

  const {
    text,
    task = "intent",
    language = "en",
    timeout = ENV.nlpServiceTimeout,
  } = request;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${ENV.nlpServiceUrl}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        task,
        language,
        timeout: timeout / 1000, // Convert to seconds
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NLP service error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[NLP Client] Error:", error);

    // Return fallback response on error
    return {
      success: false,
      task,
      language,
      processing_time_ms: 0,
      model_id: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      intent: {
        primary_intent: "unknown",
        confidence: 0,
        all_predictions: [],
      },
    };
  }
}

/**
 * Batch analyze multiple texts
 */
export async function batchAnalyzeText(requests: NLPRequest[]): Promise<NLPResponse[]> {
  if (!ENV.nlpServiceEnabled) {
    return requests.map((req) => ({
      success: true,
      task: req.task || "intent",
      language: req.language || "en",
      processing_time_ms: 0,
      model_id: "mock",
      intent: {
        primary_intent: "general_inquiry",
        confidence: 0.5,
        all_predictions: [],
      },
    }));
  }

  try {
    const response = await fetch(`${ENV.nlpServiceUrl}/batch-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requests),
    });

    if (!response.ok) {
      throw new Error(`NLP service error: ${response.status}`);
    }

    const result = await response.json();
    return result.results || [];
  } catch (error) {
    console.error("[NLP Client] Batch error:", error);
    return requests.map(() => ({
      success: false,
      task: "intent",
      language: "en",
      processing_time_ms: 0,
      model_id: "error",
      error: "Batch analysis failed",
    }));
  }
}

/**
 * Check NLP service health
 */
export async function checkNLPHealth(): Promise<{
  status: string;
  available: boolean;
  stats?: any;
}> {
  if (!ENV.nlpServiceEnabled) {
    return {
      status: "disabled",
      available: false,
    };
  }

  try {
    const response = await fetch(`${ENV.nlpServiceUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return {
        status: "unhealthy",
        available: false,
      };
    }

    const data = await response.json();
    return {
      status: data.status || "unknown",
      available: true,
      stats: data.pool_stats,
    };
  } catch (error) {
    return {
      status: "unreachable",
      available: false,
    };
  }
}
