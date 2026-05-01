/**
 * Voice transcription service
 * OpenAI Whisper API wrapper
 */
import { ENV } from "./env";

export type TranscriptionOptions = {
  audioUrl: string;
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
  const { audioUrl, language, prompt, model = "whisper-1" } = options;

  if (!ENV.openaiApiKey) {
    return { error: "OpenAI API key not configured" };
  }

  try {
    // Download audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return { error: `Failed to download audio: ${audioResponse.statusText}` };
    }

    const audioBlob = await audioResponse.blob();

    // Prepare form data
    const formData = new FormData();
    // Create a File object from the Blob with a filename
    const audioFile = new File([audioBlob], "audio.webm", { type: audioBlob.type || "audio/webm" } as any);
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
