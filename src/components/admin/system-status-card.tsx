import { StyleSheet, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getSystemStatusPresentation } from "@/lib/system-status";

export function SystemStatusCard({
  title,
  status,
  summary,
  details,
  icon,
  isLast = false,
}: {
  title: string;
  status: string;
  summary: string;
  details: string[];
  icon: string;
  isLast?: boolean;
}) {
  const colors = useColors();
  const presentation = getSystemStatusPresentation(status, "zh");
  const toneColor = presentation.tone === "success"
    ? colors.success
    : presentation.tone === "warning"
      ? colors.warning
      : presentation.tone === "error"
        ? colors.error
        : colors.muted;

  return (
    <View style={styles.station}>
      <View style={styles.rail}>
        <View style={[styles.node, { backgroundColor: toneColor, borderColor: colors.background }]} />
        {!isLast && <View style={[styles.line, { backgroundColor: colors.border }]} />}
      </View>
      <View style={[styles.content, { borderBottomColor: colors.border }]}>
        <View style={styles.headingRow}>
          <View style={[styles.iconBox, { backgroundColor: `${toneColor}18` }]}>
            <IconSymbol name={icon} size={20} color={toneColor} strokeWidth={1.8} />
          </View>
          <View style={styles.headingCopy}>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            <Text style={[styles.summary, { color: colors.muted }]}>{summary}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: `${toneColor}18`, borderColor: `${toneColor}55` }]}>
            <Text style={[styles.badgeText, { color: toneColor }]}>{presentation.label}</Text>
          </View>
        </View>
        {details.length > 0 && (
          <View style={styles.detailList}>
            {details.map((detail) => (
              <View key={detail} style={styles.detailRow}>
                <View style={[styles.detailMark, { backgroundColor: toneColor }]} />
                <Text style={[styles.detailText, { color: colors.foreground }]}>{detail}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  station: { flexDirection: "row", minHeight: 126 },
  rail: { width: 28, alignItems: "center" },
  node: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, zIndex: 1, marginTop: 24 },
  line: { position: "absolute", top: 36, bottom: 0, width: 1 },
  content: { flex: 1, paddingTop: 16, paddingBottom: 22, borderBottomWidth: StyleSheet.hairlineWidth },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "800" },
  summary: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  detailList: { marginTop: 13, marginLeft: 54, gap: 7 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  detailMark: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  detailText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
