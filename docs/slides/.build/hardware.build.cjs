/* 推薦硬體配置清單（銷售／代銷版） → ../推薦硬體配置清單.pptx
   延續「應用場景」深藍×金的高級住宅風格。
   V3：以「分階段導入」為主軸重寫 —— 每階段先講客戶／住戶看得到什麼，再講要裝什麼。
   用語一律白話化（不出現 VLAN / PoE / MQTT / Modbus / Kiosk 等術語），規格細節退到附註。 */
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");

// ---- 調色盤（與 build.cjs 一致）----
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
  server:  line(col, `<rect x="4" y="4" width="16" height="7" rx="1.4"/><rect x="4" y="13" width="16" height="7" rx="1.4"/><path d="M8 7.5h.01M8 16.5h.01"/>`),
  hub:     line(col, `<rect x="6" y="10" width="12" height="9.5" rx="2"/><circle cx="12" cy="14.7" r="1.3"/><path d="M9 8a5 5 0 0 1 6 0M7 6a8 8 0 0 1 10 0"/>`),
  network: line(col, `<rect x="3" y="9" width="18" height="6.5" rx="1.4"/><path d="M7 15.5v2.3M12 15.5v2.3M17 15.5v2.3M7 9V6.8M12 9V6.8M17 9V6.8"/>`),
  wifi:    line(col, `<path d="M5 9.5a10 10 0 0 1 14 0M7.6 12.4a6 6 0 0 1 8.8 0M10 15.2a2.4 2.4 0 0 1 4 0"/><circle cx="12" cy="18.4" r="0.9" fill="${col}" stroke="none"/>`),
  scan:    line(col, `<rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h3v3M20.5 14.5v0M17.5 20.5h3M20.5 17.5v3"/>`),
  barrier: line(col, `<circle cx="5" cy="17.4" r="2.3"/><path d="M5 15.1V8h1.6l13 .02"/><path d="M9.2 8v.01M12 8v.01M14.8 8v.01M17.6 8v.01"/>`),
  camera:  line(col, `<rect x="3" y="7.5" width="13" height="10" rx="2"/><path d="M16 11l5-2.4v7.8L16 14z"/><circle cx="9" cy="12.5" r="2.2"/>`),
  locker:  line(col, `<rect x="4" y="3" width="16" height="18" rx="1.6"/><path d="M12 3v18M4 9h16M4 15h16"/><path d="M8.5 6h.01M8.5 12h.01M8.5 18h.01"/>`),
  ups:     line(col, `<rect x="3" y="7.5" width="15" height="9" rx="2"/><path d="M21 10.5v3"/><path d="M11 9.4l-2.2 3.1H11l-2 3.1"/>`),
  speaker: line(col, `<rect x="6.5" y="3" width="11" height="18" rx="4"/><circle cx="12" cy="9" r="2.9"/><path d="M8.5 16.5h7"/>`),
  bulb:    line(col, `<path d="M9.5 18.5h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.6.6 1 1.3 1 2.4h5.6c0-1.1.4-1.8 1-2.4A6 6 0 0 0 12 3z"/>`),
  tablet:  line(col, `<rect x="5.5" y="3" width="13" height="18" rx="2"/><path d="M11 18h2"/>`),
  monitor: line(col, `<rect x="3" y="4.5" width="18" height="11.5" rx="2"/><path d="M8.5 20.5h7M12 16v4.5"/>`),
  phone:   line(col, `<rect x="7.5" y="2.5" width="9" height="19" rx="2.4"/><path d="M11 18.5h2"/>`),
  bridge:  line(col, `<path d="M9 7.5V4M15 7.5V4M8 7.5h8v3.6a4 4 0 0 1-8 0z"/><path d="M12 15v5.5"/>`),
  route:   line(col, `<rect x="3" y="13" width="18" height="6.5" rx="1.6"/><path d="M7 16.2h.01M11 16.2h.01"/><path d="M17 13V9.5M13 9.5h8M18.5 7l2.5 2.5-2.5 2.5"/>`),
  mic:     line(col, `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>`),
  elevator:line(col, `<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 17V8M8.5 11.5 12 8l3.5 3.5"/>`),
  disc:    line(col, `<ellipse cx="12" cy="12" rx="8.6" ry="5.2"/><ellipse cx="12" cy="12" rx="4" ry="2.3"/><circle cx="12" cy="12" r="0.9" fill="${col}" stroke="none"/>`),
  display: line(col, `<rect x="4" y="3.6" width="16" height="11" rx="1.6"/><path d="M9 14.6v3.4h6v-3.4M6.5 21h11"/>`),
  dial:    line(col, `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3.2v2.1M20.8 12h-2.1M12 20.8v-2.1M3.2 12h2.1"/>`),
  cast:    line(col, `<path d="M3 6.5h18v11h-7"/><path d="M3 12a6 6 0 0 1 6 6M3 15.5a2.5 2.5 0 0 1 2.5 2.5"/><circle cx="3.3" cy="17.7" r="0.85" fill="${col}" stroke="none"/>`),
  google:  line(col, `<path d="M20.5 12.2c0-.7-.06-1.2-.2-1.8H12v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.5z"/><path d="M12 21c2.4 0 4.4-.8 5.9-2.2l-2.9-2.2c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21z"/><path d="M7 11.8a5.4 5.4 0 0 1 0-3.5V6H4a9 9 0 0 0 0 8.1z"/><path d="M12 6.6c1.3 0 2.5.45 3.4 1.3l2.5-2.5A9 9 0 0 0 4 6l3 2.3c.7-2.1 2.7-3.7 5-3.7z"/>`),
  // V3 新增
  check:    line(col, `<circle cx="12" cy="12" r="8.8"/><path d="M8 12.3l2.7 2.7L16.3 9"/>`),
  users:    line(col, `<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 6.2a3.2 3.2 0 0 1 0 6"/><path d="M17 14.5a5.5 5.5 0 0 1 3.5 5.5"/>`),
  flag:     line(col, `<path d="M5.5 21V4"/><path d="M5.5 4.8c4.2-2.4 8.2 2.2 13 .2v8.6c-4.8 2-8.8-2.6-13-.2"/>`),
  calendar: line(col, `<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3.2v3.6M16 3.2v3.6"/><path d="M8 14h.01M12 14h.01M16 14h.01"/>`),
  bell:     line(col, `<path d="M6.5 17V11a5.5 5.5 0 0 1 11 0v6"/><path d="M4.5 17h15"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>`),
  wrench:   line(col, `<path d="M15.6 4.2a5 5 0 0 0-6.1 6.7L4 16.4 7.6 20l5.5-5.5a5 5 0 0 0 6.7-6.1L16.6 11l-3.1-3.1z"/>`),
  car:      line(col, `<path d="M4 16.5v2.6h2.6v-2.6M17.4 16.5v2.6H20v-2.6"/><rect x="3" y="10.5" width="18" height="6" rx="1.6"/><path d="M5.4 10.5 7 6.2h10l1.6 4.3"/><path d="M6.6 13.5h.01M17.4 13.5h.01"/>`),
  key:      line(col, `<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3.2M15.5 12v2.4"/>`),
  money:    line(col, `<rect x="2.6" y="6" width="18.8" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 12h.01M18 12h.01"/>`),
  chat:     line(col, `<path d="M20.5 12.5c0 3.9-3.8 7-8.5 7a10 10 0 0 1-2.6-.34L4.5 21l1.2-3.4a6.6 6.6 0 0 1-2.2-5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z"/><path d="M8.5 12.4h.01M12 12.4h.01M15.5 12.4h.01"/>`),
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

// 狀態色（白話標籤：已做好 / 一定要裝 / 之後再加）
const stColor = { LIVE: C.live, CORE: C.core, OPT: C.opt };
const stName = { LIVE: "● 已做好", CORE: "● 一定要裝", OPT: "○ 之後再加" };

// 四個階段（白話命名，與《系統方案規劃書》P0–P3 對齊）
const PH = [
  { id: "1", key: "P0", name: "樣品屋開賣", when: "現在就能做・預售期",   col: C.live },
  { id: "2", key: "P1", name: "交屋前",     when: "工程期・交屋前 3 個月", col: C.core },
  { id: "3", key: "P2", name: "住戶入住",   when: "交屋・陸續入住",       col: C.opt },
  { id: "4", key: "P3", name: "住滿之後",   when: "營運上軌道再加",       col: C.goldSoft },
];

(async () => {
  const bgPlain = "image/png;base64," + (await sharp(Buffer.from(bgPlainSvg)).png().toBuffer()).toString("base64");

  // 依需要的顏色預先渲染圖示
  const ig = I("#" + C.gold), il = I("#" + C.live), ib = I("#" + C.opt), is = I("#" + C.goldSoft);
  const R = async (o) => { const m = {}; for (const k of Object.keys(o)) m[k] = await png(o[k], 176); return m; };
  const gold = await R(ig), liv = await R(il), blu = await R(ib), sof = await R(is);

  const pres = new pptxgen();
  pres.defineLayout({ name: "S169", width: 13.333, height: 7.5 });
  pres.layout = "S169";
  pres.author = "智慧住宅管理平台";
  pres.title = "智慧宅分階段導入規劃";

  // ---- 共用：頁首 ----
  const header = (s, eyebrow, title, sub, rightLines) => {
    s.addText(eyebrow, { x: 0.6, y: 0.34, w: 9, h: 0.3, fontSize: 11, color: C.gold, bold: true, charSpacing: 3, margin: 0 });
    s.addText(title, { x: 0.58, y: 0.58, w: 9.4, h: 0.62, fontSize: 26, bold: true, color: C.paper, margin: 0, fontFace: JH });
    s.addText(sub, { x: 0.6, y: 1.24, w: 9.6, h: 0.36, fontSize: 12.5, color: C.muted, margin: 0, fontFace: JH });
    if (rightLines) s.addText(rightLines, { x: 9.4, y: 0.5, w: 3.33, h: 0.9, align: "right", lineSpacingMultiple: 1.25, margin: 0, fontFace: JH });
  };
  // ---- 共用：狀態圖例（白話）----
  const legend = (s, y) => s.addText([
    { text: "● ", options: { color: C.live } }, { text: "已做好・可直接展示　", options: { color: C.capt } },
    { text: "● ", options: { color: C.core } }, { text: "建議一定要裝　", options: { color: C.capt } },
    { text: "○ ", options: { color: C.opt } }, { text: "之後想加再加", options: { color: C.capt } },
  ], { x: 5.6, y, w: 7.13, h: 0.3, fontSize: 10.5, align: "right", margin: 0, fontFace: JH });
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
  cov.addText("PHASED ROLLOUT PLAN",
    { x: 0, y: 2.98, w: 13.333, h: 0.34, fontSize: 13, color: C.gold, bold: true, charSpacing: 4, align: "center", margin: 0 });
  cov.addText("智慧宅分階段導入規劃",
    { x: 0, y: 3.42, w: 13.333, h: 0.9, fontSize: 44, bold: true, color: C.paper, align: "center", margin: 0, fontFace: JH });
  cov.addShape(pres.shapes.LINE, { x: 6.16, y: 4.52, w: 1.0, h: 0, line: { color: C.gold, width: 1.2 } });
  cov.addText("什麼時候裝什麼　·　客戶會看到什麼　·　推薦硬體配置",
    { x: 0, y: 4.7, w: 13.333, h: 0.4, fontSize: 15, color: C.capt, align: "center", margin: 0, fontFace: JH });
  cov.addText([
    { text: "樣品屋開賣　→　交屋前　→　住戶入住　→　住滿之後", options: { color: C.goldSoft, bold: true } },
  ], { x: 0, y: 5.66, w: 13.333, h: 0.4, fontSize: 12.5, align: "center", margin: 0, fontFace: JH });
  cov.addText("※ 不用一次全部做完 —— 一台平板加一顆音箱就能開賣，其他隨工程進度分批裝。本簡報不含報價。",
    { x: 0, y: 6.7, w: 13.333, h: 0.3, fontSize: 10.5, color: C.cardMute, align: "center", margin: 0, fontFace: JH });

  // ============ Slide 2 · 一頁看懂四個階段 ============
  const rd = pres.addSlide();
  rd.background = { data: bgPlain };
  header(rd, "ONE PAGE OVERVIEW", "一頁看懂：什麼時候，裝什麼",
    "四個階段跟著建案走 —— 每一段都可以單獨驗收，也可以看銷售狀況決定要不要往下走",
    [{ text: "同一套系統\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "分四批裝，不用一次到位", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);

  // 時間軸
  rd.addShape(pres.shapes.LINE, { x: 0.7, y: 2.32, w: 11.9, h: 0, line: { color: C.cardLine, width: 1.6, endArrowType: "triangle" } });
  const road = [
    { do: ["接待中心、樣品屋現場就能演", "手機 App 跟 LINE 帳號同步開通", "社區名稱、公設清單先建好"],
      hi: "客戶當場說一句話，燈就亮", hw: "平板 ×1　＋　智慧音箱 ×1" },
    { do: ["管理室設備進場、網路拉好", "住戶名冊、車位、管理費先建檔", "報修、公告、繳費開始跑"],
      hi: "交屋當天就開通，不用再等", hw: "管理室主機・網路・大螢幕" },
    { do: ["住戶開始用自己的手機", "家裡燈光冷氣可以語音控制", "大廳掃碼進出、訪客發通行碼"],
      hi: "住戶天天有感，口碑關鍵", hw: "住戶家中設備　＋　大廳掃碼機" },
    { do: ["車子開到門口自動放行", "包裹自助取件不用等管理員", "電梯自動送到你家樓層"],
      hi: "不用掏卡、不用排隊", hw: "車牌辨識・包裹櫃・電梯連動" },
  ];
  const rW = 3.0, rGap = 0.12, rx0 = 0.52;
  road.forEach((r, i) => {
    const p = PH[i];
    const cx = rx0 + i * (rW + rGap);
    const ccx = cx + rW / 2;
    // 節點
    rd.addShape(pres.shapes.OVAL, { x: ccx - 0.27, y: 2.05, w: 0.54, h: 0.54, fill: { color: p.col }, line: { color: "0b1220", width: 1.5 } });
    rd.addText(p.id, { x: ccx - 0.27, y: 2.05, w: 0.54, h: 0.54, fontSize: 15, bold: true, color: "0b1220", align: "center", valign: "middle", margin: 0 });
    // 名稱 + 時間點
    rd.addText(p.name, { x: cx, y: 2.68, w: rW, h: 0.36, fontSize: 16, bold: true, color: C.paper, align: "center", margin: 0, fontFace: JH });
    rd.addText(p.when, { x: cx, y: 3.04, w: rW, h: 0.28, fontSize: 10.5, bold: true, color: p.col, align: "center", charSpacing: 1, margin: 0, fontFace: JH });
    // 內容卡
    const cy = 3.42, ch = 3.12;
    card(rd, cx, cy, rW, ch, i === 0 ? { fill: "13241d", tr: 10, line: C.live, ltr: 40, lw: 1 } : {});
    rd.addText("這階段做什麼", { x: cx + 0.24, y: cy + 0.14, w: rW - 0.48, h: 0.26, fontSize: 10, bold: true, color: C.cardMute, charSpacing: 2, margin: 0, fontFace: JH });
    rd.addText(r.do.map((t) => ({ text: t, options: { color: C.capt, fontSize: 10.5, bullet: { code: "2022", indent: 12 }, paraSpaceAfter: 6 } })),
      { x: cx + 0.22, y: cy + 0.42, w: rW - 0.42, h: 1.42, valign: "top", margin: 0, fontFace: JH, lineSpacingMultiple: 1.05 });
    // 亮點
    rd.addShape(pres.shapes.LINE, { x: cx + 0.24, y: cy + 1.9, w: rW - 0.48, h: 0, line: { color: p.col, width: 0.6, dashType: "dash", transparency: 40 } });
    rd.addText([{ text: "客戶感受　", options: { color: C.cardMute, fontSize: 9.5 } }, { text: r.hi, options: { color: p.col, fontSize: 11, bold: true } }],
      { x: cx + 0.24, y: cy + 1.98, w: rW - 0.48, h: 0.6, valign: "top", margin: 0, fontFace: JH, lineSpacingMultiple: 1.05 });
    // 硬體一行
    rd.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx + 0.18, y: cy + ch - 0.58, w: rW - 0.36, h: 0.44, rectRadius: 0.07,
      fill: { color: "0e1a30", transparency: 10 }, line: { color: p.col, width: 0.6, transparency: 45 } });
    rd.addText([{ text: "要裝　", options: { color: C.cardMute, fontSize: 8.5 } }, { text: r.hw, options: { color: C.goldSoft, fontSize: 9.5, bold: true } }],
      { x: cx + 0.18, y: cy + ch - 0.58, w: rW - 0.36, h: 0.44, align: "center", valign: "middle", margin: 0, fontFace: JH, lineSpacingMultiple: 1.0 });
  });
  rd.addText("※ 第 1 階段幾乎不用花硬體錢，先把「賣點」做出來；真正的社區設備從第 2 階段隨工程進場，第 4 階段全部是選配。",
    { x: 0.62, y: 6.74, w: 12.1, h: 0.3, fontSize: 10, italic: true, color: C.cardMute, margin: 0, fontFace: JH });
  footer(rd, "分階段導入規劃 ── 一頁看懂", "先軟體後硬體　·　每階段獨立驗收");

  // ============ Slide 3–6 · 各階段明細（共用版型）============
  //  左：客戶／住戶會看到什麼（帶圖示）　右：這階段要裝的東西
  const phaseSlide = (pi, eyebrow, sub, feels, buys, note) => {
    const p = PH[pi];
    const s = pres.addSlide();
    s.background = { data: bgPlain };
    header(s, eyebrow, `階段 ${p.id}　${p.name}`, sub,
      [{ text: "時間點\n", options: { color: C.muted, fontSize: 11.5 } },
       { text: p.when, options: { color: p.col, fontSize: 13, bold: true } }]);
    legend(s, 1.28);

    const ly = 1.72, lh = 4.78;

    // ---- 左：客戶感受 ----
    const lw2 = 6.75;
    card(s, 0.5, ly, lw2, lh);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: ly, w: 0.09, h: lh, rectRadius: 0.04, fill: { color: p.col }, line: { type: "none" } });
    s.addText("客戶／住戶會看到什麼", { x: 0.78, y: ly + 0.14, w: lw2 - 0.5, h: 0.3, fontSize: 12, bold: true, color: p.col, charSpacing: 2, margin: 0, fontFace: JH });
    const fRowH = (lh - 0.66) / feels.length;
    feels.forEach((f, k) => {
      const ry = ly + 0.58 + k * fRowH;
      s.addShape(pres.shapes.OVAL, { x: 0.82, y: ry + 0.06, w: 0.6, h: 0.6, fill: { color: "0f1c33" }, line: { color: p.col, width: 0.85, transparency: 35 } });
      s.addImage({ data: f.ic, x: 0.95, y: ry + 0.19, w: 0.34, h: 0.34 });
      s.addText(f.t, { x: 1.6, y: ry + 0.04, w: lw2 - 1.32, h: 0.32, fontSize: 13.5, bold: true, color: C.paper, valign: "middle", margin: 0, fontFace: JH });
      s.addText(f.s, { x: 1.6, y: ry + 0.38, w: lw2 - 1.34, h: fRowH - 0.44, fontSize: 10.5, color: C.capt, margin: 0, fontFace: JH, lineSpacingMultiple: 1.1, valign: "top" });
    });

    // ---- 右：要裝的東西 ----
    const rx = 7.42, rw2 = 5.41;
    card(s, rx, ly, rw2, lh, { fill: C.band, tr: 12 });
    s.addText("這階段要裝的東西", { x: rx + 0.28, y: ly + 0.14, w: rw2 - 0.56, h: 0.3, fontSize: 12, bold: true, color: C.goldSoft, charSpacing: 2, margin: 0, fontFace: JH });
    const noteH = 0.52;
    const bRowH = (lh - 0.62 - noteH - 0.14) / buys.length;
    buys.forEach((b, k) => {
      const ry = ly + 0.54 + k * bRowH;
      s.addText([dot(b.st), { text: b.n, options: { color: C.paper, bold: true, fontSize: 11.5 } }],
        { x: rx + 0.28, y: ry, w: rw2 - 1.55, h: 0.26, valign: "middle", margin: 0, fontFace: JH });
      s.addText(b.q, { x: rx + rw2 - 1.32, y: ry, w: 1.04, h: 0.26, fontSize: 10, bold: true, color: p.col, align: "right", valign: "middle", margin: 0, fontFace: JH });
      s.addText(b.s, { x: rx + 0.5, y: ry + 0.27, w: rw2 - 0.8, h: bRowH - 0.3, fontSize: 9.6, color: C.capt, margin: 0, fontFace: JH, lineSpacingMultiple: 1.04, valign: "top" });
    });
    // 右卡底部提醒
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx + 0.24, y: ly + lh - noteH - 0.1, w: rw2 - 0.48, h: noteH, rectRadius: 0.07,
      fill: { color: "0e1a30", transparency: 10 }, line: { color: p.col, width: 0.6, transparency: 45 } });
    s.addText(note, { x: rx + 0.3, y: ly + lh - noteH - 0.1, w: rw2 - 0.6, h: noteH, fontSize: 9.5, bold: true, color: C.goldSoft, align: "center", valign: "middle", margin: 0, fontFace: JH, lineSpacingMultiple: 1.02 });

    footer(s, `分階段導入規劃 ── 階段 ${p.id}　${p.name}`, `階段 1 → 2 → 3 → 4　　目前：階段 ${p.id}`);
  };

  // ---- 階段 1 · 樣品屋開賣 ----
  phaseSlide(0, "STAGE 1 · SHOW UNIT",
    "先把賣點做出來 —— 一台平板加一顆音箱，接待中心就能演完整套智慧宅",
    [
      { ic: liv.mic,      t: "說一句話就訂到公設", s: "對平板說「幫我訂週六下午的健身房」，系統當場排好時段，管理室同時收到通知 —— 客戶親眼看到「說完就成立」。" },
      { ic: liv.bulb,     t: "說一句話就開燈開冷氣", s: "對音箱說「打開客廳燈」「冷氣調到 26 度」，樣品屋燈光、空調、窗簾當場動起來。" },
      { ic: liv.phone,    t: "客戶用自己的手機就能試", s: "現場掃碼下載 App，不用另外準備設備，客戶回家路上還能繼續看。" },
      { ic: liv.chat,     t: "加 LINE 就收得到社區訊息", s: "公告、包裹到件都推到 LINE —— 長輩最熟悉的介面，不用學新東西。" },
    ],
    [
      { st: "CORE", n: "接待中心平板",     q: "1 台",  s: "放櫃檯，用來演「說一句話訂公設、自動派工」。10 吋以上即可。" },
      { st: "CORE", n: "智慧音箱",         q: "1 顆",  s: "Google 原廠，語音開關燈光、冷氣、窗簾。" },
      { st: "OPT",  n: "示範用小主機＋燈光冷氣", q: "1 式", s: "讓樣品屋真的亮起來；預算有限時也可以只用螢幕模擬。" },
      { st: "LIVE", n: "雲端服務",         q: "免費層", s: "系統跑在雲端，這階段不用自己買主機。" },
    ],
    "這階段幾乎不用花硬體錢\n一台平板 ＋ 一顆音箱就能開賣");

  // ---- 階段 2 · 交屋前 ----
  phaseSlide(1, "STAGE 2 · BEFORE HANDOVER",
    "管理室設備進場 —— 住戶資料先建好，交屋當天 App 就能用，不用再等",
    [
      { ic: gold.key,      t: "交屋當天 App 直接開通", s: "住戶名冊、車位、管理費規則事先建好，交屋現場掃碼就登入 —— 交屋日就是體驗日。" },
      { ic: gold.monitor,  t: "管理室一個螢幕看全社區", s: "報修、包裹、公設預約、繳費狀況都在同一頁，不用再翻好幾本簿子。" },
      { ic: gold.wrench,   t: "住戶報修不用打電話", s: "App 拍照上傳，工單自動派給廠商，修到哪裡住戶自己看得到，客訴少一半。" },
      { ic: gold.bell,     t: "公告發一次，三個地方收得到", s: "App 推播、LINE、簡訊同時送出，不會有人說「我沒收到」。" },
    ],
    [
      { st: "CORE", n: "管理室小主機",   q: "1 台",   s: "社區的大腦，放管理室，之後所有設備的指令都從這裡送出去。" },
      { st: "CORE", n: "不斷電電池",     q: "1 台",   s: "停電時系統不會關機，門禁照常運作。" },
      { st: "CORE", n: "社區網路主機",   q: "1 台",   s: "把住戶、監控、管理三種網路分開走，比較安全也不會互相卡。" },
      { st: "CORE", n: "網路集線器",     q: "1–2 台", s: "一條網路線同時送資料跟電；之後接掃碼機、攝影機不用再拉電源。" },
      { st: "CORE", n: "管理室大螢幕",   q: "1 台",   s: "一體機，或用電視接瀏覽器也可以。" },
      { st: "CORE", n: "櫃檯平板",       q: "1 台",   s: "櫃檯人員日常收發、登記用。" },
    ],
    "機房位置與管線請在工程期一起預留\n之後就不用再敲牆");

  // ---- 階段 3 · 住戶入住 ----
  phaseSlide(2, "STAGE 3 · RESIDENTS MOVE IN",
    "住戶最有感的一段 —— 手機、語音、掃碼進出，全部在這階段開起來",
    [
      { ic: blu.phone,    t: "回家路上先把冷氣打開", s: "手機按一下，進門就是舒服的溫度 —— 這是客戶最容易記住的一個畫面。" },
      { ic: blu.speaker,  t: "在家說一句話就好", s: "「我要睡了」，燈自動關、窗簾拉上；不想說話也可以用房間的小螢幕點。" },
      { ic: blu.scan,     t: "大廳掃碼就進門", s: "手機出示 QR 就開門；訪客可以發臨時通行碼，時間到自動失效。" },
      { ic: blu.locker,   t: "包裹到了手機馬上通知", s: "誰簽收、放在哪一格都查得到，管理員不用再一直打電話。" },
    ],
    [
      { st: "LIVE", n: "住戶家中設備組", q: "每戶 1 式", s: "燈光、冷氣、窗簾的控制模組，裝在住戶家裡。" },
      { st: "LIVE", n: "住戶音箱／小螢幕", q: "每戶 1", s: "Google 原廠，說話就能控制，也可以觸控操作。" },
      { st: "OPT",  n: "大廳掃碼機",     q: "出入口 ×2", s: "手機出示 QR 就開門。通行碼功能已經做好，接上就能用。" },
      { st: "CORE", n: "全區無線網路",   q: "1 組",     s: "公設走到哪都不斷訊，健身房、交誼廳都收得到。" },
      { st: "OPT",  n: "設備轉接盒",     q: "1 式",     s: "讓不同廠牌的燈光、空調設備都能連上同一套系統。" },
    ],
    "住戶口碑就決定在這一階段\n建議至少做到這裡");

  // ---- 階段 4 · 住滿之後 ----
  phaseSlide(3, "STAGE 4 · AFTER FULL OCCUPANCY",
    "全部是選配 —— 營運上軌道之後，想加哪一項就加哪一項，不用一次到位",
    [
      { ic: sof.car,      t: "車子開到門口自動放行", s: "認車牌，不用停車拿卡、不用降車窗 —— 下雨天最有感。" },
      { ic: sof.locker,   t: "包裹自己取，不用等管理員", s: "手機收到取件碼，掃碼開櫃，半夜回家也拿得到。" },
      { ic: sof.elevator, t: "刷完卡電梯自動到你家樓層", s: "不用再按樓層，也順便擋掉不該上樓的人。" },
      { ic: sof.display,  t: "大廳大螢幕迎賓", s: "顯示社區公告、活動、訪客歡迎詞，公設質感再提一級。" },
    ],
    [
      { st: "OPT", n: "車牌辨識柵欄",     q: "車道 ×1", s: "認車牌自動開柵欄，住戶車不用停。" },
      { st: "OPT", n: "智能包裹櫃",       q: "1 組",   s: "20–40 格，掃碼取件，管理員不用代收。" },
      { st: "OPT", n: "電梯連動控制器",   q: "每梯 ×1", s: "刷卡後自動送到住戶樓層。" },
      { st: "OPT", n: "大廳資訊大螢幕",   q: "1 台",   s: "公設迎賓、活動看板。" },
      { st: "OPT", n: "語音服務搬回社區", q: "1 式",   s: "對話資料留在自己手上，系統也多一層備援。" },
    ],
    "全部選配，可以一項一項加\n不影響前三階段已經在用的功能");

  // ============ Slide 7 · 住戶最有感的六個功能 ============
  const fz = pres.addSlide();
  fz.background = { data: bgPlain };
  header(fz, "WHAT RESIDENTS ACTUALLY USE", "住戶最有感的六個功能",
    "介紹時講這六個就夠 —— 每一個都可以現場演，右下角是客戶通常會有的反應",
    [{ text: "現場話術\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "六個功能・全部已做好", options: { color: C.live, fontSize: 12, bold: true } }]);

  const feats = [
    { ic: liv.mic,      t: "一句話訂公設",   s: "「幫我訂週六下午的健身房」——\n說完就訂好，管理室同步收到。", say: "「這個真的假的？」" },
    { ic: liv.bulb,     t: "語音開燈開冷氣", s: "「我回來了」——\n燈亮、冷氣開、窗簾拉開。", say: "「阿嬤也會用」" },
    { ic: liv.locker,   t: "包裹到件通知",   s: "包裹一登記，手機跟 LINE 馬上通知，\n誰領走的都有紀錄。", say: "「不用再一直問管理員」" },
    { ic: liv.wrench,   t: "手機報修看進度", s: "拍照上傳就派工，\n師傅到哪一步住戶自己看得到。", say: "「不用再追著問」" },
    { ic: liv.money,    t: "管理費線上繳",   s: "帳單、繳費紀錄一次看清楚，\n催繳系統自動發。", say: "「省掉一堆紙本」" },
    { ic: liv.scan,     t: "手機開門・訪客碼", s: "手機出示 QR 進門；\n訪客發臨時碼，時間到自動失效。", say: "「不用再跑下樓開門」" },
  ];
  const fx0 = 0.5, fy0 = 1.78, fw = 4.05, fh = 2.32, fgx = 0.19, fgy = 0.2;
  feats.forEach((f, i) => {
    const cx = fx0 + (i % 3) * (fw + fgx);
    const cy = fy0 + Math.floor(i / 3) * (fh + fgy);
    fz.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: fw, h: fh, rectRadius: 0.11,
      fill: { color: "13241d", transparency: 10 }, line: { color: C.live, width: 1, transparency: 42 },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.3 } });
    fz.addShape(pres.shapes.OVAL, { x: cx + 0.26, y: cy + 0.24, w: 0.72, h: 0.72, fill: { color: "0f1c33" }, line: { color: C.live, width: 0.9, transparency: 30 } });
    fz.addImage({ data: f.ic, x: cx + 0.44, y: cy + 0.42, w: 0.36, h: 0.36 });
    fz.addText(f.t, { x: cx + 1.12, y: cy + 0.3, w: fw - 1.3, h: 0.6, fontSize: 15, bold: true, color: C.paper, valign: "middle", margin: 0, fontFace: JH });
    fz.addShape(pres.shapes.LINE, { x: cx + 0.28, y: cy + 1.12, w: fw - 0.56, h: 0, line: { color: C.gold, width: 0.5, dashType: "dash", transparency: 55 } });
    fz.addText(f.s, { x: cx + 0.3, y: cy + 1.2, w: fw - 0.6, h: 0.6, fontSize: 10.5, color: C.capt, margin: 0, fontFace: JH, lineSpacingMultiple: 1.1, valign: "top" });
    fz.addText(f.say, { x: cx + 0.3, y: cy + fh - 0.5, w: fw - 0.6, h: 0.36, fontSize: 10.5, italic: true, bold: true, color: C.goldSoft, align: "right", valign: "middle", margin: 0, fontFace: JH });
  });
  fz.addText("※ 以上六項功能系統都已經做好，接待中心現場就能演；掃碼進門的功能已完成，只差大廳的掃碼機（第 3 階段）。",
    { x: 0.5, y: 6.74, w: 12.33, h: 0.3, fontSize: 10, italic: true, color: C.cardMute, margin: 0, fontFace: JH });
  footer(fz, "分階段導入規劃 ── 住戶最有感的六個功能", "全部已上線　·　現場可實演");

  // ============ Slide 8 · 用的是 Google 原廠設備 ============
  const ng = pres.addSlide();
  ng.background = { data: bgPlain };
  header(ng, "GOOGLE NEST", "用的是 Google 原廠設備，不是雜牌",
    "國際大廠品質，走 Google 官方認證的串接方式 —— 語音控制家電的部分已經完成整合",
    [{ text: "國際品牌背書\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "Google Nest 全系列", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);

  const hbY = 1.72, hbH = 0.96;
  ng.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: hbY, w: 12.33, h: hbH, rectRadius: 0.1,
    fill: { color: "10241d", transparency: 8 }, line: { color: C.live, width: 1, transparency: 30 },
    shadow: { type: "outer", color: "000000", blur: 7, offset: 2, angle: 90, opacity: 0.28 } });
  ng.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: hbY, w: 0.09, h: hbH, rectRadius: 0.04, fill: { color: C.live }, line: { type: "none" } });
  ng.addShape(pres.shapes.OVAL, { x: 0.8, y: hbY + hbH / 2 - 0.31, w: 0.62, h: 0.62, fill: { color: "0f1c33" }, line: { color: C.live, width: 0.9, transparency: 30 } });
  ng.addImage({ data: liv.google, x: 0.95, y: hbY + hbH / 2 - 0.16, w: 0.32, h: 0.32 });
  ng.addText([
    { text: "● 已做好　", options: { color: C.live, bold: true, fontSize: 13 } },
    { text: "說一句話，家裡的燈光、冷氣、窗簾就會動", options: { color: C.paper, bold: true, fontSize: 13 } },
  ], { x: 1.62, y: hbY + 0.14, w: 8.6, h: 0.34, valign: "middle", margin: 0, fontFace: JH });
  ng.addText("走的是 Google 官方認證的串接方式，不是自己接的偏方 —— 系統穩定度與後續更新有原廠保障",
    { x: 1.62, y: hbY + 0.5, w: 8.9, h: 0.32, color: C.capt, fontSize: 11, valign: "middle", margin: 0, fontFace: JH });
  ng.addText([{ text: "音箱負責「控制家電」\n", options: { color: C.goldSoft, fontSize: 10, bold: true } },
              { text: "訂公設用平板或手機 App", options: { color: C.cardMute, fontSize: 9.5 } }],
    { x: 10.5, y: hbY + 0.15, w: 2.25, h: 0.66, align: "right", valign: "middle", margin: 0, fontFace: JH, lineSpacingMultiple: 1.05 });

  const nest = [
    { ic: liv.speaker, st: "LIVE", n: "Google 智慧音箱", tag: "階段 1 就用得到", s: "一顆放客廳就有感。說話開關燈光、冷氣、窗簾，樣品屋現場最好演的一項。" },
    { ic: liv.display, st: "LIVE", n: "Google 小螢幕",   tag: "階段 3 住戶配發", s: "7 吋觸控加語音，不想說話就用點的；長輩看得到畫面比較安心。" },
    { ic: gold.wifi,   st: "CORE", n: "Google 無線網路", tag: "階段 3 全區覆蓋", s: "公設走到哪都不斷訊，健身房、交誼廳、地下室都收得到。" },
    { ic: blu.camera,  st: "OPT",  n: "門口攝影機／大螢幕", tag: "階段 4 選配", s: "影像門鈴、大廳迎賓看板；想再加質感時才需要。" },
  ];
  const nx0 = 0.5, ny0 = 3.14, nw = 2.94, nh = 2.94, ngx = 0.19;
  nest.forEach((d, i) => {
    const cx = nx0 + i * (nw + ngx);
    const emph = d.st === "LIVE";
    ng.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: ny0, w: nw, h: nh, rectRadius: 0.11,
      fill: { color: emph ? "13241d" : C.cardFill, transparency: emph ? 10 : 20 },
      line: { color: emph ? C.live : C.gold, width: emph ? 1 : 0.75, transparency: emph ? 40 : 58 },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.3 } });
    ng.addShape(pres.shapes.OVAL, { x: cx + nw / 2 - 0.42, y: ny0 + 0.3, w: 0.84, h: 0.84, fill: { color: "0f1c33" }, line: { color: stColor[d.st], width: 0.9, transparency: 30 } });
    ng.addImage({ data: d.ic, x: cx + nw / 2 - 0.21, y: ny0 + 0.51, w: 0.42, h: 0.42 });
    ng.addText([dot(d.st), { text: d.n, options: { color: C.paper, bold: true, fontSize: 13 } }],
      { x: cx + 0.2, y: ny0 + 1.28, w: nw - 0.4, h: 0.34, align: "center", valign: "middle", margin: 0, fontFace: JH });
    ng.addText(d.tag, { x: cx + 0.2, y: ny0 + 1.62, w: nw - 0.4, h: 0.28, color: stColor[d.st], bold: true, fontSize: 10, align: "center", charSpacing: 1, margin: 0, fontFace: JH });
    ng.addShape(pres.shapes.LINE, { x: cx + 0.7, y: ny0 + 1.98, w: nw - 1.4, h: 0, line: { color: C.gold, width: 0.5, dashType: "dash", transparency: 55 } });
    ng.addText(d.s, { x: cx + 0.3, y: ny0 + 2.1, w: nw - 0.6, h: nh - 2.24, color: C.capt, fontSize: 10, margin: 0, fontFace: JH, lineSpacingMultiple: 1.1, valign: "top" });
  });
  ng.addText("※ 音箱能控制家裡的設備，但「訂公設、報修」這類社區服務是我們平台自己做的語音功能，用平板或手機 App 操作。",
    { x: 0.5, y: 6.74, w: 12.33, h: 0.3, fontSize: 10, italic: true, color: C.cardMute, margin: 0, fontFace: JH });
  legend(ng, 1.28);
  footer(ng, "分階段導入規劃 ── Google 原廠設備", "原廠認證串接　·　國際級硬體品質");

  // ============ Slide 9 · 硬體總表（白話版）============
  const g = pres.addSlide();
  g.background = { data: bgPlain };
  header(g, "HARDWARE CHECKLIST", "硬體總表：一張表看完四個階段要裝什麼",
    "一行一項，直接對照階段；數量以單棟社區為基準，實際依建案規模在報價階段確認",
    [{ text: "完整品項\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "四階段 · 20 項", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);
  legend(g, 1.28);

  const PHC = { "1": C.live, "2": C.core, "3": C.opt, "4": C.goldSoft };
  const bom = [
    ["1", "接待中心平板",       "演「說一句話訂公設 → 自動派工」，10 吋以上",            "1 台",      "CORE"],
    ["1", "智慧音箱",           "說話開關燈光、冷氣、窗簾（Google 原廠）",                "1 顆",      "CORE"],
    ["1", "示範用小主機＋情境設備", "讓樣品屋真的亮起來；預算有限也可只用螢幕模擬",       "1 式",      "OPT"],
    ["1", "雲端服務",           "系統跑在雲端，這階段免費方案就夠",                       "—",         "LIVE"],
    ["2", "管理室小主機",       "社區的大腦，所有設備指令從這裡送出去",                   "1 台",      "CORE"],
    ["2", "不斷電電池",         "停電時系統不關機，門禁照常運作",                         "1 台",      "CORE"],
    ["2", "社區網路主機",       "住戶／監控／管理三種網路分開走，安全也不互相卡",         "1 台",      "CORE"],
    ["2", "網路集線器",         "一條線同時送資料跟電，之後接掃碼機、攝影機免拉電源",     "1–2 台",    "CORE"],
    ["2", "管理室大螢幕",       "全社區狀況一頁看完；一體機或電視接瀏覽器皆可",           "1 台",      "CORE"],
    ["2", "櫃檯平板",           "櫃檯人員日常收發、登記",                                 "1 台",      "CORE"],
    ["2", "雲端方案升級",       "轉成正式營運等級，資料保存更穩",                         "—",         "LIVE"],
    ["3", "住戶家中設備組",     "燈光、冷氣、窗簾的控制模組",                             "每戶 1 式", "LIVE"],
    ["3", "住戶音箱／小螢幕",   "說話就能控制，也可以觸控操作",                           "每戶 1",    "LIVE"],
    ["3", "大廳掃碼機",         "手機出示 QR 就開門；通行碼功能已做好，接上就能用",       "出入口 ×2", "OPT"],
    ["3", "全區無線網路",       "公設走到哪都不斷訊",                                     "1 組",      "CORE"],
    ["3", "設備轉接盒",         "讓不同廠牌的燈光、空調都能連上同一套系統",               "1 式",      "OPT"],
    ["4", "車牌辨識柵欄",       "認車牌自動放行，住戶車不用停",                           "車道 ×1",   "OPT"],
    ["4", "智能包裹櫃",         "20–40 格，掃碼取件，管理員不用代收",                     "1 組",      "OPT"],
    ["4", "電梯連動控制器",     "刷卡後電梯自動送到住戶樓層",                             "每梯 ×1",   "OPT"],
    ["4", "語音服務搬回社區",   "對話資料留在自己手上，系統多一層備援",                   "1 式",      "OPT"],
  ];
  const thOpt = { bold: true, color: C.gold, fontSize: 9.8, fill: { color: "0e1a30" }, valign: "middle", fontFace: JH, border: { type: "solid", color: "2a3c5c", pt: 0.5 } };
  const rows = [[
    { text: "階段", options: { ...thOpt, align: "center" } },
    { text: "要裝什麼", options: thOpt },
    { text: "這東西是做什麼的", options: thOpt },
    { text: "數量", options: { ...thOpt, align: "center" } },
    { text: "狀態", options: thOpt },
  ]];
  bom.forEach((r, i) => {
    const [ph, item, use, qty, st] = r;
    const zebra = i % 2 === 0 ? "12203a" : "0f1b31";
    const td = (text, extra = {}) => ({ text, options: { color: C.capt, fontSize: 9.5, fill: { color: zebra }, valign: "middle", fontFace: JH, border: { type: "solid", color: "22334f", pt: 0.5 }, ...extra } });
    rows.push([
      td(ph, { color: PHC[ph], bold: true, align: "center", fontSize: 10.5 }),
      td(item, { color: C.paper, bold: true }),
      td(use),
      td(qty, { align: "center", fontSize: 9 }),
      td(stName[st], { color: stColor[st], fontSize: 9 }),
    ]);
  });
  g.addTable(rows, {
    x: 0.5, y: 1.66, w: 12.33,
    colW: [0.72, 2.7, 6.16, 1.15, 1.6],
    rowH: 0.24,
    margin: [0.02, 0.06, 0.02, 0.06],
  });
  g.addText("※ 本表不含報價；詳細型號與規格另附工務版清單。設備都是走標準方式接入，單項可以獨立更換或沿用建商既有供應商。",
    { x: 0.5, y: 6.86, w: 12.33, h: 0.28, fontSize: 9.5, italic: true, color: C.cardMute, margin: 0, fontFace: JH });
  footer(g, "分階段導入規劃 ── 硬體總表", "階段 1 綠 · 2 金 · 3 藍 · 4 淺金");

  await pres.writeFile({ fileName: "../推薦硬體配置清單.pptx" });
  console.log("written ../推薦硬體配置清單.pptx (9 slides)");
})();
