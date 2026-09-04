/**
 * 管理中心事件流 —— 展示模式右欄。
 *
 * 這是整套簡報最關鍵的說服畫面:客戶說完話,這裡當場跳出預約與工單。
 * 所以刻意做成「時間軸」而不是表格 —— 表格看起來像報表,時間軸看起來像
 * 正在發生的事。
 */
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

import type { ShowcaseEvent } from "../../server/services/showcaseTimeline";

import { SHOWCASE_COLORS as C, SHOWCASE_RADIUS as R, TONE_COLOR } from "./theme";

/** 只顯示時分 —— 展示是「當下」的事,日期沒有意義且佔位。 */
function clockLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const KIND_LABEL: Record<ShowcaseEvent["kind"], string> = {
  voice: "語音",
  booking: "預約",
  workOrder: "工單",
};

export function TimelineFeed({ events }: { events: ShowcaseEvent[] }) {
  if (events.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>等待客戶開口</Text>
        <Text style={styles.emptyBody}>
          客戶說出需求後,系統建立的每一筆預約、派出的每一張工單,都會即時出現在這裡。
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {events.map((event, index) => {
        const color = TONE_COLOR[event.tone];
        const isLast = index === events.length - 1;
        return (
          <View key={event.id} style={styles.row}>
            <View style={styles.gutter}>
              <View style={[styles.dot, { backgroundColor: color, borderColor: C.base }]} />
              {!isLast ? <View style={styles.rail} /> : null}
            </View>
            <View style={styles.body}>
              <View style={styles.metaRow}>
                <Text style={styles.clock}>{clockLabel(event.at)}</Text>
                <View style={[styles.kindChip, { borderColor: color }]}>
                  <Text style={[styles.kindText, { color }]}>{KIND_LABEL[event.kind]}</Text>
                </View>
              </View>
              <Text style={styles.title}>{event.title}</Text>
              {event.detail ? <Text style={styles.detail}>{event.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 4 },
  row: { flexDirection: "row", gap: 14 },
  gutter: { width: 14, alignItems: "center" },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, marginTop: 5 },
  rail: { flex: 1, width: 1.5, backgroundColor: C.line, marginTop: 3 },
  body: { flex: 1, paddingBottom: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  clock: { color: C.faint, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  kindChip: { borderWidth: 1, borderRadius: R.chip, paddingHorizontal: 7, paddingVertical: 1 },
  kindText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.5 },
  title: { color: C.paper, fontSize: 14.5, fontWeight: "700", lineHeight: 21 },
  detail: { color: C.muted, fontSize: 12.5, marginTop: 3, lineHeight: 19 },
  empty: { flex: 1, justifyContent: "center", paddingHorizontal: 8 },
  emptyTitle: { color: C.goldSoft, fontSize: 15, fontWeight: "700", marginBottom: 8 },
  emptyBody: { color: C.faint, fontSize: 12.5, lineHeight: 20 },
});
