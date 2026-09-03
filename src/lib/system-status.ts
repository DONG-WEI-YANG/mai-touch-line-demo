export type DiagnosticStatus = "healthy" | "degraded" | "unavailable" | "unconfigured";
export type StatusTone = "success" | "warning" | "error" | "muted";

export function getSystemStatusPresentation(
  status: string,
  language: "en" | "zh",
): { label: string; tone: StatusTone } {
  const labels: Record<DiagnosticStatus, Record<"en" | "zh", string>> = {
    healthy: { en: "Operational", zh: "運作正常" },
    degraded: { en: "Needs attention", zh: "需要注意" },
    unavailable: { en: "Unavailable", zh: "無法使用" },
    unconfigured: { en: "Not configured", zh: "尚未設定" },
  };
  const tones: Record<DiagnosticStatus, StatusTone> = {
    healthy: "success",
    degraded: "warning",
    unavailable: "error",
    unconfigured: "muted",
  };
  if (!(status in labels)) {
    return {
      label: language === "zh" ? "狀態未知" : "Unknown status",
      tone: "muted",
    };
  }
  const knownStatus = status as DiagnosticStatus;
  return { label: labels[knownStatus][language], tone: tones[knownStatus] };
}
