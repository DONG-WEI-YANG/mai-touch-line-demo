import type { ChatDeliveryState, ChatMessage } from "./types";

export interface ChatDeliveryUpdate {
  delivery: ChatDeliveryState;
  operationId?: string;
  deliveryError?: string;
}

export function updateMessageDelivery(
  messages: ChatMessage[],
  messageId: string,
  update: ChatDeliveryUpdate,
): ChatMessage[] {
  const index = messages.findIndex((message) => message.id === messageId);
  if (index < 0) return messages;
  const current = messages[index];
  if (current.delivery === "confirmed" && update.delivery !== "confirmed") return messages;

  const next = messages.slice();
  next[index] = {
    ...current,
    delivery: update.delivery,
    operationId: update.delivery === "queued" ? update.operationId : undefined,
    deliveryError: update.delivery === "failed" ? update.deliveryError : undefined,
  };
  return next;
}

export function updateQueuedOperationDelivery(
  messages: ChatMessage[],
  operationId: string,
  update: ChatDeliveryUpdate,
): ChatMessage[] {
  const target = messages.find((message) => message.operationId === operationId);
  return target ? updateMessageDelivery(messages, target.id, update) : messages;
}

export interface DeliveryPresentation {
  label: string;
  canRetry: boolean;
}

export function getDeliveryPresentation(
  state: ChatDeliveryState,
  language: "en" | "zh",
): DeliveryPresentation {
  const labels: Record<"en" | "zh", Record<ChatDeliveryState, string>> = {
    en: {
      sending: "Sending…",
      queued: "Waiting for connectivity",
      confirmed: "Delivered",
      failed: "Not delivered",
    },
    zh: {
      sending: "傳送中…",
      queued: "等待連線後送出",
      confirmed: "已送達",
      failed: "未送達",
    },
  };
  return {
    label: labels[language][state],
    canRetry: state === "failed",
  };
}
