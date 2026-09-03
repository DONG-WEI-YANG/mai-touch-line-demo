import type { OfflineQueueSnapshot } from "./offline";

export interface SyncStatusPresentation {
  visible: boolean;
  tone: "muted" | "warning" | "active" | "error";
  title: string;
  detail: string;
  canRetry: boolean;
}

export function getSyncStatusPresentation(
  snapshot: OfflineQueueSnapshot,
  language: "en" | "zh",
): SyncStatusPresentation {
  if (snapshot.failedCount > 0) {
    return language === "zh"
      ? {
          visible: true,
          tone: "error",
          title: `${snapshot.failedCount} 筆變更需要處理`,
          detail: "尚未獲得伺服器確認，可安全重試。",
          canRetry: true,
        }
      : {
          visible: true,
          tone: "error",
          title: `${snapshot.failedCount} ${snapshot.failedCount === 1 ? "change needs" : "changes need"} attention`,
          detail: "The server has not confirmed them. You can retry safely.",
          canRetry: true,
        };
  }
  if (snapshot.syncing) {
    return {
      visible: true,
      tone: "active",
      title: language === "zh" ? "正在同步" : "Syncing changes",
      detail: language === "zh" ? "正在等待伺服器逐筆確認。" : "Waiting for server confirmation, one change at a time.",
      canRetry: false,
    };
  }
  if (snapshot.pendingCount > 0) {
    return language === "zh"
      ? {
          visible: true,
          tone: "warning",
          title: `${snapshot.pendingCount} 筆變更等待送出`,
          detail: "這些變更尚未確認完成。",
          canRetry: false,
        }
      : {
          visible: true,
          tone: "warning",
          title: `${snapshot.pendingCount} ${snapshot.pendingCount === 1 ? "change" : "changes"} waiting`,
          detail: "They are not confirmed yet.",
          canRetry: false,
        };
  }
  if (!snapshot.online) {
    return {
      visible: true,
      tone: "warning",
      title: language === "zh" ? "目前離線" : "You're offline",
      detail: language === "zh" ? "新變更會保存在裝置上，恢復連線後再送出。" : "New changes stay on this device until connectivity returns.",
      canRetry: false,
    };
  }
  return { visible: false, tone: "muted", title: "", detail: "", canRetry: false };
}
