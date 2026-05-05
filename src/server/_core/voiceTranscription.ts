/**
 * Voice transcription service.
 *
 * Auto-routes between two backends based on the API key shape:
 *   - sk-... → OpenAI Whisper (multipart upload to /audio/transcriptions)
 *   - AIzaSy... or anything else → Google Gemini generateContent with
 *     inline_data audio. Gemini's OpenAI-compatible endpoint does NOT
 *     support audio transcription, only chat — so we call the native
 *     generativelanguage.googleapis.com endpoint directly.
 */
import { ENV } from "./env";

// Gemini model that supports audio understanding. 2.5-flash is current-gen;
// fall back to 1.5-flash via env override if the project doesn't have 2.5 access.
const GEMINI_STT_MODEL = process.env.GEMINI_STT_MODEL ?? "gemini-2.5-flash";

function isWhisperKey(key: string): boolean {
  return key.trim().startsWith("sk-");
}

export type TranscriptionOptions = {
  /** Either a public URL we can fetch (legacy path via storage proxy)
   *  or a raw Buffer to upload directly to Whisper. Direct buffer is
   *  preferred — avoids the intermediate Forge storage hop. */
  audioUrl?: string;
  audioBuffer?: Buffer;
  audioMime?: string;
  language?: string;
  prompt?: string;
  model?: string;
};

export type TranscriptionResult = {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    avg_logprob: number;
    no_speech_prob: number;
  }>;
};

export type TranscriptionError = {
  error: string;
};

/**
 * Transcribe audio. Routes to Whisper (sk- key) or Gemini (otherwise).
 */
export async function transcribeAudio(
  options: TranscriptionOptions
): Promise<TranscriptionResult | TranscriptionError> {
  const { audioUrl, audioBuffer, audioMime, language, prompt, model = "whisper-1" } = options;

  // Pick the first comma-separated key (matches getAi's split). Gemini and
  // OpenAI keys may both be in the env for round-robin chat use; STT just
  // needs one valid key for whichever backend the prefix matches.
  const rawKey = ENV.openaiApiKey;
  if (!rawKey) {
    return { error: "OpenAI API key not configured" };
  }
  const firstKey = rawKey.split(",")[0].trim();

  if (!audioUrl && !audioBuffer) {
    return { error: "Either audioUrl or audioBuffer must be provided" };
  }

  // Resolve to a Buffer (Gemini path needs raw bytes)
  let bufferForGemini: Buffer | null = null;
  let mimeForGemini = audioMime || "audio/webm";
  if (audioBuffer) bufferForGemini = audioBuffer;
  else if (audioUrl) {
    const resp = await fetch(audioUrl);
    if (!resp.ok) return { error: `Failed to download audio: ${resp.statusText}` };
    bufferForGemini = Buffer.from(await resp.arrayBuffer());
    mimeForGemini = resp.headers.get("content-type") || mimeForGemini;
  }

  if (!isWhisperKey(firstKey)) {
    return transcribeWithGemini({
      apiKey: firstKey,
      audioBuffer: bufferForGemini!,
      mimeType: mimeForGemini,
      language,
      prompt,
    });
  }

  try {
    let audioBlob: Blob;
    let mimeType: string;
    let fileName: string;

    if (audioBuffer) {
      // Direct upload path — preferred, no storage hop
      mimeType = audioMime || "audio/webm";
      audioBlob = new Blob([audioBuffer as any], { type: mimeType });
      const ext = mimeType.includes("wav") ? "wav"
        : mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : "webm";
      fileName = `audio.${ext}`;
    } else {
      // Legacy URL path — used when audio sits behind a public storage URL
      const audioResponse = await fetch(audioUrl!);
      if (!audioResponse.ok) {
        return { error: `Failed to download audio: ${audioResponse.statusText}` };
      }
      audioBlob = await audioResponse.blob();
      mimeType = audioBlob.type || "audio/webm";
      fileName = "audio.webm";
    }

    // Prepare form data
    const formData = new FormData();
    const audioFile = new File([audioBlob], fileName, { type: mimeType } as any);
    formData.append("file", audioFile);
    formData.append("model", model);
    formData.append("response_format", "verbose_json");

    if (language) {
      formData.append("language", language);
    }

    if (prompt) {
      formData.append("prompt", prompt);
    }

    // Call Whisper API
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firstKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      return { error: `Whisper API error: ${response.status} ${error}` };
    }

    const result = await response.json() as any;

    return {
      text: result.text || "",
      language: result.language,
      duration: result.duration,
      segments: result.segments,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown transcription error",
    };
  }
}

/**
 * Transcribe audio via Gemini's generateContent endpoint with inline audio.
 * Uses the native generativelanguage.googleapis.com URL — Gemini's
 * OpenAI-compatible endpoint (`/v1beta/openai/`) does NOT support audio input.
 *
 * Audio is sent base64 inline rather than via the Files API. ~20MB / 1min cap
 * is plenty for a chat-input voice command.
 */
async function transcribeWithGemini(opts: {
  apiKey: string;
  audioBuffer: Buffer;
  mimeType: string;
  language?: string;
  prompt?: string;
}): Promise<TranscriptionResult | TranscriptionError> {
  // Gemini accepts these audio MIMEs: wav, mp3, aiff, aac, ogg, flac, webm.
  // Browser MediaRecorder typically gives audio/webm;codecs=opus — strip the
  // codec param so Gemini's mime allowlist accepts it.
  const cleanMime = opts.mimeType.split(";")[0].trim() || "audio/webm";

  const lang = opts.language || "auto";
  const langName = lang === "zh" ? "Traditional Chinese (繁體中文)"
    : lang === "en" ? "English"
    : lang === "ja" ? "Japanese"
    : "the language spoken";
  const transcribePrompt = opts.prompt
    ? `${opts.prompt}\n\nReturn ONLY the transcript text, nothing else. Detect language: expect ${langName}.`
    : `Transcribe the audio precisely in ${langName}. Return ONLY the transcript text, no preamble or explanation.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_STT_MODEL}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
  const body = {
    contents: [{
      parts: [
        { text: transcribePrompt },
        { inline_data: { mime_type: cleanMime, data: opts.audioBuffer.toString("base64") } },
      ],
    }],
    generationConfig: { temperature: 0.0 },
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return { error: `Gemini STT error: ${resp.status} ${errText.slice(0, 400)}` };
    }
    const json = await resp.json() as any;
    const text = (json?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p?.text ?? "")
      .join("")
      .trim();

    return {
      text,
      language: lang === "auto" ? undefined : lang,
      // Gemini doesn't return logprobs; estimateConfidence() returns 0.5
      // when segments is empty, which our voice.transcribe accepts.
      segments: [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gemini STT failed" };
  }
}
