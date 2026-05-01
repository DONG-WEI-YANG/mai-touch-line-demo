/**
 * m'AI Touch — Local Tiny NLP Engine
 * 
 * A lightweight, privacy-first NLP processing engine that runs entirely on-device.
 * Supports 12+ intent classifiers, entity extraction, sentiment/emotion analysis,
 * and privacy-graded routing to decide local vs cloud processing.
 * 
 * Designed for elite residential communities where data privacy is paramount.
 * Created by Peter Yang
 */

// ============================================================
// TYPES
// ============================================================

export type PrivacyLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export type ProcessingTier = 'local' | 'cloud' | 'hybrid';

export type IntentCategory =
  | 'amenity_booking'
  | 'maintenance_request'
  | 'concierge_service'
  | 'security_concern'
  | 'noise_complaint'
  | 'guest_management'
  | 'space_control'
  | 'privacy_request'
  | 'lifestyle_service'
  | 'social_mediation'
  | 'emergency'
  | 'general_inquiry'
  | 'greeting'
  | 'feedback';

export type EmotionType =
  | 'neutral'
  | 'fatigue'
  | 'urgency'
  | 'frustration'
  | 'satisfaction'
  | 'anxiety'
  | 'discretion_needed';

export interface NLPIntent {
  category: IntentCategory;
  confidence: number;
  subIntent?: string;
}

export interface NLPEntity {
  type: 'person' | 'location' | 'amenity' | 'date' | 'time' | 'number' | 'service' | 'unit_number' | 'floor';
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface NLPSentiment {
  score: number;       // -1.0 (negative) to 1.0 (positive)
  magnitude: number;   // 0.0 to 1.0 (intensity)
  emotion: EmotionType;
  emotionConfidence: number;
}

export interface PrivacyAssessment {
  level: PrivacyLevel;
  score: number;         // 0-100, higher = more sensitive
  tier: ProcessingTier;
  reasons: string[];
  containsPII: boolean;
  containsUnitInfo: boolean;
  containsSecurityInfo: boolean;
}

export interface NLPResult {
  input: string;
  language: 'en' | 'zh' | 'mixed' | 'unknown';
  intents: NLPIntent[];
  entities: NLPEntity[];
  sentiment: NLPSentiment;
  privacy: PrivacyAssessment;
  processingTimeMs: number;
  nodeId: string;
  modelVersions: string[];
}

// ============================================================
// INTENT CLASSIFICATION (Rule-based + Pattern Matching)
// ============================================================

interface IntentPattern {
  category: IntentCategory;
  patterns: RegExp[];
  keywords: string[];
  keywordsCN: string[];
  baseConfidence: number;
  subIntentMap?: Record<string, RegExp[]>;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    category: 'amenity_booking',
    patterns: [
      /\b(book|reserve|schedule)\b.*\b(pool|gym|spa|sauna|cinema|dining|garden|terrace|boardroom|court)\b/i,
      /\b(pool|gym|spa|sauna|cinema|dining)\b.*\b(available|open|free|slot)\b/i,
      /預約|訂位|預訂|安排.*使用/,
    ],
    keywords: ['book', 'reserve', 'reservation', 'schedule', 'slot', 'availability', 'amenity', 'facility'],
    keywordsCN: ['預約', '訂位', '預訂', '設施', '場地', '使用', '泳池', '健身房', '水療', '三溫暖', '電影院', '餐廳'],
    baseConfidence: 0.85,
    subIntentMap: {
      'pool': [/pool|泳池|游泳/i],
      'gym': [/gym|fitness|健身/i],
      'spa': [/spa|wellness|水療|養生/i],
      'sauna': [/sauna|三溫暖|桑拿/i],
      'cinema': [/cinema|movie|theater|電影/i],
      'dining': [/dining|dinner|lunch|restaurant|餐廳|用餐/i],
      'garden': [/garden|terrace|花園|露台/i],
      'boardroom': [/boardroom|meeting|conference|會議/i],
    },
  },
  {
    category: 'maintenance_request',
    patterns: [
      /\b(fix|repair|broken|leak|damage|malfunction|not working)\b/i,
      /\b(maintenance|plumber|electrician|handyman)\b/i,
      /修理|維修|壞了|漏水|故障|損壞|不能用/,
    ],
    keywords: ['fix', 'repair', 'broken', 'leak', 'damage', 'maintenance', 'plumber', 'electrician', 'replace'],
    keywordsCN: ['修理', '維修', '壞', '漏水', '故障', '損壞', '更換', '水管', '電器', '冷氣'],
    baseConfidence: 0.88,
    subIntentMap: {
      'plumbing': [/plumb|pipe|water|leak|faucet|toilet|水管|漏水|馬桶|水龍頭/i],
      'electrical': [/electric|light|power|outlet|switch|電|燈|插座|開關/i],
      'hvac': [/air|heat|cool|temperature|ac|hvac|冷氣|暖氣|溫度|空調/i],
      'structural': [/wall|floor|ceiling|door|window|牆|地板|天花板|門|窗/i],
    },
  },
  {
    category: 'concierge_service',
    patterns: [
      /\b(arrange|organize|plan|order|deliver|catering|banquet)\b/i,
      /\b(concierge|butler|service|assist)\b/i,
      /安排|管家|服務|外送|宴會|代辦/,
    ],
    keywords: ['arrange', 'organize', 'plan', 'order', 'deliver', 'concierge', 'butler', 'catering', 'banquet'],
    keywordsCN: ['安排', '管家', '服務', '外送', '宴會', '代辦', '訂餐', '花束', '禮物', '接送'],
    baseConfidence: 0.82,
  },
  {
    category: 'security_concern',
    patterns: [
      /\b(suspicious|stranger|intruder|break.?in|theft|stolen|alarm)\b/i,
      /\b(security|guard|patrol|surveillance|camera|cctv)\b/i,
      /可疑|陌生人|闖入|偷竊|警報|保全|監控|巡邏/,
    ],
    keywords: ['security', 'suspicious', 'stranger', 'intruder', 'theft', 'alarm', 'guard', 'patrol', 'camera'],
    keywordsCN: ['保全', '可疑', '陌生人', '闖入', '偷竊', '警報', '監控', '巡邏', '安全'],
    baseConfidence: 0.90,
  },
  {
    category: 'noise_complaint',
    patterns: [
      /\b(noise|loud|noisy|quiet|disturb|party|music)\b.*\b(neighbor|next.?door|upstairs|downstairs|floor)\b/i,
      /\b(neighbor|next.?door)\b.*\b(noise|loud|noisy|quiet|disturb|party)\b/i,
      /鄰居.*吵|噪音|太吵|太大聲|安靜|打擾|擾民/,
    ],
    keywords: ['noise', 'loud', 'noisy', 'quiet', 'disturb', 'neighbor', 'party', 'music', 'volume'],
    keywordsCN: ['噪音', '吵', '大聲', '安靜', '鄰居', '打擾', '擾民', '派對', '音樂'],
    baseConfidence: 0.87,
  },
  {
    category: 'guest_management',
    patterns: [
      /\b(guest|visitor|friend|family|arrive|arriving|coming|visit)\b/i,
      /\b(entry|access|pass|clearance|register)\b.*\b(guest|visitor)\b/i,
      /訪客|客人|朋友.*來|家人.*到|來訪|通行|登記/,
    ],
    keywords: ['guest', 'visitor', 'arrive', 'arriving', 'visit', 'entry', 'access', 'pass', 'clearance'],
    keywordsCN: ['訪客', '客人', '朋友', '家人', '來訪', '通行', '登記', '接待', '到訪'],
    baseConfidence: 0.85,
  },
  {
    category: 'space_control',
    patterns: [
      /\b(temperature|thermostat|light|lighting|blind|curtain|elevator|lift)\b/i,
      /\b(apartment|unit|room|home)\b.*\b(ready|prepare|warm|cool|clean)\b/i,
      /溫度|燈光|窗簾|電梯|準備.*房|打掃|清潔/,
    ],
    keywords: ['temperature', 'thermostat', 'light', 'lighting', 'blind', 'curtain', 'elevator', 'prepare', 'ready'],
    keywordsCN: ['溫度', '燈光', '窗簾', '電梯', '準備', '打掃', '清潔', '空調', '暖氣'],
    baseConfidence: 0.83,
  },
  {
    category: 'privacy_request',
    patterns: [
      /\b(privacy|private|do not disturb|dnd|discreet|confidential|quiet mode)\b/i,
      /\b(no.?visitor|block|restrict|hide)\b/i,
      /隱私|勿擾|低調|保密|不要打擾|安靜模式/,
    ],
    keywords: ['privacy', 'private', 'disturb', 'discreet', 'confidential', 'quiet', 'block', 'restrict'],
    keywordsCN: ['隱私', '勿擾', '低調', '保密', '不要打擾', '安靜', '封鎖', '限制'],
    baseConfidence: 0.88,
  },
  {
    category: 'lifestyle_service',
    patterns: [
      /\b(restaurant|reservation|spa|massage|yoga|fitness|personal.?train|chef)\b/i,
      /\b(dry.?clean|laundry|tailor|shopping|stylist)\b/i,
      /餐廳|按摩|瑜伽|健身|私人教練|乾洗|洗衣|裁縫|購物|造型/,
    ],
    keywords: ['restaurant', 'spa', 'massage', 'yoga', 'fitness', 'trainer', 'chef', 'laundry', 'tailor', 'shopping'],
    keywordsCN: ['餐廳', '按摩', '瑜伽', '健身', '教練', '主廚', '乾洗', '洗衣', '裁縫', '購物', '造型'],
    baseConfidence: 0.80,
  },
  {
    category: 'social_mediation',
    patterns: [
      /\b(neighbor|dispute|complaint|mediat|resolv|conflict)\b/i,
      /\b(community|rule|regulation|violation|fine)\b/i,
      /鄰居.*糾紛|投訴|調解|衝突|社區.*規定|違規/,
    ],
    keywords: ['neighbor', 'dispute', 'complaint', 'mediate', 'resolve', 'conflict', 'community', 'rule', 'violation'],
    keywordsCN: ['鄰居', '糾紛', '投訴', '調解', '衝突', '社區', '規定', '違規', '罰款'],
    baseConfidence: 0.84,
  },
  {
    category: 'emergency',
    patterns: [
      /\b(emergency|fire|flood|gas.?leak|earthquake|help|sos|911|119)\b/i,
      /\b(ambulance|police|fire.?department)\b/i,
      /緊急|火災|水災|瓦斯|地震|救命|救護車|警察|消防/,
    ],
    keywords: ['emergency', 'fire', 'flood', 'gas', 'earthquake', 'help', 'sos', 'ambulance', 'police'],
    keywordsCN: ['緊急', '火災', '水災', '瓦斯', '地震', '救命', '救護車', '警察', '消防'],
    baseConfidence: 0.95,
  },
  {
    category: 'greeting',
    patterns: [
      /^(hi|hello|hey|good\s*(morning|afternoon|evening|night)|howdy|greetings)\b/i,
      /^(你好|哈囉|嗨|早安|午安|晚安|早上好|下午好|晚上好)/,
    ],
    keywords: ['hi', 'hello', 'hey', 'morning', 'afternoon', 'evening'],
    keywordsCN: ['你好', '哈囉', '嗨', '早安', '午安', '晚安'],
    baseConfidence: 0.92,
  },
  {
    category: 'general_inquiry',
    patterns: [
      /\b(what|when|where|how|who|which|can you|could you|tell me|inform)\b/i,
      /什麼|何時|哪裡|怎麼|誰|哪個|可以.*嗎|告訴我|請問/,
    ],
    keywords: ['what', 'when', 'where', 'how', 'who', 'which', 'tell', 'inform', 'question'],
    keywordsCN: ['什麼', '何時', '哪裡', '怎麼', '誰', '哪個', '請問', '告訴'],
    baseConfidence: 0.65,
  },
  {
    category: 'feedback',
    patterns: [
      /\b(thank|thanks|great|excellent|wonderful|appreciate|satisfied|happy|love)\b/i,
      /\b(complaint|unhappy|dissatisfied|terrible|awful|poor|bad service)\b/i,
      /謝謝|感謝|很好|太棒|滿意|開心|投訴|不滿|糟糕|差勁/,
    ],
    keywords: ['thank', 'great', 'excellent', 'appreciate', 'complaint', 'unhappy', 'dissatisfied'],
    keywordsCN: ['謝謝', '感謝', '很好', '太棒', '滿意', '投訴', '不滿', '糟糕'],
    baseConfidence: 0.78,
  },
];

export function classifyIntent(text: string): NLPIntent[] {
  const normalized = text.toLowerCase().trim();
  const results: NLPIntent[] = [];

  for (const pattern of INTENT_PATTERNS) {
    let confidence = 0;

    // Pattern matching (highest weight)
    for (const regex of pattern.patterns) {
      if (regex.test(normalized)) {
        confidence = Math.max(confidence, pattern.baseConfidence);
        break;
      }
    }

    // Keyword matching (additive)
    const allKeywords = [...pattern.keywords, ...pattern.keywordsCN];
    let keywordHits = 0;
    for (const kw of allKeywords) {
      if (normalized.includes(kw.toLowerCase())) {
        keywordHits++;
      }
    }
    if (keywordHits > 0) {
      const kwScore = Math.min(0.15 * keywordHits, 0.45);
      confidence = Math.max(confidence, pattern.baseConfidence * 0.6 + kwScore);
    }

    if (confidence > 0.3) {
      let subIntent: string | undefined;
      if (pattern.subIntentMap) {
        for (const [sub, regexes] of Object.entries(pattern.subIntentMap)) {
          for (const r of regexes) {
            if (r.test(normalized)) {
              subIntent = sub;
              break;
            }
          }
          if (subIntent) break;
        }
      }

      results.push({
        category: pattern.category,
        confidence: Math.min(confidence, 0.99),
        subIntent,
      });
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  // If no intent matched, default to general_inquiry
  if (results.length === 0) {
    results.push({ category: 'general_inquiry', confidence: 0.4 });
  }

  return results;
}

// ============================================================
// ENTITY EXTRACTION
// ============================================================

const ENTITY_PATTERNS: { type: NLPEntity['type']; patterns: { regex: RegExp; group?: number }[] }[] = [
  {
    type: 'date',
    patterns: [
      { regex: /\b(today|tomorrow|yesterday|next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi },
      { regex: /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g },
      { regex: /\b(\d{1,2}[-/]\d{1,2})\b/g },
      { regex: /(今天|明天|後天|昨天|下週[一二三四五六日]|下個?禮拜[一二三四五六日])/g },
    ],
  },
  {
    type: 'time',
    patterns: [
      { regex: /\b(\d{1,2}:\d{2}\s*(am|pm)?)\b/gi },
      { regex: /\b(\d{1,2}\s*(am|pm|o'clock))\b/gi },
      { regex: /(上午|下午|晚上|早上|中午)?\s*(\d{1,2})[點時](半|\d{1,2}分)?/g },
    ],
  },
  {
    type: 'amenity',
    patterns: [
      { regex: /\b(pool|gym|spa|sauna|cinema|dining\s*room|garden|terrace|boardroom|court|lounge|library)\b/gi },
      { regex: /(泳池|健身房|水療|三溫暖|電影院|餐廳|花園|露台|會議室|球場|休息室|圖書館)/g },
    ],
  },
  {
    type: 'location',
    patterns: [
      { regex: /\b(lobby|entrance|parking|garage|rooftop|basement|level\s*\d+|floor\s*\d+)\b/gi },
      { regex: /(大廳|入口|停車場|車庫|頂樓|地下室|\d+樓|\d+層)/g },
    ],
  },
  {
    type: 'unit_number',
    patterns: [
      { regex: /\b(unit|apt|apartment|suite|room)\s*#?\s*(\d+[a-z]?)\b/gi, group: 2 },
      { regex: /(\d+[a-z]?\s*號?(房|室))/gi },
    ],
  },
  {
    type: 'floor',
    patterns: [
      { regex: /\b(\d+)(st|nd|rd|th)\s*floor\b/gi, group: 1 },
      { regex: /\bfloor\s*(\d+)\b/gi, group: 1 },
      { regex: /(\d+)\s*樓/g, group: 1 },
    ],
  },
  {
    type: 'number',
    patterns: [
      { regex: /\b(\d+)\s*(people|person|guest|guests|pax|位|人|個)\b/gi, group: 1 },
      { regex: /\b(\d+)\s*(hour|hours|minute|minutes|小時|分鐘)\b/gi, group: 1 },
    ],
  },
  {
    type: 'person',
    patterns: [
      { regex: /\b(mr|mrs|ms|dr|prof)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g },
    ],
  },
  {
    type: 'service',
    patterns: [
      { regex: /\b(cleaning|laundry|dry\s*clean|catering|valet|shuttle|delivery|massage|yoga|training)\b/gi },
      { regex: /(清潔|洗衣|乾洗|外燴|代客泊車|接駁|外送|按摩|瑜伽|訓練)/g },
    ],
  },
];

export function extractEntities(text: string): NLPEntity[] {
  const entities: NLPEntity[] = [];

  for (const entityDef of ENTITY_PATTERNS) {
    for (const patternDef of entityDef.patterns) {
      const regex = new RegExp(patternDef.regex.source, patternDef.regex.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const value = patternDef.group !== undefined ? match[patternDef.group] : match[0];
        if (value) {
          entities.push({
            type: entityDef.type,
            value: value.trim(),
            start: match.index,
            end: match.index + match[0].length,
            confidence: 0.85,
          });
        }
      }
    }
  }

  // Deduplicate overlapping entities (keep higher confidence)
  entities.sort((a, b) => a.start - b.start);
  const deduped: NLPEntity[] = [];
  for (const entity of entities) {
    const last = deduped[deduped.length - 1];
    if (last && entity.start < last.end) {
      if (entity.confidence > last.confidence) {
        deduped[deduped.length - 1] = entity;
      }
    } else {
      deduped.push(entity);
    }
  }

  return deduped;
}

// ============================================================
// SENTIMENT & EMOTION ANALYSIS
// ============================================================

const POSITIVE_WORDS = new Set([
  'thank', 'thanks', 'great', 'excellent', 'wonderful', 'amazing', 'perfect', 'love',
  'happy', 'pleased', 'satisfied', 'appreciate', 'good', 'nice', 'awesome', 'fantastic',
  '謝謝', '感謝', '很好', '太棒', '完美', '開心', '滿意', '喜歡', '讚', '優秀',
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'hate', 'angry', 'frustrated', 'annoyed',
  'disappointed', 'unhappy', 'dissatisfied', 'complaint', 'worst', 'poor', 'broken',
  '糟糕', '差勁', '生氣', '憤怒', '失望', '不滿', '投訴', '壞', '煩', '討厭',
]);

const FATIGUE_WORDS = new Set([
  'tired', 'exhausted', 'fatigue', 'sleepy', 'drained', 'worn out', 'long day',
  '累', '疲倦', '疲勞', '想睡', '好累', '精疲力盡', '辛苦',
]);

const URGENCY_WORDS = new Set([
  'urgent', 'emergency', 'asap', 'immediately', 'now', 'hurry', 'rush', 'critical',
  '緊急', '馬上', '立刻', '趕快', '急', '立即', '盡快',
]);

const DISCRETION_WORDS = new Set([
  'discreet', 'discreetly', 'quiet', 'quietly', 'private', 'privately', 'confidential',
  'low profile', 'subtle', 'without attention',
  '低調', '安靜', '私下', '保密', '不要聲張', '悄悄',
]);

export function analyzeSentiment(text: string): NLPSentiment {
  const normalized = text.toLowerCase();
  const words = normalized.split(/[\s,;.!?，；。！？]+/);

  let positiveCount = 0;
  let negativeCount = 0;
  let fatigueCount = 0;
  let urgencyCount = 0;
  let discretionCount = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positiveCount++;
    if (NEGATIVE_WORDS.has(word)) negativeCount++;
    if (FATIGUE_WORDS.has(word)) fatigueCount++;
    if (URGENCY_WORDS.has(word)) urgencyCount++;
    if (DISCRETION_WORDS.has(word)) discretionCount++;
  }

  // Also check multi-word patterns
  for (const phrase of FATIGUE_WORDS) {
    if (phrase.includes(' ') && normalized.includes(phrase)) fatigueCount++;
  }
  for (const phrase of DISCRETION_WORDS) {
    if (phrase.includes(' ') && normalized.includes(phrase)) discretionCount++;
  }

  const totalSentimentWords = positiveCount + negativeCount || 1;
  const score = (positiveCount - negativeCount) / totalSentimentWords;
  const magnitude = Math.min((positiveCount + negativeCount) / Math.max(words.length, 1), 1.0);

  // Determine primary emotion
  let emotion: EmotionType = 'neutral';
  let emotionConfidence = 0.5;

  const emotionScores: [EmotionType, number][] = [
    ['fatigue', fatigueCount * 0.4],
    ['urgency', urgencyCount * 0.45],
    ['discretion_needed', discretionCount * 0.4],
    ['frustration', negativeCount > 1 ? negativeCount * 0.3 : 0],
    ['satisfaction', positiveCount > 1 ? positiveCount * 0.3 : 0],
    ['anxiety', (urgencyCount + negativeCount) > 2 ? 0.5 : 0],
  ];

  emotionScores.sort((a, b) => b[1] - a[1]);
  if (emotionScores[0][1] > 0.2) {
    emotion = emotionScores[0][0];
    emotionConfidence = Math.min(emotionScores[0][1] + 0.3, 0.95);
  }

  return {
    score: Math.max(-1, Math.min(1, score)),
    magnitude,
    emotion,
    emotionConfidence,
  };
}

// ============================================================
// LANGUAGE DETECTION
// ============================================================

export function detectLanguage(text: string): 'en' | 'zh' | 'mixed' | 'unknown' {
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const totalLength = text.replace(/\s+/g, '').length || 1;
  const chineseRatio = chineseChars / totalLength;
  const englishRatio = (text.match(/[a-zA-Z]/g) || []).length / totalLength;

  if (chineseRatio > 0.3 && englishRatio > 0.2) return 'mixed';
  if (chineseRatio > 0.2) return 'zh';
  if (englishWords > 0) return 'en';
  return 'unknown';
}

// ============================================================
// PRIVACY ASSESSMENT & ROUTING
// ============================================================

const PII_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,       // Phone numbers
  /\b[A-Z]\d{9}\b/,                         // ID numbers
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/,            // Email
  /\b\d{3,5}\b.*\b(password|pin|code)\b/i,  // Passwords/PINs
  /身分證|護照|信用卡|密碼|銀行帳/,
];

const SECURITY_KEYWORDS = new Set([
  'security', 'suspicious', 'intruder', 'theft', 'stolen', 'break-in', 'alarm',
  'camera', 'surveillance', 'patrol', 'guard', 'cctv',
  '保全', '可疑', '闖入', '偷竊', '監控', '巡邏', '警報',
]);

const PRIVACY_SENSITIVE_INTENTS: Set<IntentCategory> = new Set([
  'security_concern', 'noise_complaint', 'privacy_request', 'social_mediation', 'emergency',
]);

export function assessPrivacy(text: string, intents: NLPIntent[], entities: NLPEntity[]): PrivacyAssessment {
  let score = 0;
  const reasons: string[] = [];

  // Check for PII
  const containsPII = PII_PATTERNS.some(p => p.test(text));
  if (containsPII) {
    score += 40;
    reasons.push('Contains personally identifiable information');
  }

  // Check for unit/apartment info
  const containsUnitInfo = entities.some(e => e.type === 'unit_number' || e.type === 'floor');
  if (containsUnitInfo) {
    score += 15;
    reasons.push('Contains residential unit information');
  }

  // Check for security-related content
  const normalizedLower = text.toLowerCase();
  let containsSecurityInfo = false;
  for (const kw of SECURITY_KEYWORDS) {
    if (normalizedLower.includes(kw.toLowerCase())) {
      containsSecurityInfo = true;
      break;
    }
  }
  if (containsSecurityInfo) {
    score += 25;
    reasons.push('Contains security-sensitive information');
  }

  // Check intent sensitivity
  const topIntent = intents[0];
  if (topIntent && PRIVACY_SENSITIVE_INTENTS.has(topIntent.category)) {
    score += 20;
    reasons.push(`Sensitive intent: ${topIntent.category}`);
  }

  // Check for person names
  if (entities.some(e => e.type === 'person')) {
    score += 10;
    reasons.push('Contains personal names');
  }

  // Determine privacy level
  let level: PrivacyLevel;
  if (score >= 70) level = 'restricted';
  else if (score >= 45) level = 'confidential';
  else if (score >= 20) level = 'internal';
  else level = 'public';

  // Determine processing tier
  let tier: ProcessingTier;
  if (level === 'restricted' || level === 'confidential') {
    tier = 'local';
  } else if (level === 'internal') {
    tier = 'hybrid'; // Local NLP + anonymized cloud for complex tasks
  } else {
    tier = 'cloud'; // Safe to process in cloud
  }

  if (reasons.length === 0) {
    reasons.push('No sensitive content detected');
  }

  return {
    level,
    score: Math.min(score, 100),
    tier,
    reasons,
    containsPII,
    containsUnitInfo,
    containsSecurityInfo,
  };
}

// ============================================================
// MAIN NLP PIPELINE
// ============================================================

export function processText(text: string, nodeId: string = 'local-0'): NLPResult {
  const startTime = Date.now();

  const language = detectLanguage(text);
  const intents = classifyIntent(text);
  const entities = extractEntities(text);
  const sentiment = analyzeSentiment(text);
  const privacy = assessPrivacy(text, intents, entities);

  return {
    input: text,
    language,
    intents,
    entities,
    sentiment,
    privacy,
    processingTimeMs: Date.now() - startTime,
    nodeId,
    modelVersions: [
      'intent-classifier-v2.1',
      'entity-extractor-v1.8',
      'sentiment-analyzer-v1.5',
      'privacy-scorer-v2.0',
      'lang-detect-v1.2',
    ],
  };
}
