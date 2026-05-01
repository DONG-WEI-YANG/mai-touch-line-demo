/**
 * m'AI Touch — Voice Command Quick Router
 * 
 * Maps NLP intent classifications to app navigation routes,
 * enabling voice-driven zero-friction navigation.
 * When a user's voice command matches a specific intent,
 * the router suggests or auto-navigates to the relevant screen.
 * 
 * Created by Peter Yang
 */

import type { IntentCategory, NLPResult } from './engine';

export interface RouteAction {
  /** The Expo Router path to navigate to */
  route: string;
  /** Route parameters to pass */
  params?: Record<string, string>;
  /** Human-readable label for the action button */
  label: string;
  /** Chinese label */
  labelCN: string;
  /** Icon name (SF Symbol) */
  icon: string;
  /** Whether to auto-navigate (true) or show suggestion card (false) */
  autoNavigate: boolean;
  /** Confidence threshold required for auto-navigation */
  confidenceThreshold: number;
}

export interface RoutingSuggestion {
  /** Primary suggested action */
  primary: RouteAction;
  /** Alternative actions */
  alternatives: RouteAction[];
  /** Whether the suggestion was triggered */
  triggered: boolean;
  /** The intent that triggered this suggestion */
  intent: IntentCategory;
  /** Confidence of the triggering intent */
  confidence: number;
}

// ============================================================
// INTENT → ROUTE MAPPING
// ============================================================

const INTENT_ROUTE_MAP: Record<IntentCategory, RouteAction[]> = {
  amenity_booking: [
    {
      route: '/amenities',
      label: 'Browse Amenities',
      labelCN: '瀏覽設施',
      icon: 'calendar.badge.plus',
      autoNavigate: false,
      confidenceThreshold: 0.75,
    },
    {
      route: '/amenities/my-bookings',
      label: 'My Bookings',
      labelCN: '我的預約',
      icon: 'list.bullet.rectangle',
      autoNavigate: false,
      confidenceThreshold: 0.85,
    },
  ],
  maintenance_request: [
    {
      route: '/(tabs)/activity',
      label: 'View Work Orders',
      labelCN: '查看工單',
      icon: 'wrench.and.screwdriver',
      autoNavigate: false,
      confidenceThreshold: 0.80,
    },
  ],
  concierge_service: [
    {
      route: '/(tabs)/services',
      label: 'Concierge Services',
      labelCN: '管家服務',
      icon: 'bell.badge',
      autoNavigate: false,
      confidenceThreshold: 0.75,
    },
  ],
  security_concern: [
    {
      route: '/(tabs)/activity',
      label: 'Security Status',
      labelCN: '安全狀態',
      icon: 'shield.checkered',
      autoNavigate: false,
      confidenceThreshold: 0.85,
    },
  ],
  noise_complaint: [
    {
      route: '/(tabs)/activity',
      label: 'Track Complaint',
      labelCN: '追蹤投訴',
      icon: 'exclamationmark.bubble',
      autoNavigate: false,
      confidenceThreshold: 0.80,
    },
  ],
  guest_management: [
    {
      route: '/(tabs)/services',
      label: 'Guest Services',
      labelCN: '訪客服務',
      icon: 'person.badge.plus',
      autoNavigate: false,
      confidenceThreshold: 0.80,
    },
  ],
  space_control: [
    {
      route: '/(tabs)/services',
      label: 'Space Control',
      labelCN: '空間控制',
      icon: 'slider.horizontal.3',
      autoNavigate: false,
      confidenceThreshold: 0.80,
    },
  ],
  privacy_request: [
    {
      route: '/(tabs)/settings',
      label: 'Privacy Settings',
      labelCN: '隱私設定',
      icon: 'lock.shield',
      autoNavigate: false,
      confidenceThreshold: 0.85,
    },
  ],
  lifestyle_service: [
    {
      route: '/(tabs)/services',
      label: 'Lifestyle Services',
      labelCN: '生活服務',
      icon: 'sparkles',
      autoNavigate: false,
      confidenceThreshold: 0.75,
    },
  ],
  social_mediation: [
    {
      route: '/(tabs)/activity',
      label: 'Mediation Status',
      labelCN: '調解狀態',
      icon: 'person.2',
      autoNavigate: false,
      confidenceThreshold: 0.80,
    },
  ],
  emergency: [
    {
      route: '/(tabs)/activity',
      label: 'Emergency Status',
      labelCN: '緊急狀態',
      icon: 'exclamationmark.triangle',
      autoNavigate: true,  // Auto-navigate for emergencies
      confidenceThreshold: 0.90,
    },
  ],
  general_inquiry: [],
  greeting: [],
  feedback: [],
};

// ============================================================
// SUB-INTENT → SPECIFIC ROUTE MAPPING
// ============================================================

const SUB_INTENT_ROUTE_MAP: Record<string, RouteAction> = {
  pool: {
    route: '/amenities',
    params: { highlight: 'pool' },
    label: 'Book Pool',
    labelCN: '預約泳池',
    icon: 'figure.pool.swim',
    autoNavigate: false,
    confidenceThreshold: 0.80,
  },
  spa: {
    route: '/amenities',
    params: { highlight: 'spa' },
    label: 'Book Spa',
    labelCN: '預約水療',
    icon: 'leaf',
    autoNavigate: false,
    confidenceThreshold: 0.80,
  },
  gym: {
    route: '/amenities',
    params: { highlight: 'gym' },
    label: 'Book Gym',
    labelCN: '預約健身房',
    icon: 'figure.strengthtraining.traditional',
    autoNavigate: false,
    confidenceThreshold: 0.80,
  },
  cinema: {
    route: '/amenities',
    params: { highlight: 'cinema' },
    label: 'Book Cinema',
    labelCN: '預約電影院',
    icon: 'film',
    autoNavigate: false,
    confidenceThreshold: 0.80,
  },
  dining: {
    route: '/amenities',
    params: { highlight: 'dining' },
    label: 'Book Dining',
    labelCN: '預約餐廳',
    icon: 'fork.knife',
    autoNavigate: false,
    confidenceThreshold: 0.80,
  },
  garden: {
    route: '/amenities',
    params: { highlight: 'garden' },
    label: 'Book Garden',
    labelCN: '預約花園',
    icon: 'leaf',
    autoNavigate: false,
    confidenceThreshold: 0.80,
  },
  boardroom: {
    route: '/amenities',
    params: { highlight: 'boardroom' },
    label: 'Book Boardroom',
    labelCN: '預約會議室',
    icon: 'person.3',
    autoNavigate: false,
    confidenceThreshold: 0.80,
  },
};

// ============================================================
// VOICE ROUTER
// ============================================================

/**
 * Analyze NLP result and generate routing suggestions
 */
export function getRoutingSuggestion(nlpResult: NLPResult): RoutingSuggestion | null {
  const topIntent = nlpResult.intents[0];
  if (!topIntent) return null;

  const routes = INTENT_ROUTE_MAP[topIntent.category];
  if (!routes || routes.length === 0) return null;

  // Check if confidence meets threshold
  const primaryRoute = routes[0];
  if (topIntent.confidence < primaryRoute.confidenceThreshold) return null;

  // Check for sub-intent specific route
  let primary = primaryRoute;
  if (topIntent.subIntent && SUB_INTENT_ROUTE_MAP[topIntent.subIntent]) {
    const subRoute = SUB_INTENT_ROUTE_MAP[topIntent.subIntent];
    if (topIntent.confidence >= subRoute.confidenceThreshold) {
      primary = subRoute;
    }
  }

  // Check for entity-based route enhancement
  const amenityEntity = nlpResult.entities.find(e => e.type === 'amenity');
  if (amenityEntity && SUB_INTENT_ROUTE_MAP[amenityEntity.value.toLowerCase()]) {
    const entityRoute = SUB_INTENT_ROUTE_MAP[amenityEntity.value.toLowerCase()];
    if (topIntent.confidence >= entityRoute.confidenceThreshold) {
      primary = entityRoute;
    }
  }

  return {
    primary,
    alternatives: routes.slice(1),
    triggered: topIntent.confidence >= primary.confidenceThreshold,
    intent: topIntent.category,
    confidence: topIntent.confidence,
  };
}

/**
 * Check if a routing suggestion should auto-navigate
 */
export function shouldAutoNavigate(suggestion: RoutingSuggestion): boolean {
  return suggestion.triggered && suggestion.primary.autoNavigate && suggestion.confidence >= 0.90;
}

/**
 * Get the display label based on language
 */
export function getRouteLabel(action: RouteAction, language: string): string {
  return language === 'zh' ? action.labelCN : action.label;
}
