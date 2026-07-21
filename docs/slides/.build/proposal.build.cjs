/* 系統方案規劃書 → ../系統方案規劃.pptx
   建商提案用：開發優先(Phase 0) × 分階段硬體導入(Phase 1–3)。
   延續「應用場景 / 推薦硬體配置清單」深藍×金風格；整合狀態對齊實際程式現況。 */
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");

// ---- 調色盤（與 hardware.build.cjs 一致）----
const C = {
  gold: "c9a35a", goldSoft: "e6cf9a", paper: "f6f3ec", muted: "9fb0cc",
  live: "69d6a8", core: "c9a35a", opt: "6fb1ff",
  cardFill: "12203a", cardLine: "3a4f73", white: "ffffff", capt: "cdd8ec",
  cardMute: "5e74a0", band: "14253f",
};
const JH = "Microsoft JhengHei";

// ---- SVG → base64 PNG ----
async function png(svg, px = 256) {
  const buf = await sharp(Buffer.from(svg))
    .resize(px, px, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
const W = (inner, vb = "0 0 24 24") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="${vb}">${inner}</svg>`;
const line = (color, inner) =>
  W(`<g fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`);

// ---- 圖示（描邊風，24x24）----
const I = (col) => ({
  cloud:   line(col, `<path d="M7 18a4 4 0 0 1 .4-8 5.5 5.5 0 0 1 10.7 1.4A3.4 3.4 0 0 1 17.5 18z"/>`),
  hub:     line(col, `<rect x="6" y="10" width="12" height="9.5" rx="2"/><circle cx="12" cy="14.7" r="1.3"/><path d="M9 8a5 5 0 0 1 6 0M7 6a8 8 0 0 1 10 0"/>`),
  network: line(col, `<rect x="3" y="9" width="18" height="6.5" rx="1.4"/><path d="M7 15.5v2.3M12 15.5v2.3M17 15.5v2.3M7 9V6.8M12 9V6.8M17 9V6.8"/>`),
  wifi:    line(col, `<path d="M5 9.5a10 10 0 0 1 14 0M7.6 12.4a6 6 0 0 1 8.8 0M10 15.2a2.4 2.4 0 0 1 4 0"/><circle cx="12" cy="18.4" r="0.9" fill="${col}" stroke="none"/>`),
  scan:    line(col, `<rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h3v3M20.5 14.5v0M17.5 20.5h3M20.5 17.5v3"/>`),
  barrier: line(col, `<circle cx="5" cy="17.4" r="2.3"/><path d="M5 15.1V8h1.6l13 .02"/><path d="M9.2 8v.01M12 8v.01M14.8 8v.01M17.6 8v.01"/>`),
  locker:  line(col, `<rect x="4" y="3" width="16" height="18" rx="1.6"/><path d="M12 3v18M4 9h16M4 15h16"/><path d="M8.5 6h.01M8.5 12h.01M8.5 18h.01"/>`),
  ups:     line(col, `<rect x="3" y="7.5" width="15" height="9" rx="2"/><path d="M21 10.5v3"/><path d="M11 9.4l-2.2 3.1H11l-2 3.1"/>`),
  speaker: line(col, `<rect x="6.5" y="3" width="11" height="18" rx="4"/><circle cx="12" cy="9" r="2.9"/><path d="M8.5 16.5h7"/>`),
  bulb:    line(col, `<path d="M9.5 18.5h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.6.6 1 1.3 1 2.4h5.6c0-1.1.4-1.8 1-2.4A6 6 0 0 0 12 3z"/>`),
  tablet:  line(col, `<rect x="5.5" y="3" width="13" height="18" rx="2"/><path d="M11 18h2"/>`),
  monitor: line(col, `<rect x="3" y="4.5" width="18" height="11.5" rx="2"/><path d="M8.5 20.5h7M12 16v4.5"/>`),
  phone:   line(col, `<rect x="7.5" y="2.5" width="9" height="19" rx="2.4"/><path d="M11 18.5h2"/>`),
  route:   line(col, `<rect x="3" y="13" width="18" height="6.5" rx="1.6"/><path d="M7 16.2h.01M11 16.2h.01"/><path d="M17 13V9.5M13 9.5h8M18.5 7l2.5 2.5-2.5 2.5"/>`),
  mic:     line(col, `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>`),
  elevator:line(col, `<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 17V8M8.5 11.5 12 8l3.5 3.5"/>`),
  code:    line(col, `<path d="M8.5 7.5 4 12l4.5 4.5M15.5 7.5 20 12l-4.5 4.5"/>`),
  brush:   line(col, `<path d="M14.5 3.5 20.5 9.5 9.8 20.2a2.6 2.6 0 0 1-3.7 0l-2.3-2.3a2.6 2.6 0 0 1 0-3.7z"/><path d="M12 6l6 6"/>`),
  flag:    line(col, `<path d="M5.5 21V4"/><path d="M5.5 4.8c4.2-2.4 8.2 2.2 13 .2v8.6c-4.8 2-8.8-2.6-13-.2"/>`),
  check:   line(col, `<circle cx="12" cy="12" r="8.8"/><path d="M8 12.3l2.7 2.7L16.3 9"/>`),
  users:   line(col, `<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 6.2a3.2 3.2 0 0 1 0 6"/><path d="M17 14.5a5.5 5.5 0 0 1 3.5 5.5"/>`),
  build:   line(col, `<path d="M3 21h18"/><path d="M5 21V8l7-4.5L19 8v13"/><path d="M9.5 21v-4h5v4M9.5 11h.01M14.5 11h.01M9.5 14h.01M14.5 14h.01"/>`),
  shield:  line(col, `<path d="M12 3l7.5 2.8v5.4c0 4.6-3.1 7.9-7.5 9.8-4.4-1.9-7.5-5.2-7.5-9.8V5.8z"/><path d="M8.8 12l2.3 2.3 4.1-4.4"/>`),
  db:      line(col, `<ellipse cx="12" cy="5.5" rx="7" ry="2.6"/><path d="M5 5.5v13c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-13"/><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>`),
  help:    line(col, `<circle cx="12" cy="12" r="8.8"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.9.6c0 1.6-2.4 2-2.4 3.4"/><path d="M12 16.6h.01"/>`),
  gear:    line(col, `<circle cx="12" cy="12" r="3.1"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"/>`),
});

// ---- 背景 ----
const bgPlainSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1333" height="750" viewBox="0 0 1333 750">
  <defs><radialGradient id="g2" cx="50%" cy="-8%" r="85%">
    <stop offset="0" stop-color="#1a2c4d"/><stop offset="0.55" stop-color="#0c1322"/><stop offset="1" stop-color="#070d18"/>
  </radialGradient></defs>
  <rect width="1333" height="750" fill="#070b14"/>
  <rect width="1333" height="750" fill="url(#g2)"/>
  <rect x="20" y="20" width="1293" height="710" rx="10" fill="none" stroke="#c9a35a" stroke-width="1" opacity="0.28"/>
</svg>`;

const stColor = { LIVE: C.live, CORE: C.core, OPT: C.opt };
// Phase 主色：P0 開發=綠、P1 基礎=金、P2 擴充=藍、P3 旗艦=淺金
const PH = [
  { id: "P0", name: "平台開發・客製", tag: "即刻啟動・預售期", col: C.live },
  { id: "P1", name: "基礎上線",       tag: "工程期・交屋前",   col: C.core },
  { id: "P2", name: "智慧擴充",       tag: "交屋・入住期",     col: C.opt },
  { id: "P3", name: "旗艦完善",       tag: "營運成熟期",       col: C.goldSoft },
];

(async () => {
  const bgPlain = "image/png;base64," + (await sharp(Buffer.from(bgPlainSvg)).png().toBuffer()).toString("base64");

  const ig = I("#" + C.gold), il = I("#" + C.live), ib = I("#" + C.opt), is = I("#" + C.goldSoft);
  const R = async (o) => { const m = {}; for (const k of Object.keys(o)) m[k] = await png(o[k], 176); return m; };
  const gold = await R(ig), liv = await R(il), blu = await R(ib), sof = await R(is);
  const phIcon = [liv.code, gold.network, blu.bulb, sof.route];

  const pres = new pptxgen();
  pres.defineLayout({ name: "S169", width: 13.333, height: 7.5 });
  pres.layout = "S169";
  pres.author = "智慧住宅管理平台";
  pres.title = "系統方案規劃書";

  // ---- 共用 ----
  const header = (s, eyebrow, title, sub, rightLines) => {
    s.addText(eyebrow, { x: 0.6, y: 0.34, w: 9, h: 0.3, fontSize: 11, color: C.gold, bold: true, charSpacing: 3, margin: 0 });
    s.addText(title, { x: 0.58, y: 0.58, w: 9.4, h: 0.62, fontSize: 26, bold: true, color: C.paper, margin: 0, fontFace: JH });
    s.addText(sub, { x: 0.6, y: 1.24, w: 9.6, h: 0.36, fontSize: 12.5, color: C.muted, margin: 0, fontFace: JH });
    if (rightLines) s.addText(rightLines, { x: 9.4, y: 0.5, w: 3.33, h: 0.9, align: "right", lineSpacingMultiple: 1.25, margin: 0, fontFace: JH });
  };
  const legend = (s, y) => s.addText([
    { text: "● ", options: { color: C.live } }, { text: "已整合上線　", options: { color: C.capt } },
    { text: "● ", options: { color: C.core } }, { text: "建議必備　", options: { color: C.capt } },
    { text: "○ ", options: { color: C.opt } }, { text: "選配・待接", options: { color: C.capt } },
  ], { x: 6.0, y, w: 6.73, h: 0.3, fontSize: 10.5, align: "right", margin: 0, fontFace: JH });
  const footer = (s, l, r) => {
    s.addText(l, { x: 0.6, y: 7.12, w: 6, h: 0.3, fontSize: 10.5, color: C.cardMute, margin: 0, fontFace: JH });
    s.addText(r, { x: 6.0, y: 7.12, w: 6.73, h: 0.3, fontSize: 10.5, color: C.cardMute, align: "right", margin: 0, fontFace: JH });
  };
  const dot = (st) => ({ text: (st === "OPT" ? "○ " : "● "), options: { color: stColor[st], fontSize: 10 } });
  const card = (s, x, y, w, h, opts = {}) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.11,
      fill: { color: opts.fill || C.cardFill, transparency: opts.tr ?? 20 },
      line: { color: opts.line || C.gold, width: opts.lw || 0.75, transparency: opts.ltr ?? 58 },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.3 } });

  // ============ Slide 1 · 封面 ============
  const cov = pres.addSlide();
  cov.background = { data: bgPlain };
  cov.addImage({ data: gold.flag, x: 6.06, y: 1.42, w: 1.2, h: 1.2 });
  cov.addText("SOLUTION BLUEPRINT · PHASED ROLLOUT",
    { x: 0, y: 2.98, w: 13.333, h: 0.34, fontSize: 13, color: C.gold, bold: true, charSpacing: 4, align: "center", margin: 0 });
  cov.addText("系統方案規劃書",
    { x: 0, y: 3.42, w: 13.333, h: 0.9, fontSize: 44, bold: true, color: C.paper, align: "center", margin: 0, fontFace: JH });
  cov.addShape(pres.shapes.LINE, { x: 6.16, y: 4.52, w: 1.0, h: 0, line: { color: C.gold, width: 1.2 } });
  cov.addText("高級住宅・智慧管理平台　｜　開發優先 × 分階段硬體導入",
    { x: 0, y: 4.7, w: 13.333, h: 0.4, fontSize: 15, color: C.capt, align: "center", margin: 0, fontFace: JH });
  cov.addText([
    { text: "平台開發 → 基礎上線 → 智慧擴充 → 旗艦完善", options: { color: C.goldSoft, bold: true } },
  ], { x: 0, y: 5.66, w: 13.333, h: 0.4, fontSize: 12.5, align: "center", margin: 0, fontFace: JH });
  cov.addText("※ 硬體項目與整合狀態對齊實際程式現況：已整合上線 · 建議必備 · 選配待接｜本方案不含報價，價格另行提供",
    { x: 0, y: 6.7, w: 13.333, h: 0.3, fontSize: 10.5, color: C.cardMute, align: "center", margin: 0, fontFace: JH });

  // ============ Slide 2 · 方案總覽 ============
  const ov = pres.addSlide();
  ov.background = { data: bgPlain };
  header(ov, "SOLUTION OVERVIEW", "方案總覽：一套平台，伴隨建案成長",
    "軟體平台先行、硬體按工程進度分階段就位 —— 從預售展示到旗艦社區",
    [{ text: "建商級住宅管理平台\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "先軟後硬 · 投入可控", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);

  // 平台組成帶
  card(ov, 0.5, 1.72, 12.33, 0.66, { fill: C.band, tr: 12, ltr: 50 });
  ov.addText([
    { text: "平台組成　", options: { color: C.gold, bold: true, fontSize: 11.5 } },
    { text: "住戶手機 App　・　管理後台 / 櫃檯 Kiosk　・　LINE 官方帳號　・　語音助理(預約/派單)　・　IoT 裝置控制", options: { color: C.capt, fontSize: 12 } },
  ], { x: 0.82, y: 1.72, w: 11.8, h: 0.66, valign: "middle", margin: 0, fontFace: JH });

  // 三大價值卡
  const vals = [
    { ic: gold.bulb,  t: "建案差異化", s: "智慧建材 × 智慧服務一體成形。預售期即在樣品屋實演「語音預約 → 自動派單」與語音控制情境，成為銷售亮點。" },
    { ic: liv.phone,  t: "交屋即用",   s: "軟體平台於 Phase 0 先行開發上線，住戶資料、公設、帳務提前建置 —— 交屋當日 App 與管理系統即刻開通。" },
    { ic: blu.route,  t: "先軟後硬・投入可控", s: "開發優先啟動，硬體分四階段隨工程進度導入；每階段獨立驗收，投資節奏可依銷售狀況調節。" },
  ];
  const vy = 2.66, vh = 2.9, vw = 3.98, vgx = 0.19;
  vals.forEach((v, i) => {
    const cx = 0.5 + i * (vw + vgx);
    card(ov, cx, vy, vw, vh);
    ov.addShape(pres.shapes.OVAL, { x: cx + vw / 2 - 0.42, y: vy + 0.3, w: 0.84, h: 0.84, fill: { color: "0f1c33" }, line: { color: C.gold, width: 0.9, transparency: 30 } });
    ov.addImage({ data: v.ic, x: cx + vw / 2 - 0.22, y: vy + 0.5, w: 0.44, h: 0.44 });
    ov.addText(v.t, { x: cx + 0.2, y: vy + 1.26, w: vw - 0.4, h: 0.4, fontSize: 16.5, bold: true, color: C.paper, align: "center", margin: 0, fontFace: JH });
    ov.addShape(pres.shapes.LINE, { x: cx + 1.1, y: vy + 1.74, w: vw - 2.2, h: 0, line: { color: C.gold, width: 0.6, dashType: "dash", transparency: 45 } });
    ov.addText(v.s, { x: cx + 0.32, y: vy + 1.86, w: vw - 0.64, h: vh - 2.0, fontSize: 11, color: C.capt, margin: 0, fontFace: JH, lineSpacingMultiple: 1.16, valign: "top" });
  });

  // 平台現況帶
  card(ov, 0.5, 5.84, 12.33, 0.72, { fill: "10241d", tr: 8, line: C.live, ltr: 30, lw: 1 });
  ov.addText([
    { text: "● 平台現況　", options: { color: C.live, bold: true, fontSize: 12 } },
    { text: "雲端後端・Web 管理端・LINE 整合・語音預約/派單・AI 管家・IoT 閘道 —— 均已整合上線，Phase 0 即可對外展示", options: { color: C.paper, fontSize: 12 } },
  ], { x: 0.82, y: 5.84, w: 11.8, h: 0.72, valign: "middle", margin: 0, fontFace: JH });
  footer(ov, "系統方案規劃書 ── 方案總覽", "一套系統 · 四個階段 · 隨建案成長");

  // ============ Slide 3 · 功能模組地圖 ============
  const fm = pres.addSlide();
  fm.background = { data: bgPlain };
  header(fm, "FEATURE MODULE MAP", "功能模組地圖",
    "十二大模組構成完整社區營運中樞 —— 絕大多數已整合上線",
    [{ text: "軟體功能現況\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "11 上線 · 1 待接硬體", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);
  legend(fm, 1.28);

  const mods = [
    { st: "LIVE", n: "公設預約",       s: "場地/設施線上預約・審核・時段管理" },
    { st: "LIVE", n: "語音預約・派單", s: "一句話代訂公設、自動建立派工" },
    { st: "LIVE", n: "包裹管理",       s: "到件登記・領取通知・簽收紀錄" },
    { st: "LIVE", n: "停車管理",       s: "車位配置・訪客車登記" },
    { st: "LIVE", n: "帳務繳費",       s: "管理費帳單・繳費紀錄・催繳" },
    { st: "LIVE", n: "公告通知",       s: "社區公告・LINE/簡訊/推播多通道" },
    { st: "LIVE", n: "維修工單",       s: "報修・派工・進度追蹤・完工回報" },
    { st: "LIVE", n: "住戶管理",       s: "住戶名冊・門牌綁定・權限分級" },
    { st: "LIVE", n: "LINE 整合",      s: "OA 綁定・推播・腳本客服・健康監控" },
    { st: "LIVE", n: "AI 管家",        s: "自然語言問答、導辦社區事務" },
    { st: "LIVE", n: "IoT 裝置控制",   s: "光/空調/窗簾/安防，經邊緣閘道下發" },
    { st: "OPT",  n: "門禁通行證",     s: "QR 通行證已實作；掃碼機為選配硬體" },
  ];
  const mx0 = 0.5, my0 = 1.78, mw = 2.94, mh = 1.56, mgx = 0.19, mgy = 0.16;
  mods.forEach((m, i) => {
    const cx = mx0 + (i % 4) * (mw + mgx);
    const cy = my0 + Math.floor(i / 4) * (mh + mgy);
    card(fm, cx, cy, mw, mh);
    fm.addText([dot(m.st), { text: m.n, options: { color: C.paper, bold: true, fontSize: 12.5 } }],
      { x: cx + 0.2, y: cy + 0.16, w: mw - 0.36, h: 0.32, valign: "middle", margin: 0, fontFace: JH });
    fm.addShape(pres.shapes.LINE, { x: cx + 0.2, y: cy + 0.56, w: mw - 0.4, h: 0, line: { color: C.gold, width: 0.5, dashType: "dash", transparency: 55 } });
    fm.addText(m.s, { x: cx + 0.22, y: cy + 0.64, w: mw - 0.44, h: mh - 0.78, fontSize: 9.5, color: C.capt, margin: 0, fontFace: JH, lineSpacingMultiple: 1.06, valign: "top" });
  });
  footer(fm, "系統方案規劃書 ── 功能模組地圖", "模組化架構：可依建案需求增減");

  // ============ Slide 4 · 系統架構（方案視角）============
  const ar = pres.addSlide();
  ar.background = { data: bgPlain };
  header(ar, "SYSTEM ARCHITECTURE", "系統架構：雲端到終端，分層解耦",
    "App 不直接對接設備 —— 指令經邊緣閘道下發，任一層可獨立擴充或替換",
    [{ text: "建商級住宅管理平台\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "雲 → 端 · 分層解耦", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);
  legend(ar, 1.28);

  const bands = [
    { ic: gold.phone,   t: "用戶端層",   en: "Clients",  ex: "住戶手機 App(iOS/Android/Web) · LINE 官方帳號 · 櫃檯平板 / 管理 Kiosk", st: "LIVE" },
    { ic: gold.cloud,   t: "雲端平台層", en: "Cloud",    ex: "Render 後端(tRPC) · Vercel Web · 訊息通道(LINE/SMS/推播) · AI(Gemini/NLP)", st: "LIVE" },
    { ic: gold.hub,     t: "社區閘道層", en: "Gateway",  ex: "路由/防火牆(VLAN) · PoE 交換器 · 邊緣閘道主機(HTTP 已通/MQTT·Modbus 待接) · UPS", st: "CORE" },
    { ic: gold.bulb,    t: "設備層",     en: "Devices",  ex: "門禁/柵欄/包裹櫃/電梯 · 住戶光/空調/窗簾/安防 · Google Nest 音箱/顯示器", st: "OPT" },
  ];
  const bY = 1.86, bH = 1.08, bGap = 0.17, bx = 0.62, bw = 11.05;
  bands.forEach((b, i) => {
    const y = bY + i * (bH + bGap);
    ar.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y, w: bw, h: bH, rectRadius: 0.1,
      fill: { color: C.band, transparency: 12 }, line: { color: C.gold, width: 0.75, transparency: 55 },
      shadow: { type: "outer", color: "000000", blur: 7, offset: 2, angle: 90, opacity: 0.28 } });
    ar.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y, w: 0.09, h: bH, rectRadius: 0.04, fill: { color: stColor[b.st] }, line: { type: "none" } });
    ar.addShape(pres.shapes.OVAL, { x: bx + 0.3, y: y + bH / 2 - 0.33, w: 0.66, h: 0.66,
      fill: { color: "0f1c33" }, line: { color: C.gold, width: 0.75, transparency: 40 } });
    ar.addImage({ data: b.ic, x: bx + 0.45, y: y + bH / 2 - 0.18, w: 0.36, h: 0.36 });
    ar.addText([
      { text: b.t + "  ", options: { fontSize: 15.5, bold: true, color: C.paper } },
      { text: b.en, options: { fontSize: 10, color: C.cardMute } },
    ], { x: bx + 1.16, y, w: 2.9, h: bH, valign: "middle", margin: 0, fontFace: JH });
    ar.addText(b.ex, { x: bx + 4.05, y, w: bw - 4.25, h: bH, fontSize: 11.5, color: C.capt, valign: "middle", margin: 0, fontFace: JH, lineSpacingMultiple: 1.08 });
    if (i < bands.length - 1)
      ar.addText("↓", { x: bx + 0.51, y: y + bH - 0.03, w: 0.24, h: bGap + 0.06, fontSize: 12, color: C.gold, align: "center", valign: "middle", margin: 0 });
  });
  const axX = 12.05;
  ar.addShape(pres.shapes.LINE, { x: axX, y: bY + 0.2, w: 0, h: bH * 4 + bGap * 3 - 0.4, line: { color: C.cardLine, width: 1.4, dashType: "dash", endArrowType: "triangle", beginArrowType: "triangle" } });
  ar.addText("指令\n下行", { x: axX + 0.06, y: bY + 0.25, w: 0.85, h: 0.7, fontSize: 10.5, bold: true, color: C.goldSoft, align: "center", margin: 0, fontFace: JH, lineSpacingMultiple: 1.0 });
  ar.addText("狀態\n回報", { x: axX + 0.06, y: bY + bH * 4 + bGap * 3 - 0.95, w: 0.85, h: 0.7, fontSize: 10.5, bold: true, color: C.opt, align: "center", margin: 0, fontFace: JH, lineSpacingMultiple: 1.0 });
  footer(ar, "系統方案規劃書 ── 系統架構", "Phase 0 建雲端 · Phase 1 建閘道 · Phase 2/3 接設備");

  // ============ Slide 5 · 分階段導入路線圖 ============
  const rd = pres.addSlide();
  rd.background = { data: bgPlain };
  header(rd, "PHASED ROLLOUT ROADMAP", "分階段導入路線圖：開發優先，硬體隨工程就位",
    "四個階段對齊建案時程 —— 每階段獨立驗收，投資節奏可依銷售進度調節",
    [{ text: "同一套平台\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "P0 開發 → P1–P3 硬體", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);

  // 時間軸
  rd.addShape(pres.shapes.LINE, { x: 0.7, y: 2.32, w: 11.9, h: 0, line: { color: C.cardLine, width: 1.6, endArrowType: "triangle" } });
  const rW = 3.0, rGap = 0.12, rx0 = 0.52;
  const road = [
    { inv: ["品牌化客製・功能開發", "雲端部署(Render/Vercel/LINE)", "樣品屋示範組:平板+音箱+情境設備"], hi: "樣品屋實演語音預約→派單" },
    { inv: ["路由/防火牆・PoE 網路", "邊緣閘道主機 + UPS", "櫃檯平板・管理 Kiosk"], hi: "物業管理全功能營運" },
    { inv: ["大廳 QR 掃碼門禁", "住戶 IoT + Nest 音箱/顯示器", "公區 Wi-Fi 6E 覆蓋"], hi: "住戶智慧體驗上線" },
    { inv: ["車牌辨識・包裹櫃・電梯介接", "自架 NLP + PostgreSQL", "雙 UPS / 雙上聯備援"], hi: "全自動無感社區服務" },
  ];
  road.forEach((r, i) => {
    const p = PH[i];
    const cx = rx0 + i * (rW + rGap);
    const ccx = cx + rW / 2;
    // 節點
    rd.addShape(pres.shapes.OVAL, { x: ccx - 0.27, y: 2.05, w: 0.54, h: 0.54, fill: { color: p.col }, line: { color: "0b1220", width: 1.5 } });
    rd.addText(p.id, { x: ccx - 0.27, y: 2.05, w: 0.54, h: 0.54, fontSize: 12.5, bold: true, color: "0b1220", align: "center", valign: "middle", margin: 0 });
    // 名稱 + 時點
    rd.addText(p.name, { x: cx, y: 2.68, w: rW, h: 0.36, fontSize: 15.5, bold: true, color: C.paper, align: "center", margin: 0, fontFace: JH });
    rd.addText(p.tag, { x: cx, y: 3.04, w: rW, h: 0.28, fontSize: 10.5, bold: true, color: p.col, align: "center", charSpacing: 1, margin: 0, fontFace: JH });
    // 內容卡
    const cy = 3.42, ch = 3.1;
    card(rd, cx, cy, rW, ch, i === 0 ? { fill: "13241d", tr: 10, line: C.live, ltr: 40, lw: 1 } : {});
    rd.addText("投入重點", { x: cx + 0.24, y: cy + 0.14, w: rW - 0.48, h: 0.26, fontSize: 10, bold: true, color: C.cardMute, charSpacing: 2, margin: 0, fontFace: JH });
    rd.addText(r.inv.map((t) => ({ text: t, options: { color: C.capt, fontSize: 10.5, bullet: { code: "2022", indent: 12 }, paraSpaceAfter: 6 } })),
      { x: cx + 0.22, y: cy + 0.42, w: rW - 0.42, h: 1.62, valign: "top", margin: 0, fontFace: JH, lineSpacingMultiple: 1.05 });
    rd.addShape(pres.shapes.LINE, { x: cx + 0.24, y: cy + ch - 0.82, w: rW - 0.48, h: 0, line: { color: p.col, width: 0.6, dashType: "dash", transparency: 40 } });
    rd.addText([{ text: "亮點　", options: { color: C.cardMute, fontSize: 9.5 } }, { text: r.hi, options: { color: p.col, fontSize: 11, bold: true } }],
      { x: cx + 0.24, y: cy + ch - 0.7, w: rW - 0.48, h: 0.56, valign: "middle", margin: 0, fontFace: JH, lineSpacingMultiple: 1.05 });
  });
  rd.addText("※ Phase 0 以軟體開發為優先，硬體僅需樣品屋最小組（櫃檯平板＋智慧音箱）；Phase 1 起隨建案工程分批進場 —— 避免一次性重投資。",
    { x: 0.62, y: 6.74, w: 12.1, h: 0.3, fontSize: 10, italic: true, color: C.cardMute, margin: 0, fontFace: JH });
  footer(rd, "系統方案規劃書 ── 分階段導入路線圖", "開發優先 · 每階段獨立驗收");

  // ============ Slide 6–9 · Phase 明細（共用版型）============
  const phaseSlide = (pi, eyebrow, sub, invTitle, invest, unlock, note) => {
    const p = PH[pi];
    const s = pres.addSlide();
    s.background = { data: bgPlain };
    header(s, eyebrow, `${p.id}　${p.name}`, sub,
      [{ text: "階段時點\n", options: { color: C.muted, fontSize: 11.5 } },
       { text: p.tag, options: { color: p.col, fontSize: 13, bold: true } }]);
    legend(s, 1.28);

    // 左：本階段投入
    const ly = 1.72, lh = 4.78, lw2 = 6.75;
    card(s, 0.5, ly, lw2, lh);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: ly, w: 0.09, h: lh, rectRadius: 0.04, fill: { color: p.col }, line: { type: "none" } });
    s.addText(invTitle, { x: 0.78, y: ly + 0.14, w: lw2 - 0.5, h: 0.3, fontSize: 12, bold: true, color: p.col, charSpacing: 2, margin: 0, fontFace: JH });
    const n = invest.length;
    const rowH = (lh - 0.62) / n;
    invest.forEach((it, k) => {
      const ry = ly + 0.52 + k * rowH;
      s.addText([dot(it.st), { text: it.n, options: { color: C.paper, bold: true, fontSize: 12 } }],
        { x: 0.78, y: ry, w: lw2 - 1.0, h: 0.26, margin: 0, fontFace: JH });
      s.addText(it.s, { x: 1.02, y: ry + 0.27, w: lw2 - 1.3, h: rowH - 0.3, fontSize: 9.8, color: C.capt, margin: 0, fontFace: JH, lineSpacingMultiple: 1.0, valign: "top" });
    });

    // 右：解鎖功能與價值
    const rx = 7.42, rw2 = 5.41;
    card(s, rx, ly, rw2, lh, { fill: C.band, tr: 12 });
    s.addText("本階段解鎖", { x: rx + 0.28, y: ly + 0.14, w: rw2 - 0.56, h: 0.3, fontSize: 12, bold: true, color: C.goldSoft, charSpacing: 2, margin: 0, fontFace: JH });
    s.addText(unlock.map((t) => ({ text: t, options: { color: C.capt, fontSize: 11.5, bullet: { code: "2022", indent: 14 }, paraSpaceAfter: 10 } })),
      { x: rx + 0.3, y: ly + 0.56, w: rw2 - 0.6, h: lh - 0.75, valign: "top", margin: 0, fontFace: JH, lineSpacingMultiple: 1.12 });

    s.addText("※ " + note, { x: 0.5, y: 6.7, w: 12.33, h: 0.3, fontSize: 10, italic: true, color: C.cardMute, margin: 0, fontFace: JH });
    footer(s, `系統方案規劃書 ── ${p.id} ${p.name}`, `${PH.map((q) => q.id).join(" → ")}　目前位置：${p.id}`);
  };

  // ---- Phase 0 · 平台開發・客製 ----
  phaseSlide(0, "PHASE 0 · DEVELOPMENT FIRST",
    "以軟體開發為優先 —— 樣品屋以最小硬體實演「語音預約 → 自動派單」全流程",
    "本階段投入（開發為主・樣品屋示範）", [
      { st: "LIVE", n: "語音預約・派單實演(樣品屋)", s: "對平板說一句話預約公設 → 系統自動建立派工單 —— 全流程功能已上線" },
      { st: "CORE", n: "樣品屋示範組", s: "櫃檯平板 ×1(語音預約/派單) + Google Nest 音箱 ×1(語音裝置控制)" },
      { st: "OPT",  n: "樣品屋情境設備", s: "示範閘道 + 少量燈光/空調/窗簾實裝(或 DRY_RUN 乾跑展示)" },
      { st: "LIVE", n: "品牌化客製開發", s: "建案名稱/主視覺/公設清單/收費規則 —— 以現有平台為基底客製" },
      { st: "LIVE", n: "雲端環境部署", s: "Render 後端 + Vercel Web + LINE 官方帳號申請綁定" },
      { st: "LIVE", n: "功能盤點與客製", s: "依建案定位增修模組(門禁流程/停車規則/公設時段等)" },
    ], [
      "樣品屋實演：「一句話預約公設 → 自動派單」完整流程",
      "語音開關燈光・空調(Nest 裝置控制),智慧情境眼見為憑",
      "預售期銷售現場互動展示,成交前先體驗入住後生活",
      "建案官方 LINE 提前開通,經營潛在住戶客群",
      "住戶名冊・帳務規則預建 + 管理後台先行試營運",
      "最小硬體投入 —— 開發、行銷、預售同步推進",
    ],
    "語音預約/派單由平板・App 麥克風管道提供(已上線);Google 音箱僅裝置控制 —— 樣品屋兩者並列展示、分工明確。");

  // ---- Phase 1 · 基礎上線 ----
  phaseSlide(1, "PHASE 1 · FOUNDATION",
    "社區網路與管理中樞就位 —— 物業管理全功能正式營運",
    "本階段投入（基礎硬體）", [
      { st: "CORE", n: "路由 / 防火牆(VLAN)", s: "IoT / 管理 / 訪客網段隔離,社區網路安全基礎" },
      { st: "CORE", n: "PoE 網路交換器", s: "8–24 埠,供電後續掃碼機 / 攝影機 / AP" },
      { st: "CORE", n: "邊緣閘道主機", s: "無風扇工控機(N100/8GB/128GB),常駐 Gateway 服務" },
      { st: "CORE", n: "不斷電系統 UPS", s: "≥600VA,保障中樞與網路斷電續航" },
      { st: "CORE", n: "物業櫃檯平板", s: "10 吋以上 —— 語音代訂 + 管理後台操作" },
      { st: "LIVE", n: "管理中心 Web Kiosk", s: "react-native-web 儀表板,櫃檯大螢幕一體機" },
      { st: "LIVE", n: "雲端方案升級", s: "Render Starter 持久磁碟(SQLite/PG),正式營運等級" },
    ], [
      "公設預約・帳務・公告・工單・包裹・停車 全面營運",
      "櫃檯語音代訂與自動派工上線",
      "LINE / 簡訊 / App 推播多通道通知住戶",
      "管理中心儀表板即時掌握社區動態",
      "機房與 VLAN 就緒 —— Phase 2/3 設備即插即用",
    ],
    "機房位置與弱電管線需於建案工程期預留(與建商土建併行),交屋前完成佈建與驗收。");

  // ---- Phase 2 · 智慧擴充 ----
  phaseSlide(2, "PHASE 2 · SMART EXPANSION",
    "門禁與住戶智慧設備進場 —— 住戶「智慧生活」體驗上線",
    "本階段投入（智慧硬體）", [
      { st: "OPT",  n: "大廳 QR 掃碼門禁", s: "QR 掃描器 + 電子鎖控制器(通行證 QR 已實作,接上即用)" },
      { st: "LIVE", n: "住戶智慧設備", s: "光/空調/窗簾/安防 —— 經閘道由住戶 App 控制(整合已上線)" },
      { st: "LIVE", n: "Google Nest 音箱 / 顯示器", s: "官方 Cloud-to-Cloud 語音裝置控制(已整合上線)" },
      { st: "CORE", n: "Google Nest Wifi Pro", s: "Wi-Fi 6E Mesh,公區與示範戶無線覆蓋" },
      { st: "OPT",  n: "協定橋接模組", s: "MQTT Broker + Modbus 閘道,對接實體設備廠牌" },
    ], [
      "住戶 QR 通行證掃碼進出、訪客邀請通行",
      "住戶 App 一鍵控制家中燈光・空調・窗簾",
      "對 Nest 音箱說一句話,開關燈光空調(裝置控制)",
      "IoT 排程與情境模式(回家/離家/睡眠)",
      "示範戶 → 標準配備:智慧宅成為交屋標配賣點",
    ],
    "語音「預約公設」由 App / 櫃檯麥克風管道提供;Google 音箱僅做裝置控制 —— 分工明確、不誇大。");

  // ---- Phase 3 · 旗艦完善 ----
  phaseSlide(3, "PHASE 3 · FLAGSHIP",
    "全自動無感服務與資料自主 —— 大型建案的旗艦級完成式",
    "本階段投入（旗艦硬體）", [
      { st: "OPT", n: "車牌辨識柵欄(LPR)", s: "住戶車自動放行,訪客車連動登記(現為人工輸入)" },
      { st: "OPT", n: "智能包裹櫃", s: "到件自動通知・掃碼自助取件(現為櫃檯登記)" },
      { st: "OPT", n: "電梯介接控制器", s: "乾接點 / BACnet —— 支援『電梯禮賓』呼梯" },
      { st: "OPT", n: "Nest Hub Max 公設看板", s: "10 吋大屏,公設迎賓 / 管理端資訊看板" },
      { st: "OPT", n: "自架 NLP + PostgreSQL", s: "FastAPI 語意服務自架 + 資料庫升級,資料完全自主" },
      { st: "OPT", n: "備援與冗餘", s: "雙 UPS / 雙上聯,旗艦級可用性" },
    ], [
      "車牌辨識自動放行 —— 進出零等待",
      "包裹到件即推播,自助取件免排隊",
      "電梯禮賓:通行證掃碼自動呼梯到府層",
      "公設迎賓看板與管理端數據大屏",
      "語意服務與資料庫自主部署,不依賴外部 AI 供應商",
    ],
    "本階段全數為選配,可依社區營運需求逐項導入 —— 每一項都在既有閘道與網路基礎上疊加。");

  // ============ Slide 10 · 資安與維運保障 ============
  const sec = pres.addSlide();
  sec.background = { data: bgPlain };
  header(sec, "SECURITY & OPERATIONS", "資安與維運保障",
    "資訊安全與長期維運是平台的一部分,不是附加選項",
    [{ text: "全面資安稽核\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "已完成・全數修復", options: { color: C.live, fontSize: 12, bold: true } }]);
  legend(sec, 1.28);

  const secCols = [
    { ic: gold.shield, t: "資訊安全", items: [
      { st: "LIVE", n: "權限分級控管", s: "住戶/物業/管理員三級角色 —— 後台每項操作皆經授權驗證" },
      { st: "LIVE", n: "全面資安稽核", s: "已完成整體安全稽核,發現項目全數修復並部署上線" },
      { st: "LIVE", n: "加密與金鑰管理", s: "全程 HTTPS/TLS 加密;金鑰以環境變數管理,具輪替流程" },
      { st: "CORE", n: "網路分段隔離", s: "IoT/管理/訪客 VLAN 隔離(P1 佈建),設備不直通外網" },
      { st: "LIVE", n: "紀錄可追溯", s: "訊息與操作事件留存紀錄,異常行為可稽核回溯" },
    ]},
    { ic: gold.gear, t: "維運保障", items: [
      { st: "LIVE", n: "健康監控儀表板", s: "LINE 通道流量/錯誤率即時監控,異常提前掌握" },
      { st: "LIVE", n: "不中斷更新", s: "雲端自動化部署 —— 功能迭代與修補不停機" },
      { st: "CORE", n: "斷電・離線韌性", s: "機房 UPS 續航;實體門禁獨立運作,平台恢復後資料補同步" },
      { st: "OPT",  n: "資料持久與自主", s: "持久磁碟儲存;P3 可升級自架 PostgreSQL,資料完全落地" },
      { st: "LIVE", n: "維運支援", s: "平台方負責監控、版本更新與技術支援(見導入分工)" },
    ]},
  ];
  const scY = 1.72, scH = 4.78, scW = 6.07;
  secCols.forEach((col, i) => {
    const cx = 0.5 + i * (scW + 0.19);
    card(sec, cx, scY, scW, scH, i === 0 ? {} : { fill: C.band, tr: 12 });
    sec.addShape(pres.shapes.OVAL, { x: cx + 0.24, y: scY + 0.16, w: 0.5, h: 0.5, fill: { color: "0f1c33" }, line: { color: C.gold, width: 0.8, transparency: 35 } });
    sec.addImage({ data: col.ic, x: cx + 0.365, y: scY + 0.285, w: 0.25, h: 0.25 });
    sec.addText(col.t, { x: cx + 0.88, y: scY + 0.16, w: scW - 1.1, h: 0.5, fontSize: 15, bold: true, color: C.paper, valign: "middle", margin: 0, fontFace: JH });
    sec.addShape(pres.shapes.LINE, { x: cx + 0.24, y: scY + 0.82, w: scW - 0.48, h: 0, line: { color: C.gold, width: 0.5, dashType: "dash", transparency: 55 } });
    const n2 = col.items.length, rowH2 = (scH - 1.0) / n2;
    col.items.forEach((it, k) => {
      const ry = scY + 0.92 + k * rowH2;
      sec.addText([dot(it.st), { text: it.n, options: { color: C.paper, bold: true, fontSize: 12 } }],
        { x: cx + 0.26, y: ry, w: scW - 0.5, h: 0.26, margin: 0, fontFace: JH });
      sec.addText(it.s, { x: cx + 0.5, y: ry + 0.27, w: scW - 0.78, h: rowH2 - 0.3, fontSize: 9.8, color: C.capt, margin: 0, fontFace: JH, lineSpacingMultiple: 1.0, valign: "top" });
    });
  });
  sec.addText("※ 資安稽核與修復為平台既有成果,非額外收費項目;VLAN 與 UPS 屬 Phase 1 基礎硬體。",
    { x: 0.5, y: 6.7, w: 12.33, h: 0.3, fontSize: 10, italic: true, color: C.cardMute, margin: 0, fontFace: JH });
  footer(sec, "系統方案規劃書 ── 資安與維運保障", "安全是平台的一部分,不是附加選項");

  // ============ Slide 11 · 常見問題 FAQ ============
  const fq = pres.addSlide();
  fq.background = { data: bgPlain };
  header(fq, "FAQ", "常見問題",
    "建商與管委會最常提出的六個疑問,一次說清楚",
    [{ text: "疑慮先回答\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "決策更安心", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);

  const faqs = [
    { q: "外網斷線,社區會癱瘓嗎?", a: "門禁、柵欄等實體系統具獨立運作能力,平台離線不影響基本進出;機房 UPS 斷電續航,恢復後紀錄自動補同步。" },
    { q: "資料是誰的?", a: "資料歸屬建案/管委會。Phase 3 可自架語意服務與 PostgreSQL,資料與 AI 完全落地自主,不依賴外部供應商。" },
    { q: "換物業公司怎麼辦?", a: "平台角色權限分級,移交即帳號交接 —— 住戶資料、帳務、工單流程完整留存於平台,營運不中斷。" },
    { q: "會被特定硬體廠牌綁死嗎?", a: "分層解耦架構:設備經標準協定(HTTP/MQTT/Modbus)接入閘道,單一設備可獨立替換,不牽動整套系統。" },
    { q: "住戶不會用怎麼辦?", a: "LINE 免安裝即可綁定、接收通知與客服;App 承載進階功能,雙軌並行。導入期由平台方支援住戶教育訓練。" },
    { q: "後續維護費用怎麼算?", a: "雲端資源按階段升級、硬體分批投入,避免一次性重投資;維運與授權模式於報價單另行詳列。" },
  ];
  const fw = 3.98, fh = 2.32, fx0 = 0.5, fy0 = 1.78, fgx = 0.19, fgy = 0.18;
  faqs.forEach((f, i) => {
    const cx = fx0 + (i % 3) * (fw + fgx);
    const cy = fy0 + Math.floor(i / 3) * (fh + fgy);
    card(fq, cx, cy, fw, fh);
    fq.addText([
      { text: "Q  ", options: { color: C.gold, bold: true, fontSize: 14 } },
      { text: f.q, options: { color: C.paper, bold: true, fontSize: 12.5 } },
    ], { x: cx + 0.22, y: cy + 0.16, w: fw - 0.44, h: 0.6, valign: "middle", margin: 0, fontFace: JH, lineSpacingMultiple: 1.05 });
    fq.addShape(pres.shapes.LINE, { x: cx + 0.22, y: cy + 0.84, w: fw - 0.44, h: 0, line: { color: C.gold, width: 0.5, dashType: "dash", transparency: 55 } });
    fq.addText(f.a, { x: cx + 0.24, y: cy + 0.94, w: fw - 0.48, h: fh - 1.1, fontSize: 10.3, color: C.capt, margin: 0, fontFace: JH, lineSpacingMultiple: 1.12, valign: "top" });
  });
  fq.addText("※ 其他技術與商務問題,歡迎於需求盤點會議提出 —— 我們以實際系統現況回答,不做誇大承諾。",
    { x: 0.5, y: 6.7, w: 12.33, h: 0.3, fontSize: 10, italic: true, color: C.cardMute, margin: 0, fontFace: JH });
  footer(fq, "系統方案規劃書 ── 常見問題", "疑慮先回答 · 決策更安心");

  // ============ Slide 12 · 導入分工與下一步 ============
  const nx = pres.addSlide();
  nx.background = { data: bgPlain };
  header(nx, "ROLES & NEXT STEPS", "導入分工與下一步",
    "建商・物業・平台方三方分工明確 —— 四步驟啟動導入",
    [{ text: "從開發啟動\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "到旗艦社區", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);

  const roles = [
    { ic: gold.build, t: "建商", s: ["工程期預留機房/弱電/管線", "社區網路與佈線施作", "硬體採購(依階段清單)", "交屋流程與平台銜接"] },
    { ic: liv.users,  t: "物業公司", s: ["櫃檯日常營運與語音代訂", "住戶教育訓練與導入", "公設/包裹/工單現場管理", "回饋需求,滾動優化"] },
    { ic: blu.gear,   t: "平台方(我們)", s: ["軟體平台開發與品牌客製", "系統整合與硬體對接", "雲端部署與維運監控", "技術支援與版本更新"] },
  ];
  const oy = 1.76, oh = 2.86, ow = 3.98, ogx = 0.19;
  roles.forEach((r, i) => {
    const cx = 0.5 + i * (ow + ogx);
    card(nx, cx, oy, ow, oh);
    nx.addShape(pres.shapes.OVAL, { x: cx + 0.24, y: oy + 0.22, w: 0.62, h: 0.62, fill: { color: "0f1c33" }, line: { color: C.gold, width: 0.9, transparency: 30 } });
    nx.addImage({ data: r.ic, x: cx + 0.39, y: oy + 0.37, w: 0.32, h: 0.32 });
    nx.addText(r.t, { x: cx + 1.0, y: oy + 0.22, w: ow - 1.2, h: 0.62, fontSize: 16, bold: true, color: C.paper, valign: "middle", margin: 0, fontFace: JH });
    nx.addShape(pres.shapes.LINE, { x: cx + 0.24, y: oy + 1.0, w: ow - 0.48, h: 0, line: { color: C.gold, width: 0.5, dashType: "dash", transparency: 55 } });
    nx.addText(r.s.map((t) => ({ text: t, options: { color: C.capt, fontSize: 11, bullet: { code: "2022", indent: 12 }, paraSpaceAfter: 7 } })),
      { x: cx + 0.3, y: oy + 1.12, w: ow - 0.56, h: oh - 1.3, valign: "top", margin: 0, fontFace: JH, lineSpacingMultiple: 1.08 });
  });

  // 四步驟流程
  const steps = [
    { n: "①", t: "需求盤點・客製開發", s: "Phase 0 啟動" },
    { n: "②", t: "網路機房佈建", s: "工程期併行" },
    { n: "③", t: "硬體整合部署", s: "Phase 2/3 分批" },
    { n: "④", t: "驗收培訓・上線", s: "逐階段交付" },
  ];
  const sy = 4.94, sh = 1.06, sw = 2.86, sgx = 0.29;
  steps.forEach((st, i) => {
    const cx = 0.62 + i * (sw + sgx);
    card(nx, cx, sy, sw, sh, { fill: C.band, tr: 10 });
    nx.addText([
      { text: st.n + "  ", options: { color: C.gold, bold: true, fontSize: 15 } },
      { text: st.t + "\n", options: { color: C.paper, bold: true, fontSize: 12 } },
      { text: st.s, options: { color: C.cardMute, fontSize: 9.5 } },
    ], { x: cx + 0.2, y: sy, w: sw - 0.4, h: sh, valign: "middle", margin: 0, fontFace: JH, lineSpacingMultiple: 1.1 });
    if (i < steps.length - 1)
      nx.addText("→", { x: cx + sw - 0.02, y: sy, w: sgx + 0.06, h: sh, fontSize: 15, bold: true, color: C.gold, align: "center", valign: "middle", margin: 0 });
  });

  nx.addText("同一套平台，從預售接待中心到旗艦社區 —— 開發優先啟動，硬體隨建案成長分批就位。",
    { x: 0, y: 6.3, w: 13.333, h: 0.36, fontSize: 14, bold: true, color: C.goldSoft, align: "center", margin: 0, fontFace: JH });
  footer(nx, "系統方案規劃書 ── 導入分工與下一步", "P0 開發 → P1 基礎 → P2 智慧 → P3 旗艦");

  await pres.writeFile({ fileName: "../系統方案規劃.pptx" });
  console.log("written ../系統方案規劃.pptx (12 slides)");
})();
