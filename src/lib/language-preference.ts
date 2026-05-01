import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@mai_touch_language_prefs";

/**
 * Supported language codes and their display labels.
 */
export const SUPPORTED_LANGUAGES: Record<string, { label: string; flag: string; nativeName: string }> = {
  en: { label: "English", flag: "🇺🇸", nativeName: "English" },
  zh: { label: "Chinese", flag: "🇨🇳", nativeName: "中文" },
  ja: { label: "Japanese", flag: "🇯🇵", nativeName: "日本語" },
  ko: { label: "Korean", flag: "🇰🇷", nativeName: "한국어" },
  es: { label: "Spanish", flag: "🇪🇸", nativeName: "Español" },
  fr: { label: "French", flag: "🇫🇷", nativeName: "Français" },
  de: { label: "German", flag: "🇩🇪", nativeName: "Deutsch" },
};

export type LanguageCode = string;

export interface LanguageUsageRecord {
  /** ISO language code */
  code: LanguageCode;
  /** Number of times this language was detected */
  count: number;
  /** Timestamp of last usage */
  lastUsed: number;
}

export interface LanguagePreferences {
  /** Language usage frequency records */
  usageHistory: LanguageUsageRecord[];
  /** User's manually set preferred language, or null for auto-detect */
  manualOverride: LanguageCode | null;
  /** Total number of voice interactions tracked */
  totalInteractions: number;
}

const DEFAULT_PREFS: LanguagePreferences = {
  usageHistory: [],
  manualOverride: null,
  totalInteractions: 0,
};

/**
 * Load language preferences from AsyncStorage.
 */
export async function loadLanguagePreferences(): Promise<LanguagePreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as LanguagePreferences;
    // Validate structure
    if (!Array.isArray(parsed.usageHistory)) return { ...DEFAULT_PREFS };
    return parsed;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/**
 * Save language preferences to AsyncStorage.
 */
export async function saveLanguagePreferences(prefs: LanguagePreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.error("Failed to save language preferences:", err);
  }
}

/**
 * Record a detected language from a voice transcription.
 * Updates usage count and last-used timestamp.
 */
export async function recordLanguageUsage(langCode: LanguageCode): Promise<LanguagePreferences> {
  const prefs = await loadLanguagePreferences();
  const now = Date.now();

  const existing = prefs.usageHistory.find((r) => r.code === langCode);
  if (existing) {
    existing.count += 1;
    existing.lastUsed = now;
  } else {
    prefs.usageHistory.push({ code: langCode, count: 1, lastUsed: now });
  }

  prefs.totalInteractions += 1;

  // Sort by count descending, then by lastUsed descending
  prefs.usageHistory.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.lastUsed - a.lastUsed;
  });

  await saveLanguagePreferences(prefs);
  return prefs;
}

/**
 * Set a manual language override. Pass null to revert to auto-detect.
 */
export async function setManualLanguageOverride(
  langCode: LanguageCode | null
): Promise<LanguagePreferences> {
  const prefs = await loadLanguagePreferences();
  prefs.manualOverride = langCode;
  await saveLanguagePreferences(prefs);
  return prefs;
}

/**
 * Get the preferred language to use as a hint for Whisper.
 *
 * Priority:
 * 1. Manual override (if set by user)
 * 2. Most frequently used language (if usage count >= 3 and dominance ratio >= 60%)
 * 3. null (auto-detect, no hint)
 *
 * The dominance ratio ensures we only send a hint when the user clearly
 * prefers one language, avoiding incorrect hints for bilingual users.
 */
export function getPreferredLanguage(prefs: LanguagePreferences): LanguageCode | null {
  // Priority 1: Manual override
  if (prefs.manualOverride) {
    return prefs.manualOverride;
  }

  // Priority 2: Most frequent language with sufficient confidence
  if (prefs.usageHistory.length === 0 || prefs.totalInteractions < 3) {
    return null;
  }

  const topLang = prefs.usageHistory[0];
  const dominanceRatio = topLang.count / prefs.totalInteractions;

  // Only hint if the dominant language accounts for >= 60% of interactions
  if (dominanceRatio >= 0.6 && topLang.count >= 3) {
    return topLang.code;
  }

  return null;
}

/**
 * Get a human-readable summary of language usage for display.
 */
export function getLanguageUsageSummary(prefs: LanguagePreferences): string {
  if (prefs.totalInteractions === 0) {
    return "No voice interactions yet";
  }

  const parts = prefs.usageHistory
    .slice(0, 3)
    .map((r) => {
      const info = SUPPORTED_LANGUAGES[r.code];
      const label = info ? info.nativeName : r.code.toUpperCase();
      const pct = Math.round((r.count / prefs.totalInteractions) * 100);
      return `${label} ${pct}%`;
    });

  return parts.join(" · ");
}

/**
 * Get the display info for the current preferred language.
 */
export function getPreferredLanguageDisplay(prefs: LanguagePreferences): {
  mode: "auto" | "manual" | "learned";
  language: LanguageCode | null;
  label: string;
} {
  if (prefs.manualOverride) {
    const info = SUPPORTED_LANGUAGES[prefs.manualOverride];
    return {
      mode: "manual",
      language: prefs.manualOverride,
      label: info ? `${info.flag} ${info.nativeName}` : prefs.manualOverride,
    };
  }

  const preferred = getPreferredLanguage(prefs);
  if (preferred) {
    const info = SUPPORTED_LANGUAGES[preferred];
    return {
      mode: "learned",
      language: preferred,
      label: info ? `${info.flag} ${info.nativeName} (Learned)` : `${preferred} (Learned)`,
    };
  }

  return {
    mode: "auto",
    language: null,
    label: "🌐 Auto-detect",
  };
}
