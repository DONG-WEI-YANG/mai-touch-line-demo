import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { transcribeAudio } from "../_core/voiceTranscription";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English", zh: "中文", ja: "日本語", ko: "한국어",
  es: "Español", fr: "Français", de: "Deutsch", it: "Italiano",
  pt: "Português", ru: "Русский", ar: "العربية", hi: "हिन्दी",
};

function normalizeLanguageCode(lang: string): string {
  const lower = lang.toLowerCase().trim();
  const nameToCode: Record<string, string> = {
    english: "en", chinese: "zh", mandarin: "zh", cantonese: "zh",
    japanese: "ja", korean: "ko", spanish: "es", french: "fr",
    german: "de", italian: "it", portuguese: "pt", russian: "ru",
    arabic: "ar", hindi: "hi",
  };
  return nameToCode[lower] || lower;
}

function estimateConfidence(
  response: { segments?: Array<{ avg_logprob: number; no_speech_prob: number }> }
): number {
  if (!response.segments || response.segments.length === 0) return 0.5;
  const avgLogProb = response.segments.reduce((sum, s) => sum + s.avg_logprob, 0) / response.segments.length;
  const avgNoSpeechProb = response.segments.reduce((sum, s) => sum + s.no_speech_prob, 0) / response.segments.length;
  const logProbScore = Math.max(0, Math.min(1, 1 + avgLogProb));
  const speechScore = 1 - avgNoSpeechProb;
  return Math.round(logProbScore * 0.7 + speechScore * 0.3 * 100) / 100;
}

export const voiceRouter = router({
  transcribe: publicProcedure
    .input(z.object({
      audioBase64: z.string(),
      mimeType: z.string().default("audio/webm"),
      language: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Direct upload to Whisper — bypasses the Forge storage proxy that the
      // legacy path used. The intermediate URL hop required env vars (forgeApi*)
      // not provisioned on Render Free, so transcribe was failing silently and
      // text never came back to the client.
      const buffer = Buffer.from(input.audioBase64, "base64");

      const bilingualPrompt = input.language
        ? input.language === "zh"
          ? "請轉錄使用者的語音指令。這是一個高端物業管理應用程式的語音命令。"
          : `Transcribe the user's voice command for a luxury property management app. The user speaks ${LANGUAGE_LABELS[input.language] || input.language}.`
        : "Transcribe the user's voice command. The user may speak in English or Chinese (中文). 請準確辨識使用者的語音，可能是英文或中文。This is for a luxury property management concierge app (高端物業管理應用).";

      const result = await transcribeAudio({
        audioBuffer: buffer,
        audioMime: input.mimeType,
        language: input.language,
        prompt: bilingualPrompt,
      });
      if ("error" in result) throw new Error(result.error);

      const normalizedLang = normalizeLanguageCode(result.language || "en");
      return {
        text: result.text || "",
        language: normalizedLang,
        languageLabel: LANGUAGE_LABELS[normalizedLang] || normalizedLang,
        confidence: estimateConfidence(result),
      };
    }),
});
