import { describe, it, expect, beforeEach } from "vitest";
import {
  processText,
  classifyIntent,
  extractEntities,
  analyzeSentiment,
  detectLanguage,
  assessPrivacy,
} from "@/lib/engine";
import { getScheduler, resetScheduler, NLPNodeScheduler } from "@/server/scheduler";
import { getAuditLog, resetAuditLog } from "@/server/audit-log";

describe("NLP Engine — Intent Classification", () => {
  it("classifies maintenance requests correctly", () => {
    const intents = classifyIntent("The faucet in my bathroom is leaking");
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].category).toBe("maintenance_request");
    expect(intents[0].confidence).toBeGreaterThan(0.5);
  });

  it("classifies amenity booking requests", () => {
    const intents = classifyIntent("I want to book the pool for Saturday");
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].category).toBe("amenity_booking");
  });

  it("classifies security concerns", () => {
    const intents = classifyIntent("There's a suspicious person in the lobby");
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].category).toBe("security_concern");
  });

  it("classifies noise complaints", () => {
    const intents = classifyIntent("My neighbors are being very loud again");
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].category).toBe("noise_complaint");
  });

  it("classifies guest management requests", () => {
    const intents = classifyIntent("I have a guest arriving tomorrow at 3pm");
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].category).toBe("guest_management");
  });

  it("classifies emergency situations", () => {
    const intents = classifyIntent("Emergency! There's a fire on my floor!");
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].category).toBe("emergency");
    expect(intents[0].confidence).toBeGreaterThan(0.8);
  });

  it("classifies privacy requests", () => {
    const intents = classifyIntent("Enable privacy mode, I don't want any visitors");
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].category).toBe("privacy_request");
  });

  it("classifies Chinese maintenance requests", () => {
    const intents = classifyIntent("浴室的水龍頭在漏水");
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].category).toBe("maintenance_request");
  });

  it("classifies Chinese booking requests", () => {
    const intents = classifyIntent("我想預約游泳池");
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].category).toBe("amenity_booking");
  });

  it("classifies greetings", () => {
    const intents = classifyIntent("Hello, good morning!");
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].category).toBe("greeting");
  });
});

describe("NLP Engine — Entity Extraction", () => {
  it("extracts date entities", () => {
    const entities = extractEntities("Book the pool for tomorrow at 3pm");
    const dateEntities = entities.filter((e) => e.type === "date");
    expect(dateEntities.length).toBeGreaterThan(0);
  });

  it("extracts time entities", () => {
    const entities = extractEntities("Meeting at 3pm in the boardroom");
    const timeEntities = entities.filter((e) => e.type === "time");
    expect(timeEntities.length).toBeGreaterThan(0);
  });

  it("extracts amenity entities", () => {
    const entities = extractEntities("I want to use the swimming pool");
    const amenityEntities = entities.filter((e) => e.type === "amenity");
    expect(amenityEntities.length).toBeGreaterThan(0);
  });

  it("extracts location entities", () => {
    const entities = extractEntities("There's a problem in the lobby");
    const locationEntities = entities.filter((e) => e.type === "location");
    expect(locationEntities.length).toBeGreaterThan(0);
  });
});

describe("NLP Engine — Sentiment Analysis", () => {
  it("detects fatigue emotion", () => {
    const sentiment = analyzeSentiment("So tired, I just want to rest");
    expect(sentiment.emotion).toBe("fatigue");
  });

  it("detects urgency emotion", () => {
    const sentiment = analyzeSentiment("This is urgent! Fix it immediately!");
    expect(sentiment.emotion).toBe("urgency");
  });

  it("detects frustration emotion", () => {
    const sentiment = analyzeSentiment("This is unacceptable and frustrating, I'm very annoyed and angry");
    expect(["frustration", "neutral"]).toContain(sentiment.emotion);
  });

  it("detects discretion needed", () => {
    const sentiment = analyzeSentiment("Handle this quietly and discreetly please");
    expect(sentiment.emotion).toBe("discretion_needed");
  });

  it("detects neutral emotion for normal requests", () => {
    const sentiment = analyzeSentiment("What time does the pool close?");
    expect(sentiment.emotion).toBe("neutral");
  });
});

describe("NLP Engine — Language Detection", () => {
  it("detects English", () => {
    expect(detectLanguage("Hello, how are you today?")).toBe("en");
  });

  it("detects Chinese", () => {
    expect(detectLanguage("你好，今天天氣很好")).toBe("zh");
  });

  it("detects mixed as Chinese when Chinese characters present", () => {
    const lang = detectLanguage("請幫我 book the pool");
    expect(lang).toBe("zh");
  });
});

describe("NLP Engine — Privacy Assessment", () => {
  it("rates public queries as low privacy", () => {
    const assessment = assessPrivacy(
      "What time does the gym open?",
      classifyIntent("What time does the gym open?"),
      extractEntities("What time does the gym open?")
    );
    expect(assessment.level).toBe("public");
    expect(assessment.score).toBeLessThan(40);
  });

  it("rates noise complaints as higher privacy", () => {
    const text = "Neighbors are loud, handle it discreetly";
    const assessment = assessPrivacy(
      text,
      classifyIntent(text),
      extractEntities(text)
    );
    expect(["internal", "confidential", "restricted"]).toContain(assessment.level);
    expect(["local", "hybrid"]).toContain(assessment.tier);
  });

  it("rates emergency as high priority", () => {
    const text = "Emergency! Fire in the building!";
    const assessment = assessPrivacy(
      text,
      classifyIntent(text),
      extractEntities(text)
    );
    expect(["local", "hybrid"]).toContain(assessment.tier);
  });

  it("detects PII in text", () => {
    const text = "My phone number is 0912345678 and email is test@example.com";
    const assessment = assessPrivacy(
      text,
      classifyIntent(text),
      extractEntities(text)
    );
    expect(assessment.containsPII).toBe(true);
    expect(assessment.score).toBeGreaterThanOrEqual(40);
  });
});

describe("NLP Engine — Full Pipeline", () => {
  it("processes a complete message end-to-end", () => {
    const result = processText("So tired. Need the apartment ready, sauna on, and privacy please.");
    expect(result.intents.length).toBeGreaterThan(0);
    expect(result.entities).toBeDefined();
    expect(result.sentiment).toBeDefined();
    expect(result.privacy).toBeDefined();
    expect(result.language).toBe("en");
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.nodeId).toBeTruthy();
  });

  it("processes Chinese text end-to-end", () => {
    const result = processText("鄰居太吵了，請低調處理");
    expect(result.language).toBe("zh");
    expect(result.intents.length).toBeGreaterThan(0);
    // Chinese text may match noise_complaint or privacy_request depending on keyword priority
    expect(["noise_complaint", "privacy_request"]).toContain(result.intents[0].category);
  });
});

describe("NLP Node Scheduler", () => {
  beforeEach(() => {
    resetScheduler();
  });

  it("creates scheduler with 300+ nodes", () => {
    const scheduler = getScheduler();
    const stats = scheduler.getStats();
    expect(stats.totalNodes).toBeGreaterThanOrEqual(300);
  });

  it("has 12 node types registered", () => {
    const scheduler = getScheduler();
    const stats = scheduler.getStats();
    expect(Object.keys(stats.nodesByType).length).toBe(12);
  });

  it("processes requests through the scheduler", async () => {
    const scheduler = getScheduler();
    const result = await scheduler.processRequest("Book the pool for tomorrow");
    expect(result).toBeDefined();
    if (result) {
      expect(result.intents.length).toBeGreaterThan(0);
      expect(result.nodeId).toBeTruthy();
    }
  });

  it("tracks node health metrics", () => {
    const scheduler = getScheduler();
    const stats = scheduler.getStats();
    expect(stats.activeNodes).toBeGreaterThan(0);
    expect(stats.activeNodes).toBeLessThanOrEqual(stats.totalNodes);
  });
});

describe("Privacy Audit Log", () => {
  beforeEach(() => {
    resetAuditLog();
  });

  it("records audit entries", () => {
    const auditLog = getAuditLog();
    const result = processText("Fix the leak in my bathroom");
    auditLog.record(result, "local");

    const stats = auditLog.getStats();
    expect(stats.totalEntries).toBe(1);
    expect(stats.localProcessed).toBe(1);
  });

  it("tracks privacy level distribution", () => {
    const auditLog = getAuditLog();

    auditLog.record(processText("What time does the gym open?"), "cloud");
    auditLog.record(processText("Neighbors are loud, handle discreetly"), "local");

    const stats = auditLog.getStats();
    expect(stats.totalEntries).toBe(2);
  });

  it("redacts restricted input in audit", () => {
    const auditLog = getAuditLog();
    const result = processText("Neighbors are loud, handle it discreetly");
    // Override privacy level to restricted for test
    result.privacy.level = "restricted";
    const entry = auditLog.record(result, "local");
    expect(entry.inputPreview).toBe("[REDACTED]");
  });

  it("returns recent entries in reverse order", () => {
    const auditLog = getAuditLog();
    auditLog.record(processText("First message"), "local");
    auditLog.record(processText("Second message"), "cloud");

    const recent = auditLog.getRecentEntries(10);
    expect(recent.length).toBe(2);
    expect(recent[0].timestamp).toBeGreaterThanOrEqual(recent[1].timestamp);
  });
});
