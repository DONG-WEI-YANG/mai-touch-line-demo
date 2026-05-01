import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

import {
  loadLanguagePreferences,
  saveLanguagePreferences,
  recordLanguageUsage,
  setManualLanguageOverride,
  getPreferredLanguage,
  getLanguageUsageSummary,
  getPreferredLanguageDisplay,
  SUPPORTED_LANGUAGES,
  type LanguagePreferences,
} from "@/lib/language-preference";

describe("language-preference", () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  describe("loadLanguagePreferences", () => {
    it("returns default prefs when storage is empty", async () => {
      const prefs = await loadLanguagePreferences();
      expect(prefs.usageHistory).toEqual([]);
      expect(prefs.manualOverride).toBeNull();
      expect(prefs.totalInteractions).toBe(0);
    });

    it("returns saved prefs from storage", async () => {
      const saved: LanguagePreferences = {
        usageHistory: [{ code: "en", count: 5, lastUsed: 1000 }],
        manualOverride: null,
        totalInteractions: 5,
      };
      mockStorage["@mai_touch_language_prefs"] = JSON.stringify(saved);
      const prefs = await loadLanguagePreferences();
      expect(prefs.totalInteractions).toBe(5);
      expect(prefs.usageHistory[0].code).toBe("en");
    });

    it("returns default prefs when storage has invalid data", async () => {
      mockStorage["@mai_touch_language_prefs"] = "not-json";
      const prefs = await loadLanguagePreferences();
      expect(prefs.usageHistory).toEqual([]);
    });
  });

  describe("recordLanguageUsage", () => {
    it("records first usage of a language", async () => {
      const prefs = await recordLanguageUsage("en");
      expect(prefs.totalInteractions).toBe(1);
      expect(prefs.usageHistory.length).toBe(1);
      expect(prefs.usageHistory[0].code).toBe("en");
      expect(prefs.usageHistory[0].count).toBe(1);
    });

    it("increments count for repeated language usage", async () => {
      await recordLanguageUsage("zh");
      await recordLanguageUsage("zh");
      const prefs = await recordLanguageUsage("zh");
      expect(prefs.totalInteractions).toBe(3);
      expect(prefs.usageHistory[0].code).toBe("zh");
      expect(prefs.usageHistory[0].count).toBe(3);
    });

    it("tracks multiple languages and sorts by count", async () => {
      await recordLanguageUsage("en");
      await recordLanguageUsage("zh");
      await recordLanguageUsage("en");
      await recordLanguageUsage("en");
      const prefs = await recordLanguageUsage("zh");
      // Note: counts may include prior test data since storage persists within describe
      // Check relative ordering: en should be first (more uses)
      const enRecord = prefs.usageHistory.find((r) => r.code === "en");
      const zhRecord = prefs.usageHistory.find((r) => r.code === "zh");
      expect(enRecord).toBeDefined();
      expect(zhRecord).toBeDefined();
      expect(enRecord!.count).toBeGreaterThan(zhRecord!.count);
      expect(prefs.usageHistory[0].code).toBe("en");
    });
  });

  describe("setManualLanguageOverride", () => {
    it("sets a manual language override", async () => {
      const prefs = await setManualLanguageOverride("zh");
      expect(prefs.manualOverride).toBe("zh");
    });

    it("clears manual override when set to null", async () => {
      await setManualLanguageOverride("zh");
      const prefs = await setManualLanguageOverride(null);
      expect(prefs.manualOverride).toBeNull();
    });
  });

  describe("getPreferredLanguage", () => {
    it("returns null when no history", () => {
      const prefs: LanguagePreferences = {
        usageHistory: [],
        manualOverride: null,
        totalInteractions: 0,
      };
      expect(getPreferredLanguage(prefs)).toBeNull();
    });

    it("returns manual override when set", () => {
      const prefs: LanguagePreferences = {
        usageHistory: [{ code: "en", count: 10, lastUsed: 1000 }],
        manualOverride: "zh",
        totalInteractions: 10,
      };
      expect(getPreferredLanguage(prefs)).toBe("zh");
    });

    it("returns null when fewer than 3 interactions", () => {
      const prefs: LanguagePreferences = {
        usageHistory: [{ code: "en", count: 2, lastUsed: 1000 }],
        manualOverride: null,
        totalInteractions: 2,
      };
      expect(getPreferredLanguage(prefs)).toBeNull();
    });

    it("returns dominant language when >= 60% and >= 3 uses", () => {
      const prefs: LanguagePreferences = {
        usageHistory: [
          { code: "zh", count: 8, lastUsed: 1000 },
          { code: "en", count: 2, lastUsed: 900 },
        ],
        manualOverride: null,
        totalInteractions: 10,
      };
      expect(getPreferredLanguage(prefs)).toBe("zh");
    });

    it("returns null when no dominant language (50/50 split)", () => {
      const prefs: LanguagePreferences = {
        usageHistory: [
          { code: "en", count: 5, lastUsed: 1000 },
          { code: "zh", count: 5, lastUsed: 900 },
        ],
        manualOverride: null,
        totalInteractions: 10,
      };
      expect(getPreferredLanguage(prefs)).toBeNull();
    });

    it("returns dominant language at exactly 60% threshold", () => {
      const prefs: LanguagePreferences = {
        usageHistory: [
          { code: "en", count: 6, lastUsed: 1000 },
          { code: "zh", count: 4, lastUsed: 900 },
        ],
        manualOverride: null,
        totalInteractions: 10,
      };
      expect(getPreferredLanguage(prefs)).toBe("en");
    });
  });

  describe("getLanguageUsageSummary", () => {
    it("returns message when no interactions", () => {
      const prefs: LanguagePreferences = {
        usageHistory: [],
        manualOverride: null,
        totalInteractions: 0,
      };
      expect(getLanguageUsageSummary(prefs)).toBe("No voice interactions yet");
    });

    it("returns percentage summary for known languages", () => {
      const prefs: LanguagePreferences = {
        usageHistory: [
          { code: "en", count: 7, lastUsed: 1000 },
          { code: "zh", count: 3, lastUsed: 900 },
        ],
        manualOverride: null,
        totalInteractions: 10,
      };
      const summary = getLanguageUsageSummary(prefs);
      expect(summary).toContain("English");
      expect(summary).toContain("70%");
      expect(summary).toContain("中文");
      expect(summary).toContain("30%");
    });
  });

  describe("getPreferredLanguageDisplay", () => {
    it("returns auto mode when no data", () => {
      const prefs: LanguagePreferences = {
        usageHistory: [],
        manualOverride: null,
        totalInteractions: 0,
      };
      const display = getPreferredLanguageDisplay(prefs);
      expect(display.mode).toBe("auto");
      expect(display.language).toBeNull();
      expect(display.label).toContain("Auto-detect");
    });

    it("returns manual mode when override is set", () => {
      const prefs: LanguagePreferences = {
        usageHistory: [],
        manualOverride: "zh",
        totalInteractions: 0,
      };
      const display = getPreferredLanguageDisplay(prefs);
      expect(display.mode).toBe("manual");
      expect(display.language).toBe("zh");
      expect(display.label).toContain("中文");
    });

    it("returns learned mode when dominant language exists", () => {
      const prefs: LanguagePreferences = {
        usageHistory: [
          { code: "en", count: 8, lastUsed: 1000 },
          { code: "zh", count: 2, lastUsed: 900 },
        ],
        manualOverride: null,
        totalInteractions: 10,
      };
      const display = getPreferredLanguageDisplay(prefs);
      expect(display.mode).toBe("learned");
      expect(display.language).toBe("en");
      expect(display.label).toContain("English");
      expect(display.label).toContain("Learned");
    });
  });

  describe("SUPPORTED_LANGUAGES", () => {
    it("includes English and Chinese", () => {
      expect(SUPPORTED_LANGUAGES["en"]).toBeDefined();
      expect(SUPPORTED_LANGUAGES["zh"]).toBeDefined();
      expect(SUPPORTED_LANGUAGES["en"].label).toBe("English");
      expect(SUPPORTED_LANGUAGES["zh"].nativeName).toBe("中文");
    });

    it("has flag, label, and nativeName for all entries", () => {
      Object.entries(SUPPORTED_LANGUAGES).forEach(([code, info]) => {
        expect(info.flag).toBeTruthy();
        expect(info.label).toBeTruthy();
        expect(info.nativeName).toBeTruthy();
      });
    });
  });
});
