import React, { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";
import type { ChatMessage, WorkOrder, Booking } from "./types";
import { DEFAULT_PROFILE, generateId } from "./store";
import type { ResidentProfile } from "./types";
import type { RoutingSuggestion } from "./voice-router";
import { toClientBookings, toClientWorkOrders } from "./api-types";
import { translations, type Language, type TranslationKey } from "./i18n";
import { deliverChatMessage } from "./chat-client";
import { normalizeChatHistory } from "./chat-history";
import { updateMessageDelivery, updateQueuedOperationDelivery, type ChatDeliveryUpdate } from "./chat-messages";
import { offlineService, type OfflineOperation } from "./offline";
import { trpc, trpcProxy } from "./trpc";

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
  | { type: "UPDATE_MESSAGE_DELIVERY"; payload: { id: string; update: ChatDeliveryUpdate } }
  | { type: "UPDATE_QUEUED_DELIVERY"; payload: { operationId: string; update: ChatDeliveryUpdate } }
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
  workOrders: [],
  bookings: [],
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
    case "UPDATE_MESSAGE_DELIVERY":
      return {
        ...state,
        messages: updateMessageDelivery(state.messages, action.payload.id, action.payload.update),
      };
    case "UPDATE_QUEUED_DELIVERY":
      return {
        ...state,
        messages: updateQueuedOperationDelivery(
          state.messages,
          action.payload.operationId,
          action.payload.update,
        ),
      };
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
  retryMessage: (id: string) => void;
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
  const authenticatedUserId = (userProfile as { id?: number } | undefined)?.id;

  const { data: remoteWorkOrders } = trpc.workOrders.myOrders.useQuery(undefined, {
    enabled: !!userProfile && isResident,
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });

  const { data: remoteBookings } = trpc.bookings.myBookings.useQuery(undefined, {
    enabled: !!userProfile && isResident,
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });

  // Include the authenticated user id in the input solely as a cache key. The
  // server still derives authorization from the session and ignores viewerKey.
  const { data: remoteChatHistory, refetch: refetchChatHistory } = trpc.chat.history.useQuery(
    { limit: 50, viewerKey: String(authenticatedUserId ?? "anonymous") },
    {
      enabled: !!authenticatedUserId && isResident,
      refetchOnWindowFocus: false,
    },
  );

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

  // Prevent a cached conversation from the previous token being visible while
  // the next resident-specific query loads.
  React.useEffect(() => {
    dispatch({ type: "LOAD_STATE", payload: { messages: [] } });
  }, [authenticatedUserId]);

  React.useEffect(() => {
    if (remoteChatHistory === undefined) return;
    dispatch({
      type: "LOAD_STATE",
      payload: { messages: normalizeChatHistory(remoteChatHistory) },
    });
  }, [remoteChatHistory]);

  React.useEffect(() => {
    const onCompleted = (operation: OfflineOperation) => {
      if (operation.type !== "send_message") return;
      dispatch({
        type: "UPDATE_QUEUED_DELIVERY",
        payload: { operationId: operation.id, update: { delivery: "confirmed" } },
      });
      void refetchChatHistory();
    };
    const onFailed = (operation: OfflineOperation) => {
      if (operation.type !== "send_message") return;
      dispatch({
        type: "UPDATE_QUEUED_DELIVERY",
        payload: {
          operationId: operation.id,
          update: {
            delivery: "failed",
            deliveryError: state.language === "zh" ? "同步重試已用盡" : "Sync retries exhausted",
          },
        },
      });
    };
    offlineService.on("operation:completed", onCompleted);
    offlineService.on("operation:failed", onFailed);
    return () => {
      offlineService.off("operation:completed", onCompleted);
      offlineService.off("operation:failed", onFailed);
    };
  }, [refetchChatHistory, state.language]);

  // Translation helper
  const t = useCallback((key: TranslationKey) => {
    return translations[state.language][key] || key;
  }, [state.language, state.messages.length]);

  // Set language and update welcome message
  const setLanguage = useCallback((lang: Language) => {
    dispatch({ type: "SET_LANGUAGE", payload: lang });
    
    // Add a localized system message to indicate language change
    const welcomeMsg = lang === "zh" 
      ? `您好，${state.profile.name}。我是您的數位大腦，現在以中文模式為您服務。`
      : `Hello, ${state.profile.name}. I am your Digital Brain, now serving you in English mode.`;
      
    dispatch({
      type: "ADD_MESSAGE",
      payload: {
        id: generateId(),
        role: "assistant",
        content: welcomeMsg,
        timestamp: Date.now(),
      }
    });
  }, [state.profile.name]);

  // Initialize welcome message if empty
  React.useEffect(() => {
    if (userProfile && state.messages.length === 0) {
      const initialWelcome = state.language === "zh"
        ? `晚安，${state.profile.name}。歡迎回家。\n\n我是您的數位大腦。今晚有什麼我可以幫您的？`
        : `Good evening, ${state.profile.name}. Welcome home.\n\nI'm your Digital Brain. How may I assist you tonight?`;
      
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
  }, [state.language, state.messages.length, state.profile.name, userProfile]);

  const deliverMessage = useCallback((id: string, message: string) => {
    void (async () => {
      dispatch({
        type: "UPDATE_MESSAGE_DELIVERY",
        payload: { id, update: { delivery: "sending" } },
      });
      dispatch({ type: "SET_TYPING", payload: true });
      try {
        const result = await deliverChatMessage(
          { message, language: state.language },
          {
            isOnline: () => offlineService.isDeviceOnline(),
            send: (input) => trpcProxy.chat.send.mutate(input),
            enqueue: (input) => offlineService.queueOperation({
              type: "send_message",
              data: input,
            }),
          },
        );

        if (result.status === "confirmed") {
          dispatch({
            type: "UPDATE_MESSAGE_DELIVERY",
            payload: { id, update: { delivery: "confirmed" } },
          });
          const assistantMessage: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: result.text,
            timestamp: Date.now(),
          };
          dispatch({ type: "ADD_MESSAGE", payload: assistantMessage });
          void refetchChatHistory();
        } else {
          dispatch({
            type: "UPDATE_MESSAGE_DELIVERY",
            payload: {
              id,
              update: { delivery: "queued", operationId: result.operationId },
            },
          });
        }
      } catch {
        dispatch({
          type: "UPDATE_MESSAGE_DELIVERY",
          payload: {
            id,
            update: {
              delivery: "failed",
              deliveryError: state.language === "zh"
                ? "Digital Brain 未確認處理"
                : "Digital Brain did not confirm processing",
            },
          },
        });
      } finally {
        dispatch({ type: "SET_TYPING", payload: false });
      }
    })();
  }, [refetchChatHistory, state.language]);

  const sendMessage = useCallback((content: string) => {
    const message = content.trim();
    if (!message) return;
    const id = generateId();
    dispatch({
      type: "ADD_MESSAGE",
      payload: {
        id,
        role: "user",
        content: message,
        timestamp: Date.now(),
        delivery: "sending",
      },
    });
    deliverMessage(id, message);
  }, [deliverMessage]);

  const retryMessage = useCallback((id: string) => {
    const message = state.messages.find((item) => item.id === id);
    if (!message || message.role !== "user" || message.delivery !== "failed") return;
    deliverMessage(message.id, message.content);
  }, [deliverMessage, state.messages]);

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
      value={{ state, sendMessage, retryMessage, togglePrivacy, updateProfile, updateWorkOrder, addBooking, cancelBooking, dismissRoutingSuggestion, setLanguage, t }}
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
