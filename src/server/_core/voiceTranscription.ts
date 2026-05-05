/**
 * Voice transcription service
 * OpenAI Whisper API wrapper
 */
import { ENV } from "./env";

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
 * Transcribe audio using OpenAI Whisper API
 */
export async function transcribeAudio(
  options: TranscriptionOptions
): Promise<TranscriptionResult | TranscriptionError> {
  const { audioUrl, audioBuffer, audioMime, language, prompt, model = "whisper-1" } = options;

  if (!ENV.openaiApiKey) {
    return { error: "OpenAI API key not configured" };
  }

  if (!audioUrl && !audioBuffer) {
    return { error: "Either audioUrl or audioBuffer must be provided" };
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
        Authorization: `Bearer ${ENV.openaiApiKey}`,
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
