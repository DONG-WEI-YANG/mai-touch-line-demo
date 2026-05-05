import React, { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";
import type { ChatMessage, WorkOrder, Booking } from "./types";
import { SAMPLE_WORK_ORDERS, DEFAULT_PROFILE, getAIResponse, generateId } from "./store";
import { SAMPLE_BOOKINGS } from "./amenities";
import type { ResidentProfile } from "./types";
import { analyzeMessage, type NLPResult, type RoutingSuggestion } from "./nlp";
import { toClientBookings, toClientWorkOrders } from "./api-types";

import { translations, type Language, type TranslationKey } from "./i18n";

interface NLPMetadata {
  intent: string;
  confidence: number;
  emotion?: string;
  sentimentScore?: number;
}

interface AppState {
  messages: ChatMessage[];
  workOrders: WorkOrder[];
  bookings: Booking[];
  profile: ResidentProfile;
  privacyMode: boolean;
  isTyping: boolean;
  lastNLPResult: NLPMetadata | null;
  routingSuggestion: RoutingSuggestion | null;
  language: Language;
}

type AppAction =
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "SET_TYPING"; payload: boolean }
  | { type: "ADD_WORK_ORDER"; payload: WorkOrder }
  | { type: "UPDATE_WORK_ORDER"; payload: { id: string; status: WorkOrder["status"] } }
  | { type: "ADD_BOOKING"; payload: Booking }
  | { type: "CANCEL_BOOKING"; payload: string }
  | { type: "TOGGLE_PRIVACY" }
  | { type: "SET_PROFILE"; payload: Partial<ResidentProfile> }
  | { type: "SET_NLP_RESULT"; payload: NLPMetadata }
  | { type: "SET_ROUTING_SUGGESTION"; payload: RoutingSuggestion | null }
  | { type: "SET_LANGUAGE"; payload: Language }
  | { type: "LOAD_STATE"; payload: Partial<AppState> };

const initialState: AppState = {
  messages: [], // Initialized in Provider based on lang
  workOrders: SAMPLE_WORK_ORDERS,
  bookings: SAMPLE_BOOKINGS,
  profile: DEFAULT_PROFILE,
  privacyMode: false,
  isTyping: false,
  lastNLPResult: null,
  routingSuggestion: null,
  language: "en",
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_LANGUAGE":
      return { ...state, language: action.payload };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "SET_TYPING":
      return { ...state, isTyping: action.payload };
    case "ADD_WORK_ORDER":
      return { ...state, workOrders: [action.payload, ...state.workOrders] };
    case "UPDATE_WORK_ORDER":
      return {
        ...state,
        workOrders: state.workOrders.map((wo) =>
          wo.id === action.payload.id
            ? { ...wo, status: action.payload.status, updatedAt: Date.now() }
            : wo
        ),
      };
    case "ADD_BOOKING":
      return { ...state, bookings: [action.payload, ...state.bookings] };
    case "CANCEL_BOOKING":
      return {
        ...state,
        bookings: state.bookings.map((b) =>
          b.id === action.payload ? { ...b, status: "cancelled" as const } : b
        ),
      };
    case "TOGGLE_PRIVACY":
      return { ...state, privacyMode: !state.privacyMode };
    case "SET_PROFILE":
      return { ...state, profile: { ...state.profile, ...action.payload } };
    case "SET_NLP_RESULT":
      return { ...state, lastNLPResult: action.payload };
    case "SET_ROUTING_SUGGESTION":
      return { ...state, routingSuggestion: action.payload };
    case "LOAD_STATE":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  sendMessage: (content: string) => void;
  togglePrivacy: () => void;
  updateProfile: (profile: Partial<ResidentProfile>) => void;
  updateWorkOrder: (id: string, status: WorkOrder["status"]) => void;
  addBooking: (booking: Booking) => void;
  cancelBooking: (id: string) => void;
  dismissRoutingSuggestion: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * Generate an NLP-enhanced AI response based on analysis results
 */
function generateNLPResponse(content: string, nlpResult: NLPResult): string {
  const topIntent = nlpResult.intents[0];
  const intent = topIntent?.category || "unknown";
  const emotion = nlpResult.sentiment.emotion;
  const isZh = nlpResult.language === "zh";

  // 1. Emotion-aware Prefix
  let prefix = "";
  if (emotion === "frustration" || emotion === "urgency") {
    prefix = isZh 
      ? "很抱歉讓您感到困擾，我會立即優先處理此事。\n\n"
      : "I sincerely apologize for the inconvenience. I am prioritizing this immediately.\n\n";
  } else if (emotion === "fatigue") {
    prefix = isZh
      ? "辛苦了，歡迎回家。這件事交給我來處理就好。\n\n"
      : "You've had a long day. Welcome home. Let me take care of this for you.\n\n";
  }

  // 2. Intent-specific Responses (Aligned with NLP Service)
  let response = "";
  switch (intent) {
    case "amenity_booking":
      response = isZh
        ? "沒問題，我來為您安排預約。請問您偏好的時段？您也可以點擊下方卡片直接查看可用空位。"
        : "Certainly. I'll arrange that booking for you. Which time slot do you prefer? You can also tap the card below to see available slots.";
      break;
    case "maintenance_request":
      response = isZh
        ? "已收到您的報修請求。我已經為您建立了工單並通知維修團隊，預計在 15 分鐘內與您聯繫。"
        : "I've logged your maintenance request. A work order has been created and our team will be notified. Expect a follow-up within 15 minutes.";
      break;
    case "space_control":
      response = isZh
        ? "正在為您調整空間設定。溫度與燈光將在幾分鐘內達到您的理想狀態。"
        : "Adjusting your space settings now. The climate and lighting will reach your preferred levels shortly.";
      break;
    case "guest_management":
      response = isZh
        ? "好的，我會為您的訪客準備無接觸通行證。請提供訪客姓名，我會將 QR Code 發送給您。"
        : "Understood. I'll prepare a touchless entry pass for your guest. Please provide their name and I'll send you the QR code.";
      break;
    case "privacy_request":
      response = isZh
        ? "隱私模式已啟動。電梯已鎖定，且大廳工作人員已收到「請勿打擾」指令。"
        : "Privacy mode activated. Elevators are secured and staff have been instructed not to disturb.";
      break;
    case "emergency":
      response = isZh
        ? "⚠️ 緊急情況已通報！保全與緊急服務團隊正在前往您的位置。請保持冷靜，我會持續為您追蹤。"
        : "⚠️ Emergency alert triggered! Security and emergency services are on their way. Please remain calm, I am tracking the response.";
      break;
    case "greeting":
      response = isZh
        ? "您好，Alex。今天有什麼我能為您效勞的嗎？"
        : `Hello, ${DEFAULT_PROFILE.name}. How may I assist you today?`;
      break;
    default:
      response = getAIResponse(content);
  }

  return prefix + response;
}

import { trpc } from "./trpc";

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Real API hooks
  const { data: userProfile } = trpc.auth.me.useQuery(undefined, {
    enabled: true,
    refetchOnWindowFocus: false,
  });

  // myOrders and myBookings are residentProcedure-gated. AppProvider wraps
  // every route (admin/logistics/resident), so without a role gate these
  // queries fire 403 for non-resident tokens and spam the console. The
  // resident dashboard is the only consumer of remoteWorkOrders/remoteBookings,
  // so admins/logistics don't need them at all.
  const isResident = (userProfile as { role?: string } | undefined)?.role === 'resident';

  const { data: remoteWorkOrders } = trpc.workOrders.myOrders.useQuery(undefined, {
    enabled: !!userProfile && isResident,
    refetchOnWindowFocus: false,
  });

  const { data: remoteBookings } = trpc.bookings.myBookings.useQuery(undefined, {
    enabled: !!userProfile && isResident,
    refetchOnWindowFocus: false,
  });

  // Load user profile
  React.useEffect(() => {
    if (userProfile) {
      const profile = userProfile as Record<string, unknown>;
      dispatch({ 
        type: "SET_PROFILE", 
        payload: {
          name: (profile.name as string) || "Valued Resident",
          unit: profile.unitNumber ? `Unit ${profile.unitNumber}` : "Unassigned",
          tier: (profile.tier as "Platinum" | "Diamond" | "Black") || "Platinum",
          avatarUrl: profile.picture as string | undefined,
        } 
      });
    }
  }, [userProfile]);

  // Load remote data into state when available — use adapter to convert DB shapes
  React.useEffect(() => {
    if (remoteWorkOrders) {
      const clientWorkOrders = toClientWorkOrders(remoteWorkOrders);
      dispatch({ type: "LOAD_STATE", payload: { workOrders: clientWorkOrders } });
    }
  }, [remoteWorkOrders]);

  React.useEffect(() => {
    if (remoteBookings) {
      const clientBookings = toClientBookings(remoteBookings);
      dispatch({ type: "LOAD_STATE", payload: { bookings: clientBookings } });
    }
  }, [remoteBookings]);

  // Translation helper
  const t = useCallback((key: TranslationKey) => {
    return translations[state.language][key] || key;
  }, [state.language]);

  // Set language and update welcome message
  const setLanguage = useCallback((lang: Language) => {
    dispatch({ type: "SET_LANGUAGE", payload: lang });
    
    // Add a localized system message to indicate language change
    const welcomeMsg = lang === "zh" 
      ? `您好，${DEFAULT_PROFILE.name}。我是您的數位大腦，現在以中文模式為您服務。`
      : `Hello, ${DEFAULT_PROFILE.name}. I am your Digital Brain, now serving you in English mode.`;
      
    dispatch({
      type: "ADD_MESSAGE",
      payload: {
        id: generateId(),
        role: "assistant",
        content: welcomeMsg,
        timestamp: Date.now(),
      }
    });
  }, []);

  // Initialize welcome message if empty
  React.useEffect(() => {
    if (state.messages.length === 0) {
      const initialWelcome = state.language === "zh"
        ? `晚安，${DEFAULT_PROFILE.name}。歡迎回家。\n\n我是您的數位大腦 — 已準備好管理您的空間、協調各項服務並確保您的舒適。今晚有什麼我可以幫您的？`
        : `Good evening, ${DEFAULT_PROFILE.name}. Welcome home.\n\nI'm your Digital Brain — ready to manage your space, coordinate services, and ensure your comfort. How may I assist you tonight?`;
      
      dispatch({
        type: "ADD_MESSAGE",
        payload: {
          id: "welcome",
          role: "assistant",
          content: initialWelcome,
          timestamp: Date.now(),
        }
      });
    }
  }, [state.language]);

  const createWorkOrderMutation = trpc.workOrders.create.useMutation();

  const sendMessage = useCallback((content: string) => {
    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: userMsg });
    dispatch({ type: "SET_TYPING", payload: true });

    // Run NLP analysis asynchronously
    (async () => {
      try {
        const { nlpResult } = await analyzeMessage(content);
        const topIntent = nlpResult.intents[0];

        // Generate NLP-enhanced response
        let aiContent = generateNLPResponse(content, nlpResult);
        const isZh = state.language === "zh";

        // PERSISTENCE & TASK LOGIC: Use TinyNLP results to drive behavior
        if (topIntent && topIntent.confidence > 0.5) {
          const entities = nlpResult.entities;
          
          // 1. Dynamic Work Order Creation — use `category` to match router schema
          if (topIntent.category === "maintenance_request") {
            const problemType = entities.find(e => e.type === "service")?.value || topIntent.subIntent || "General";
            try {
              await createWorkOrderMutation.mutateAsync({
                title: `${isZh ? "維修" : "Fix"}: ${problemType}`,
                description: content,
                category: "maintenance",   // router field is `category`, not `type`
                priority: nlpResult.sentiment.emotion === "urgency" ? "urgent" : "medium",
              });
            } catch (e) { console.error(e); }
          }

          // 2. Intelligent follow-up for missing information (The non-canned logic)
          if (topIntent.category === "amenity_booking") {
            const amenityEntity = entities.find(e => e.type === "amenity")?.value;
            const timeEntity = entities.find(e => e.type === "time" || e.type === "date")?.value;
            
            if (!amenityEntity) {
              aiContent = isZh 
                ? "好的，我來為您安排設施預約。請問您具體想要預約哪項設施？（例如：游泳池、健身房或私廚）" 
                : "Certainly. I'll help you with that booking. Which facility would you like to reserve? (e.g., Pool, Gym, or Dining Room)";
            } else if (!timeEntity) {
              aiContent = isZh
                ? `沒問題，我來為您準備${amenityEntity}的預約。請問您預計在哪個日期或時段使用？`
                : `Understood. I'll arrange the ${amenityEntity} for you. At what date and time would you like to visit?`;
            }
          }
        }

        // Add Processing Metadata to Message
        // Simulate slight delay for natural feel
        setTimeout(() => {
          const aiMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: aiContent,
            timestamp: Date.now(),
          };
          dispatch({ type: "ADD_MESSAGE", payload: aiMsg });
          dispatch({ type: "SET_TYPING", payload: false });
        }, 800);
      } catch {
        // Fallback to basic response if NLP fails
        setTimeout(() => {
          const aiContent = getAIResponse(content);
          const aiMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: aiContent,
            timestamp: Date.now(),
          };
          dispatch({ type: "ADD_MESSAGE", payload: aiMsg });
          dispatch({ type: "SET_TYPING", payload: false });
        }, 1500);
      }
    })();
  }, [createWorkOrderMutation]);

  const togglePrivacy = useCallback(() => {
    dispatch({ type: "TOGGLE_PRIVACY" });
  }, []);

  const updateProfile = useCallback((profile: Partial<ResidentProfile>) => {
    dispatch({ type: "SET_PROFILE", payload: profile });
  }, []);

  const updateWorkOrder = useCallback((id: string, status: WorkOrder["status"]) => {
    dispatch({ type: "UPDATE_WORK_ORDER", payload: { id, status } });
  }, []);

  const addBooking = useCallback((booking: Booking) => {
    dispatch({ type: "ADD_BOOKING", payload: booking });
  }, []);

  const cancelBooking = useCallback((id: string) => {
    dispatch({ type: "CANCEL_BOOKING", payload: id });
  }, []);

  const dismissRoutingSuggestion = useCallback(() => {
    dispatch({ type: "SET_ROUTING_SUGGESTION", payload: null });
  }, []);

  return (
    <AppContext.Provider
      value={{ state, sendMessage, togglePrivacy, updateProfile, updateWorkOrder, addBooking, cancelBooking, dismissRoutingSuggestion, setLanguage, t }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
