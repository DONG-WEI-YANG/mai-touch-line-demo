/**
 * 樣品屋展示模式 —— 接待中心平板的單頁展示台。
 *
 * 對應《智慧宅分階段導入規劃》階段 1「樣品屋開賣」的四張卡。業務用一個管理端
 * 身分登入,代示範住戶動作;左欄是客戶操作的畫面,右欄是管理中心的即時反應。
 * 那個「說完話,管理室當場跳出工單」的瞬間就是整份簡報的說服核心。
 *
 * 這一頁不含任何領域邏輯:語音走 voice.staffCommand / staffCommit,設備走
 * iot.updateDevice,LINE 走 lineAdmin.scriptRun —— 全是正式流程,所以客戶問
 * 「這是真的嗎」時答得出來。
 *
 * See docs/superpowers/specs/2026-09-05-showcase-mode-design.md
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from "react-native";

import {
  ShowcaseCard,
  ShowcaseHeading,
  StatusPill,
  ShowcaseButton,
} from "@/components/showcase/primitives";
import { ShowcaseQrCode } from "@/components/showcase/qr-code";
import { SHOWCASE_COLORS as C, SHOWCASE_COLOR_SCHEME, SHOWCASE_RADIUS as R } from "@/components/showcase/theme";
import { TimelineFeed } from "@/components/showcase/timeline-feed";
import { VoiceBookingPanel, type VoiceSlots } from "@/components/voice-booking-panel";
import {
  SHOWCASE_SCENARIOS,
  scenarioAvailability,
  showcaseBlockReason,
  type ShowcaseScenario,
  type ShowcaseScenarioId,
} from "@/lib/showcase-scenarios";
import { recoveryRefetchInterval } from "@/lib/recovery-interval";
import { trpc, type RouterOutputs } from "@/lib/trpc";

/** 分割版面的門檻 —— 接待中心平板橫放約 1024pt,窄於此就改上下堆疊。 */
const SPLIT_WIDTH = 900;
/**
 * 右欄輪詢間隔。
 *
 * 刻意不是 2 秒:伺服器對 /api/* 有 IP 級請求上限,2 秒輪詢在真實展示中約
 * 三分多鐘就會撞牆並回 429 —— 在客戶面前掛掉。真正讓畫面「即時」的不是輪詢
 * 頻率,而是每個動作完成後立刻 invalidate;輪詢只是接住「別處發生的變化」
 * (例如客戶用自己手機下訂)的安全網,4 秒綽綽有餘。
 */
const TIMELINE_POLL_MS = 4000;

export default function ShowcaseScreen() {
  const { width } = useWindowDimensions();
  const split = width >= SPLIT_WIDTH;
  const utils = trpc.useUtils();

  const [activeId, setActiveId] = useState<ShowcaseScenarioId>("voice-booking");
  const [notice, setNotice] = useState<string | null>(null);

  const sessionQuery = trpc.showcase.session.useQuery(undefined, {
    refetchOnWindowFocus: false,
    // 失敗後開慢速輪詢自己活過來 —— 否則限流過去了畫面還是死的,而畫面上
    // 那句「系統會自動重試」就成了假承諾。成功後自動關掉。
    refetchInterval: (_data, query) => recoveryRefetchInterval(query.state.status),
  });
  const timelineQuery = trpc.showcase.timeline.useQuery(
    {},
    {
      refetchInterval: TIMELINE_POLL_MS,
      // 分頁被切走時停止輪詢 —— 業務中場休息時不該繼續消耗請求額度。
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  );

  const session = sessionQuery.data;
  const readiness = useMemo(
    () => ({
      resident: Boolean(session?.ready),
      hardware: Boolean(session?.hardware?.connected),
      line: Boolean(session?.line?.configured),
    }),
    [session],
  );

  const active = SHOWCASE_SCENARIOS.find((s) => s.id === activeId) ?? SHOWCASE_SCENARIOS[0];
  // 全域阻擋(連線異常 / 尚未建資料)優先於單一情境的前置條件 —— 不然連線斷了
  // 畫面會叫業務去跑 seed,那不是問題所在。
  const globalBlock = showcaseBlockReason({
    sessionError: sessionQuery.isError,
    session: session ? { ready: session.ready, blockedReason: session.blockedReason } : undefined,
  });
  const availability = globalBlock
    ? { runnable: false, blockedReason: globalBlock, degraded: undefined }
    : scenarioAvailability(active, readiness);

  // 深層重置會清掉先前場次 —— 同一台伺服器上若有同事正在演,他的場次也會被清掉。
  // 所以需要按第二次確認,而且按鈕上直接寫出會刪幾筆。
  const [confirmDeep, setConfirmDeep] = useState(false);

  const resetMutation = trpc.showcase.reset.useMutation({
    onSuccess: async (result) => {
      const { bookings, workOrders, voiceEvents } = result.removed;
      const label = result.scope === "all" ? "已清除全部示範紀錄" : "已清除本場次";
      setNotice(`${label}:${bookings} 筆預約、${workOrders} 張工單、${voiceEvents} 筆語音紀錄`);
      setConfirmDeep(false);
      await Promise.all([utils.showcase.timeline.invalidate(), utils.showcase.session.invalidate()]);
    },
    onError: (error) => {
      setConfirmDeep(false);
      setNotice(`重置失敗:${error.message}`);
    },
  });

  const events = timelineQuery.data?.events ?? [];

  return (
    <View style={styles.root}>
      <TopBar
        session={session}
        loading={sessionQuery.isLoading}
        unreachable={sessionQuery.isError}
        onReset={() => resetMutation.mutate({ scope: "session" })}
        onDeepReset={() => {
          if (!confirmDeep) {
            setConfirmDeep(true);
            return;
          }
          resetMutation.mutate({ scope: "all" });
        }}
        confirmDeep={confirmDeep}
        resetting={resetMutation.isLoading}
      />

      <ScenarioTabs active={activeId} onSelect={setActiveId} readiness={readiness} />

      {notice ? (
        <Pressable onPress={() => setNotice(null)} style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
          <Text style={styles.noticeDismiss}>點一下關閉</Text>
        </Pressable>
      ) : null}

      <View style={[styles.body, split ? styles.bodyRow : styles.bodyColumn]}>
        {/* ── 左:客戶操作 ───────────────────────────────── */}
        <ScrollView
          style={split ? styles.leftSplit : styles.stacked}
          contentContainerStyle={styles.columnContent}
          showsVerticalScrollIndicator={false}
        >
          <ShowcaseCard accent={C.gold} style={styles.panel}>
            <ShowcaseHeading eyebrow="客戶會看到什麼" title={active.title} sub={active.promise} />

            {availability.blockedReason ? (
              <View style={styles.blockedBox}>
                <Text style={styles.blockedTitle}>此情境目前無法展示</Text>
                <Text style={styles.blockedBody}>{availability.blockedReason}</Text>
              </View>
            ) : (
              <>
                {availability.degraded ? (
                  <View style={styles.degradedBox}>
                    <Text style={styles.degradedText}>{availability.degraded}</Text>
                  </View>
                ) : null}
                <View style={styles.scenarioBody}>
                  <ScenarioBody scenario={active} session={session} onNotice={setNotice} />
                </View>
              </>
            )}
          </ShowcaseCard>

          <ShowcaseCard style={styles.scriptCard}>
            <Text style={styles.scriptLabel}>業務話術</Text>
            <Text style={styles.scriptText}>{active.script}</Text>
            <Text style={styles.proofLabel}>客戶問「這是真的嗎」</Text>
            <Text style={styles.proofText}>{active.proof}</Text>
          </ShowcaseCard>
        </ScrollView>

        {/* ── 右:管理中心即時反應 ───────────────────────── */}
        <View style={split ? styles.rightSplit : styles.stacked}>
          <ShowcaseCard accent={C.live} style={[styles.panel, styles.timelinePanel]}>
            <View style={styles.timelineHead}>
              <ShowcaseHeading eyebrow="MANAGEMENT DESK" title="管理中心" />
              <StatusPill label={timelineQuery.isFetching ? "接收中" : "即時"} tone="live" />
            </View>
            <Text style={styles.timelineSub}>
              客戶的每一句話在這裡變成系統紀錄 —— 這些都是真的寫進資料庫的資料。
            </Text>
            <View style={styles.timelineBody}>
              <TimelineFeed events={events} />
            </View>
          </ShowcaseCard>
        </View>
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────── */

type SessionData = RouterOutputs["showcase"]["session"] | undefined;

function TopBar({
  session,
  loading,
  unreachable,
  onReset,
  onDeepReset,
  confirmDeep,
  resetting,
}: {
  session: SessionData;
  loading: boolean;
  /** 查詢失敗 —— 狀態是「不知道」,不可以顯示成「沒有」。 */
  unreachable: boolean;
  onReset: () => void;
  onDeepReset: () => void;
  confirmDeep: boolean;
  resetting: boolean;
}) {
  const hardware = session?.hardware;
  const residue = session?.residue?.total ?? 0;
  return (
    <View style={styles.topBar}>
      <View style={styles.brandBlock}>
        <Text style={styles.brandEyebrow}>STAGE 1 · SHOW UNIT</Text>
        <Text style={styles.brandTitle}>樣品屋展示模式</Text>
      </View>

      <View style={styles.topStatus}>
        {loading ? (
          <ActivityIndicator color={C.gold} />
        ) : (
          <>
            {session?.resident ? (
              <StatusPill
                label={`代 ${session.resident.name}${session.resident.unitNumber ? ` · ${session.resident.unitNumber}` : ""}`}
                tone="gold"
              />
            ) : unreachable ? (
              // 連不上時狀態是「不知道」—— 不能斷言示範住戶不存在。
              <StatusPill label="連線中…" tone="warn" />
            ) : (
              <StatusPill label="尚未建立示範住戶" tone="warn" />
            )}
            {/* 硬體狀態同理:查不到就不顯示,而不是顯示成未連線。 */}
            {hardware && !unreachable ? (
              <StatusPill label={hardware.label} tone={hardware.connected ? "live" : "warn"} />
            ) : null}
          </>
        )}
        <ShowcaseButton
          label={resetting ? "清除中…" : "重置展示資料"}
          variant="ghost"
          onPress={onReset}
          disabled={resetting}
        />
        {/* 先前場次的殘留:一般重置碰不到它們(時間護欄擋著)。把筆數寫在按鈕上,
            按下去的人才知道自己在刪什麼。 */}
        {residue > 0 ? (
          <ShowcaseButton
            label={confirmDeep ? `確定刪除 ${residue} 筆?` : `先前場次殘留 ${residue} 筆`}
            variant="ghost"
            onPress={onDeepReset}
            disabled={resetting}
            style={confirmDeep ? styles.deepConfirm : undefined}
          />
        ) : null}
      </View>
    </View>
  );
}

function ScenarioTabs({
  active,
  onSelect,
  readiness,
}: {
  active: ShowcaseScenarioId;
  onSelect: (id: ShowcaseScenarioId) => void;
  readiness: { resident: boolean; hardware: boolean; line: boolean };
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // flexGrow:0 是必要的 —— 橫向 ScrollView 放在 flex 容器裡會撐滿剩餘
      // 高度,配上 borderRadius:999 就把膠囊拉成整頁高的巨大藥丸。
      style={styles.tabsScroll}
      contentContainerStyle={styles.tabs}
    >
      {SHOWCASE_SCENARIOS.map((scenario, index) => {
        const isActive = scenario.id === active;
        const { runnable } = scenarioAvailability(scenario, readiness);
        return (
          <Pressable
            key={scenario.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(scenario.id)}
            style={[styles.tab, isActive && styles.tabActive, !runnable && styles.tabBlocked]}
          >
            <Text style={[styles.tabIndex, isActive && styles.tabIndexActive]}>{index + 1}</Text>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
              {scenario.title}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ScenarioBody({
  scenario,
  session,
  onNotice,
}: {
  scenario: ShowcaseScenario;
  session: SessionData;
  onNotice: (message: string) => void;
}) {
  switch (scenario.id) {
    case "voice-booking":
      return <VoiceBookingScenario session={session} />;
    case "voice-device":
      return <DeviceScenario onNotice={onNotice} />;
    case "mobile-handoff":
      return <MobileHandoffScenario />;
    case "line-push":
      return <LinePushScenario onNotice={onNotice} />;
    default:
      return null;
  }
}

/** 情境 1 —— 重用住戶端與物業櫃檯共用的語音面板,只換注入的 command / commit。 */
function VoiceBookingScenario({ session }: { session: SessionData }) {
  const utils = trpc.useUtils();
  const commandMutation = trpc.voice.staffCommand.useMutation();
  const commitMutation = trpc.voice.staffCommit.useMutation({
    onSuccess: async () => {
      await utils.showcase.timeline.invalidate();
    },
  });

  const targetUserId = session?.resident?.id;

  const command = useCallback(
    (audio: { audioBase64: string; mimeType: string }) =>
      commandMutation.mutateAsync({
        audioBase64: audio.audioBase64,
        mimeType: audio.mimeType,
        language: "zh",
        targetUserId: targetUserId!,
      }),
    [commandMutation, targetUserId],
  );

  const commit = useCallback(
    (intent: string, slots: VoiceSlots) =>
      commitMutation.mutateAsync({
        intent: intent as never,
        slots: slots as never,
        targetUserId: targetUserId!,
      }),
    [commitMutation, targetUserId],
  );

  return (
    <VoiceBookingPanel
      command={command}
      commit={commit}
      disabled={!targetUserId}
      disabledHint="尚未建立示範住戶"
      // 展示頁固定深色,不能讓共用元件自己跟隨系統主題。
      palette={SHOWCASE_COLOR_SCHEME}
    />
  );
}

/** 情境 2 —— 真的改設備狀態,但沒接硬體時畫面已在上方標示「模擬設備」。 */
function DeviceScenario({ onNotice }: { onNotice: (message: string) => void }) {
  const utils = trpc.useUtils();
  const devicesQuery = trpc.showcase.devices.useQuery(undefined, { refetchOnWindowFocus: false });
  const updateMutation = trpc.iot.updateDevice.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.showcase.devices.invalidate(),
        utils.showcase.timeline.invalidate(),
      ]);
    },
    onError: (error) => onNotice(`設備控制失敗:${error.message}`),
  });

  const devices = devicesQuery.data?.devices ?? [];

  if (devicesQuery.isLoading) return <ActivityIndicator color={C.gold} />;
  if (devices.length === 0) {
    return (
      <Text style={styles.emptyHint}>
        示範住戶名下尚無設備。執行示範資料建置後,這裡會出現客廳燈、空調與窗簾。
      </Text>
    );
  }

  return (
    <View style={styles.deviceGrid}>
      {devices.map((device: { id: number; name: string; type: string; status: string }) => {
        const on = device.status === "on";
        return (
          <Pressable
            key={device.id}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            onPress={() =>
              updateMutation.mutate({ deviceId: device.id, status: on ? "off" : "on" })
            }
            style={[styles.deviceTile, on && styles.deviceTileOn]}
          >
            <Text style={[styles.deviceName, on && styles.deviceNameOn]}>{device.name}</Text>
            <Text style={[styles.deviceStatus, on && styles.deviceStatusOn]}>
              {on ? "開啟中" : "關閉"}
            </Text>
          </Pressable>
        );
      })}
      <Text style={styles.deviceHint}>
        對音箱說「打開客廳燈」也會讓這裡的狀態同步改變 —— 兩條路徑寫的是同一份資料。
      </Text>
    </View>
  );
}

/** 情境 3 —— 掃碼把同一套系統交到客戶自己手上。 */
function MobileHandoffScenario() {
  const url = useMemo(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.location.origin;
    }
    return process.env.EXPO_PUBLIC_WEB_URL ?? "https://mai-touch.app";
  }, []);

  return (
    <View style={styles.qrBlock}>
      <ShowcaseQrCode value={url} size={210} caption={url} />
      <Text style={styles.qrHint}>
        客戶用手機相機掃這個碼就會開啟同一套系統,不必安裝任何東西。剛才訂的公設,
        在他手機上看得到同一筆。
      </Text>
    </View>
  );
}

/**
 * 情境 4 —— 客戶掃碼加官方帳號,業務點一下,**客戶自己的手機**當場收到訊息。
 *
 * 刻意不用 lineAdmin.scriptRun:那支只推得到操作者自己綁定的裝置,推到業務
 * 手機上證明不了簡報承諾的那句「客戶的 LINE 當場收到」。
 */
function LinePushScenario({ onNotice }: { onNotice: (message: string) => void }) {
  const audienceQuery = trpc.showcase.lineAudience.useQuery(undefined, {
    refetchOnWindowFocus: false,
    // 客戶掃碼加好友後要很快出現在名單上,不然業務會以為壞了。
    refetchInterval: 5000,
  });
  const pushMutation = trpc.showcase.linePush.useMutation({
    onSuccess: () => onNotice("已推送 —— 請客戶看自己的手機"),
    onError: (error) => onNotice(`推播失敗:${error.message}`),
  });

  const [recipient, setRecipient] = useState<string | null>(null);
  const audience = audienceQuery.data;
  const recipients = audience?.recipients ?? [];
  const scripts = audience?.scripts ?? [];
  const selected = recipient ?? recipients[0]?.lineUserId ?? null;

  if (audienceQuery.isLoading) return <ActivityIndicator color={C.gold} />;

  return (
    <View style={styles.lineBlock}>
      {audience?.addFriendUrl ? (
        <ShowcaseQrCode
          value={audience.addFriendUrl}
          size={170}
          caption="請客戶用手機掃碼加入社區官方帳號"
        />
      ) : (
        <Text style={styles.emptyHint}>
          尚未設定官方帳號的基本 ID(LINE_BOT_BASIC_ID),無法產生加好友碼。
        </Text>
      )}

      <Text style={styles.lineSectionLabel}>推給誰</Text>
      {recipients.length === 0 ? (
        <Text style={styles.emptyHint}>
          還沒有人加入。請客戶掃上面的碼,加入後會自動出現在這裡(最新的排最前面)。
        </Text>
      ) : (
        <View style={styles.recipientRow}>
          {recipients.slice(0, 6).map((person: { lineUserId: string; displayName: string }) => {
            const active = person.lineUserId === selected;
            return (
              <Pressable
                key={person.lineUserId}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setRecipient(person.lineUserId)}
                style={[styles.recipient, active && styles.recipientActive]}
              >
                <Text style={[styles.recipientText, active && styles.recipientTextActive]}>
                  {person.displayName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.lineSectionLabel}>推什麼</Text>
      {scripts.map((script: { id: string; name: string }) => (
        <ShowcaseButton
          key={script.id}
          label={`推送:${script.name}`}
          variant="ghost"
          onPress={() =>
            selected && pushMutation.mutate({ scriptId: script.id, lineUserId: selected })
          }
          disabled={!selected || pushMutation.isLoading}
          style={styles.lineButton}
        />
      ))}
      {scripts.length === 0 ? <Text style={styles.emptyHint}>尚無可用的示範腳本。</Text> : null}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base, paddingHorizontal: 22, paddingTop: 18 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  brandBlock: { gap: 2 },
  brandEyebrow: { color: C.gold, fontSize: 10.5, fontWeight: "700", letterSpacing: 3 },
  brandTitle: { color: C.paper, fontSize: 24, fontWeight: "800", letterSpacing: 1 },
  topStatus: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },

  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: 10, paddingVertical: 16, alignItems: "center" },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: R.chip,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  tabActive: { borderColor: C.gold, backgroundColor: "#1b2b4a" },
  tabBlocked: { opacity: 0.45 },
  tabIndex: { color: C.faint, fontSize: 11, fontWeight: "800" },
  tabIndexActive: { color: C.gold },
  tabLabel: { color: C.muted, fontSize: 13, fontWeight: "700" },
  tabLabelActive: { color: C.paper },

  notice: {
    backgroundColor: "#16294a",
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: R.tile,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  deepConfirm: { borderColor: C.warn },
  noticeText: { color: C.paper, fontSize: 13, flex: 1 },
  noticeDismiss: { color: C.faint, fontSize: 11 },

  body: { flex: 1, gap: 18, paddingBottom: 18 },
  bodyRow: { flexDirection: "row" },
  bodyColumn: { flexDirection: "column" },
  leftSplit: { flex: 1.15 },
  rightSplit: { flex: 1 },
  stacked: { flex: 1 },

  panel: {},
  columnContent: { gap: 18, paddingBottom: 8 },
  scenarioBody: { marginTop: 18 },

  blockedBox: {
    marginTop: 18,
    padding: 16,
    borderRadius: R.tile,
    borderWidth: 1,
    borderColor: C.warn,
    backgroundColor: "#221d0f",
  },
  blockedTitle: { color: C.warn, fontSize: 13, fontWeight: "800", marginBottom: 5 },
  blockedBody: { color: C.muted, fontSize: 12.5, lineHeight: 19 },

  degradedBox: {
    marginTop: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: R.tile,
    borderWidth: 1,
    borderColor: C.warn,
    backgroundColor: "#1e1c14",
  },
  degradedText: { color: C.warn, fontSize: 12, fontWeight: "600", lineHeight: 18 },

  scriptCard: { backgroundColor: C.cardDeep },
  scriptLabel: { color: C.gold, fontSize: 10, fontWeight: "800", letterSpacing: 2.5 },
  scriptText: { color: C.paper, fontSize: 15, lineHeight: 24, marginTop: 8, fontWeight: "600" },
  proofLabel: {
    color: C.faint,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 16,
  },
  proofText: { color: C.muted, fontSize: 12.5, lineHeight: 20, marginTop: 6 },

  timelinePanel: { flex: 1, backgroundColor: C.cardDeep },
  timelineHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  timelineSub: { color: C.faint, fontSize: 12, lineHeight: 19, marginTop: 10 },
  timelineBody: { flex: 1, marginTop: 18 },

  deviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  deviceTile: {
    minWidth: 140,
    flexGrow: 1,
    padding: 16,
    borderRadius: R.tile,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.cardDeep,
  },
  deviceTileOn: { borderColor: C.gold, backgroundColor: "#1e2c17" },
  deviceName: { color: C.muted, fontSize: 14, fontWeight: "700" },
  deviceNameOn: { color: C.paper },
  deviceStatus: { color: C.faint, fontSize: 12, marginTop: 5 },
  deviceStatusOn: { color: C.live, fontWeight: "700" },
  deviceHint: { color: C.faint, fontSize: 12, lineHeight: 19, marginTop: 6 },

  qrBlock: { alignItems: "center", gap: 16 },
  qrHint: { color: C.muted, fontSize: 12.5, lineHeight: 20, textAlign: "center", maxWidth: 380 },

  lineBlock: { gap: 12 },
  lineSectionLabel: {
    color: C.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.5,
    marginTop: 6,
  },
  recipientRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  recipient: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: C.cardDeep,
  },
  recipientActive: { borderColor: C.gold, backgroundColor: "#1b2b4a" },
  recipientText: { color: C.muted, fontSize: 12.5, fontWeight: "700" },
  recipientTextActive: { color: C.paper },
  lineButton: { alignSelf: "flex-start" },

  emptyHint: { color: C.faint, fontSize: 12.5, lineHeight: 20 },
});
