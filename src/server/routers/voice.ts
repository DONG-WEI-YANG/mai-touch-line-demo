import { publicProcedure, residentProcedure, staffProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { transcribeAudio } from "../_core/voiceTranscription";
import { getAi } from "../_core/profile";
import * as db from "../db";
import { buildVoiceProposal, commitVoiceProposal, buildFacilityMap } from "../_core/voiceCommand";
import { voiceAuditService, type VoiceAuditSource } from "../services/voiceAuditService";
import type { IntentName, Slot } from "../line/ai/types";

// Record a commit attempt in the audit trail, whether it lands or is rejected.
// Wraps commitVoiceProposal so both outcomes are captured and the error still
// propagates to the client unchanged.
async function auditedCommit(args: {
  intent: IntentName; slots: Slot; userId: number;
  deps: Parameters<typeof commitVoiceProposal>[0]["deps"];
  actorUserId: number; targetUserId?: number; source: VoiceAuditSource;
}): Promise<{ ref: string }> {
  const { intent, slots, userId, deps, actorUserId, targetUserId, source } = args;
  try {
    const result = await commitVoiceProposal({ intent, slots, userId, deps });
    voiceAuditService.record({ actorUserId, targetUserId, source, phase: "commit", intent, kind: "commit", outcome: "committed", slots, ref: result.ref });
    return result;
  } catch (err) {
    voiceAuditService.record({ actorUserId, targetUserId, source, phase: "commit", intent, kind: "commit", outcome: "rejected", slots, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// Actionable + query intents the NLP classifier can emit. Kept in sync with
// IntentName in src/server/line/ai/types.ts.
const intentSchema = z.enum([
  "facility.book", "facility.cancel", "facility.list",
  "repair.report", "visitor.notify", "complaint.file",
  "workorder.status", "small_talk", "unknown",
]);

// Permissive slot schema — every field optional (the user may confirm/correct a
// partial proposal before commit). `.passthrough()` keeps any extra NLP entities.
const slotSchema = z.object({
  date: z.string().optional(),
  time: z.string().optional(),
  facility: z.enum(["gym", "pool", "meeting_room", "lounge", "bbq", "sauna"]).optional(),
  duration_min: z.number().optional(),
  location: z.string().optional(),
  issue: z.string().optional(),
  visitor_name: z.string().optional(),
  visitor_count: z.number().optional(),
  urgency: z.enum(["low", "med", "high"]).optional(),
}).passthrough();

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

  // Voice → proposal. Transcribes, classifies, and returns a proposed booking /
  // work order. NEVER writes — the client shows a confirmation card, then calls
  // `commit`. See docs/superpowers/specs/2026-07-12-voice-booking-design.md.
  command: residentProcedure
    .input(z.object({
      audioBase64: z.string(),
      mimeType: z.string().default("audio/webm"),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioBase64, "base64");
      const result = await transcribeAudio({
        audioBuffer: buffer,
        audioMime: input.mimeType,
        language: input.language,
        prompt: "Transcribe the user's voice command for a luxury property management app. 請準確辨識,可能是中文或英文。",
      });
      if ("error" in result) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      const proposal = await buildVoiceProposal({
        transcript: result.text || "",
        classifier: getAi(),
        userId: String(ctx.user.id),
      });
      voiceAuditService.record({
        actorUserId: ctx.user.id, source: "resident", phase: "command",
        intent: proposal.intent, kind: proposal.kind,
        outcome: proposal.kind === "unclear" ? "unclear" : "proposed",
        transcript: proposal.transcript, slots: proposal.slots,
      });
      return proposal;
    }),

  // Confirmed proposal → book / dispatch, as the logged-in resident. Re-derives
  // the facility map from the live amenities table so voice bookings target the
  // same amenities as the LINE flow.
  commit: residentProcedure
    .input(z.object({ intent: intentSchema, slots: slotSchema }))
    .mutation(async ({ ctx, input }) => {
      const facilityMap = buildFacilityMap(await db.getAllAmenities());
      return auditedCommit({
        intent: input.intent as IntentName,
        slots: input.slots as Slot,
        userId: ctx.user.id,
        deps: { resolveAmenityId: (f) => facilityMap.get(f), ...commitDeps },
        actorUserId: ctx.user.id, source: "resident",
      });
    }),

  // ── Property-desk (staff-on-behalf) variants ────────────────────────────────
  // The tablet at the front desk lets 物業 file a booking / work order FOR a
  // resident. Same core, but the acting identity is the chosen `targetUserId`.

  // Resident directory for the desk's "代哪一戶" picker.
  residents: staffProcedure.query(async () => {
    const users = await db.getAllUsers();
    return users
      .filter((u: any) => u.role === "resident")
      .map((u: any) => ({
        id: u.id as number,
        name: (u.name ?? u.displayName ?? `住戶 #${u.id}`) as string,
        unitNumber: (u.unitNumber ?? null) as string | null,
      }));
  }),

  staffCommand: staffProcedure
    .input(z.object({
      audioBase64: z.string(),
      mimeType: z.string().default("audio/webm"),
      language: z.string().optional(),
      targetUserId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertResident(input.targetUserId);
      const buffer = Buffer.from(input.audioBase64, "base64");
      const result = await transcribeAudio({
        audioBuffer: buffer,
        audioMime: input.mimeType,
        language: input.language,
        prompt: "Transcribe the user's voice command for a luxury property management app. 請準確辨識,可能是中文或英文。",
      });
      if ("error" in result) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      const proposal = await buildVoiceProposal({
        transcript: result.text || "",
        classifier: getAi(),
        userId: String(input.targetUserId),
      });
      voiceAuditService.record({
        actorUserId: ctx.user.id, targetUserId: input.targetUserId, source: "staff", phase: "command",
        intent: proposal.intent, kind: proposal.kind,
        outcome: proposal.kind === "unclear" ? "unclear" : "proposed",
        transcript: proposal.transcript, slots: proposal.slots,
      });
      return proposal;
    }),

  staffCommit: staffProcedure
    .input(z.object({ intent: intentSchema, slots: slotSchema, targetUserId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertResident(input.targetUserId);
      const facilityMap = buildFacilityMap(await db.getAllAmenities());
      return auditedCommit({
        intent: input.intent as IntentName,
        slots: input.slots as Slot,
        userId: input.targetUserId,
        deps: { resolveAmenityId: (f) => facilityMap.get(f), ...commitDeps },
        actorUserId: ctx.user.id, targetUserId: input.targetUserId, source: "staff",
      });
    }),

  // Voice audit trail — who/when/what for every voice command + commit outcome.
  auditLogs: staffProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(({ input }) => ({
      items: voiceAuditService.getHistory(input?.limit ?? 50),
      stats: voiceAuditService.getStats(),
    })),
});

// Property-desk commits write as a resident — refuse any target that isn't one,
// so staff can't accidentally file bookings against an admin/logistics account.
async function assertResident(userId: number): Promise<void> {
  const target = await db.getUserById(userId);
  if (!target || target.role !== "resident") {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Target user ${userId} is not a resident.` });
  }
}

// Capacity guard for the voice booking path — mirrors bookingsRouter.create so a
// voice-confirmed booking can't overbook a full slot (audit finding C1).
async function assertBookingCapacity(input: {
  amenityId: number; date: string; startTime: string; guestCount: number;
}): Promise<void> {
  const amenity = await db.getAmenityById(input.amenityId);
  if (!amenity) throw new TRPCError({ code: "NOT_FOUND", message: "Amenity not found" });
  const existing = await db.getBookingsByAmenityAndDate(input.amenityId, input.date);
  const occupancy = existing
    .filter((b: any) => b.startTime === input.startTime)
    .reduce((sum: number, b: any) => sum + b.guestCount, 0);
  if (occupancy + input.guestCount > amenity.capacity) {
    const left = amenity.capacity - occupancy;
    throw new TRPCError({ code: "CONFLICT", message: `Capacity exceeded. Only ${left} spots left for this slot.` });
  }
}

// Shared commit deps (booking capacity guard + writers), reused by resident and
// property-desk commit procedures.
const commitDeps = {
  createBooking: async (i: any) => Number(await db.createBooking(i)),
  createWorkOrder: async (i: any) => Number(await db.createWorkOrder(i)),
  assertBookingAllowed: assertBookingCapacity,
};
