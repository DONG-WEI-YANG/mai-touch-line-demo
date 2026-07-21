/* 推薦硬體配置清單 → ../推薦硬體配置清單.pptx
   延續「應用場景」深藍×金的高級住宅風格。內容依實際程式碼整合現況分級。 */
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

// 狀態色
const stColor = { LIVE: C.live, CORE: C.core, OPT: C.opt };

(async () => {
  const bgPlain = "image/png;base64," + (await sharp(Buffer.from(bgPlainSvg)).png().toBuffer()).toString("base64");

  // 依需要的顏色預先渲染圖示
  const ig = I("#" + C.gold), il = I("#" + C.live), ib = I("#" + C.opt), ip = I("#" + C.paper);
  const R = async (o) => { const m = {}; for (const k of Object.keys(o)) m[k] = await png(o[k], 176); return m; };
  const gold = await R(ig), liv = await R(il), blu = await R(ib), pap = await R(ip);

  const pres = new pptxgen();
  pres.defineLayout({ name: "S169", width: 13.333, height: 7.5 });
  pres.layout = "S169";
  pres.author = "智慧住宅管理平台";
  pres.title = "推薦硬體配置清單";

  // ---- 共用：頁首 ----
  const header = (s, eyebrow, title, sub, rightLines) => {
    s.addText(eyebrow, { x: 0.6, y: 0.34, w: 9, h: 0.3, fontSize: 11, color: C.gold, bold: true, charSpacing: 3, margin: 0 });
    s.addText(title, { x: 0.58, y: 0.58, w: 9.4, h: 0.62, fontSize: 26, bold: true, color: C.paper, margin: 0, fontFace: JH });
    s.addText(sub, { x: 0.6, y: 1.24, w: 9.6, h: 0.36, fontSize: 12.5, color: C.muted, margin: 0 });
    if (rightLines) s.addText(rightLines, { x: 9.4, y: 0.5, w: 3.33, h: 0.9, align: "right", lineSpacingMultiple: 1.25, margin: 0 });
  };
  // ---- 共用：狀態圖例 ----
  const legend = (s, y) => s.addText([
    { text: "● ", options: { color: C.live } }, { text: "已整合上線　", options: { color: C.capt } },
    { text: "● ", options: { color: C.core } }, { text: "建議必備　", options: { color: C.capt } },
    { text: "○ ", options: { color: C.opt } }, { text: "選配・待接", options: { color: C.capt } },
  ], { x: 6.0, y, w: 6.73, h: 0.3, fontSize: 10.5, align: "right", margin: 0 });
  const footer = (s, l, r) => {
    s.addText(l, { x: 0.6, y: 7.12, w: 6, h: 0.3, fontSize: 10.5, color: C.cardMute, margin: 0 });
    s.addText(r, { x: 6.0, y: 7.12, w: 6.73, h: 0.3, fontSize: 10.5, color: C.cardMute, align: "right", margin: 0 });
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
  cov.addImage({ data: gold.hub, x: 6.06, y: 1.42, w: 1.2, h: 1.2 });
  cov.addText("RECOMMENDED HARDWARE CONFIGURATION",
    { x: 0, y: 2.98, w: 13.333, h: 0.34, fontSize: 13, color: C.gold, bold: true, charSpacing: 4, align: "center", margin: 0 });
  cov.addText("推薦硬體配置清單",
    { x: 0, y: 3.42, w: 13.333, h: 0.9, fontSize: 44, bold: true, color: C.paper, align: "center", margin: 0, fontFace: JH });
  cov.addShape(pres.shapes.LINE, { x: 6.16, y: 4.52, w: 1.0, h: 0, line: { color: C.gold, width: 1.2 } });
  cov.addText("高級住宅・智慧管理平台　｜　從雲端到終端，分階段配齊",
    { x: 0, y: 4.7, w: 13.333, h: 0.4, fontSize: 15, color: C.capt, align: "center", margin: 0, fontFace: JH });
  cov.addText([
    { text: "邊緣閘道 × 網路基礎 × 公設門禁 × 住戶智慧 × 管理終端 × 雲端服務", options: { color: C.goldSoft, bold: true } },
  ], { x: 0, y: 5.66, w: 13.333, h: 0.4, fontSize: 12.5, align: "center", margin: 0, fontFace: JH });
  cov.addText("※ 配置分級對應實際程式整合現況：已整合上線 · 建議必備 · 選配待接",
    { x: 0, y: 6.7, w: 13.333, h: 0.3, fontSize: 10.5, color: C.cardMute, align: "center", margin: 0, fontFace: JH });

  // ============ Slide 2 · 硬體架構總覽（5 層）============
  const a = pres.addSlide();
  a.background = { data: bgPlain };
  header(a, "SYSTEM HARDWARE ARCHITECTURE", "五層硬體架構：從雲端指令到終端執行",
    "App 不直接對接設備 —— 指令經『邊緣閘道』下發，設備狀態逐層回報",
    [{ text: "建商級住宅管理平台\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "雲 → 端 · 分層解耦", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);

  const bands = [
    { ic: gold.cloud,   t: "雲端與服務層", en: "Cloud & Services", ex: "Render 後端 · Vercel Web · LINE OA · Twilio SMS · Gemini · FastAPI NLP", st: "LIVE" },
    { ic: gold.tablet,  t: "管理終端層",   en: "Terminals",       ex: "物業櫃檯平板 · 管理中心 Web Kiosk · 住戶手機 App", st: "LIVE" },
    { ic: gold.network, t: "社區網路層",   en: "Network",         ex: "路由 / 防火牆(VLAN) · PoE 交換器 · Wi-Fi 6E(Nest Wifi Pro)", st: "CORE" },
    { ic: gold.hub,     t: "邊緣閘道層",   en: "Edge Gateway",    ex: "工控閘道主機 · HTTP(已通) / MQTT · Modbus 橋接 · UPS", st: "CORE" },
    { ic: gold.bulb,    t: "設備層",       en: "Devices",         ex: "光/空調/窗簾/安防 · Nest 音箱/顯示器 · 門禁/電梯/柵欄/包裹櫃", st: "OPT" },
  ];
  const bY = 1.78, bH = 0.9, bGap = 0.14, bx = 0.62, bw = 11.05;
  bands.forEach((b, i) => {
    const y = bY + i * (bH + bGap);
    a.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y, w: bw, h: bH, rectRadius: 0.1,
      fill: { color: C.band, transparency: 12 }, line: { color: C.gold, width: 0.75, transparency: 55 },
      shadow: { type: "outer", color: "000000", blur: 7, offset: 2, angle: 90, opacity: 0.28 } });
    // 狀態色條
    a.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y, w: 0.09, h: bH, rectRadius: 0.04, fill: { color: stColor[b.st] }, line: { type: "none" } });
    // 圖示圈
    a.addShape(pres.shapes.OVAL, { x: bx + 0.28, y: y + bH / 2 - 0.31, w: 0.62, h: 0.62,
      fill: { color: "0f1c33" }, line: { color: C.gold, width: 0.75, transparency: 40 } });
    a.addImage({ data: b.ic, x: bx + 0.42, y: y + bH / 2 - 0.17, w: 0.34, h: 0.34 });
    // 層名
    a.addText([
      { text: b.t + "  ", options: { fontSize: 15, bold: true, color: C.paper } },
      { text: b.en, options: { fontSize: 10, color: C.cardMute } },
    ], { x: bx + 1.1, y, w: 3.0, h: bH, valign: "middle", margin: 0, fontFace: JH });
    // 範例
    a.addText(b.ex, { x: bx + 4.05, y, w: bw - 4.2, h: bH, fontSize: 11, color: C.capt, valign: "middle", margin: 0, fontFace: JH, lineSpacingMultiple: 1.05 });
    // 層間箭頭
    if (i < bands.length - 1)
      a.addText("↓", { x: bx + 0.59 - 0.12, y: y + bH - 0.04, w: 0.24, h: bGap + 0.08, fontSize: 12, color: C.gold, align: "center", valign: "middle", margin: 0 });
  });
  // 右側流向軸
  const axX = 12.05;
  a.addShape(pres.shapes.LINE, { x: axX, y: bY + 0.2, w: 0, h: bH * 5 + bGap * 4 - 0.4, line: { color: C.cardLine, width: 1.4, dashType: "dash", endArrowType: "triangle", beginArrowType: "triangle" } });
  a.addText("指令\n下行", { x: axX + 0.06, y: bY + 0.25, w: 0.85, h: 0.7, fontSize: 10.5, bold: true, color: C.goldSoft, align: "center", margin: 0, fontFace: JH, lineSpacingMultiple: 1.0 });
  a.addText("狀態\n回報", { x: axX + 0.06, y: bY + bH * 5 + bGap * 4 - 0.95, w: 0.85, h: 0.7, fontSize: 10.5, bold: true, color: C.opt, align: "center", margin: 0, fontFace: JH, lineSpacingMultiple: 1.0 });

  legend(a, 1.28);
  footer(a, "推薦硬體配置清單 ── 五層硬體架構", "分層解耦：任一層可獨立擴充或替換");

  // ============ Slide 3 · Google Nest 生態系 ============
  const ng = pres.addSlide();
  ng.background = { data: bgPlain };
  header(ng, "GOOGLE NEST ECOSYSTEM", "採用 Google Nest 智慧生態系",
    "國際級硬體品質，以 Google 官方 Cloud-to-Cloud 標準串接，語音裝置控制已完成整合",
    [{ text: "國際品牌背書\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "Google Nest 全系列", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);

  // 已整合 Hero band
  const hbY = 1.68, hbH = 0.86;
  ng.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: hbY, w: 12.33, h: hbH, rectRadius: 0.1,
    fill: { color: "10241d", transparency: 8 }, line: { color: C.live, width: 1, transparency: 30 },
    shadow: { type: "outer", color: "000000", blur: 7, offset: 2, angle: 90, opacity: 0.28 } });
  ng.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: hbY, w: 0.09, h: hbH, rectRadius: 0.04, fill: { color: C.live }, line: { type: "none" } });
  ng.addShape(pres.shapes.OVAL, { x: 0.78, y: hbY + hbH / 2 - 0.29, w: 0.58, h: 0.58, fill: { color: "0f1c33" }, line: { color: C.live, width: 0.9, transparency: 30 } });
  ng.addImage({ data: liv.google, x: 0.92, y: hbY + hbH / 2 - 0.15, w: 0.3, h: 0.3 });
  ng.addText([
    { text: "● 已整合上線　", options: { color: C.live, bold: true, fontSize: 12.5 } },
    { text: "Google 官方 Cloud-to-Cloud 標準", options: { color: C.paper, bold: true, fontSize: 12.5 } },
  ], { x: 1.55, y: hbY + 0.12, w: 6.4, h: 0.32, valign: "middle", margin: 0, fontFace: JH });
  ng.addText("SYNC · QUERY · EXECUTE 語音裝置控制 —— 對 Nest 音箱／顯示器說一句話即可開關燈光・空調・窗簾",
    { x: 1.55, y: hbY + 0.44, w: 8.9, h: 0.32, color: C.capt, fontSize: 10.5, valign: "middle", margin: 0, fontFace: JH });
  ng.addText([{ text: "※ 僅『裝置控制』\n", options: { color: C.goldSoft, fontSize: 10, bold: true } }, { text: "語音預約由平台自建麥克風管道", options: { color: C.cardMute, fontSize: 9.5 } }],
    { x: 10.5, y: hbY + 0.1, w: 2.25, h: 0.66, align: "right", valign: "middle", margin: 0, fontFace: JH, lineSpacingMultiple: 1.05 });

  // Nest 裝置 6 卡
  const nest = [
    { ic: liv.disc,    st: "LIVE", n: "Google Nest Mini / Audio", tag: "智能音箱", s: "語音開關燈光・空調・窗簾(Cloud-to-Cloud)" },
    { ic: liv.display, st: "LIVE", n: "Google Nest Hub", tag: "智能顯示器", s: "7 吋觸控 + 語音,可視化住戶控制面板" },
    { ic: blu.display, st: "OPT",  n: "Google Nest Hub Max", tag: "大屏 + 視訊", s: "10 吋,公設迎賓 / 管理端資訊看板" },
    { ic: gold.wifi,   st: "CORE", n: "Google Nest Wifi Pro", tag: "Wi-Fi 6E Mesh", s: "對應網路層,社區全區無線覆蓋" },
    { ic: blu.camera,  st: "OPT",  n: "Nest Cam / Doorbell", tag: "影像門禁", s: "門口 / 公區影像,對接門禁層" },
    { ic: blu.dial,    st: "OPT",  n: "Google Nest Thermostat", tag: "智能溫控", s: "空調節能控制,連動 IoT 排程" },
  ];
  const nx0 = 0.5, ny0 = 2.78, nw = 4.05, nh = 1.92, ngx = 0.19, ngy = 0.16;
  nest.forEach((d, i) => {
    const cx = nx0 + (i % 3) * (nw + ngx);
    const cy = ny0 + Math.floor(i / 3) * (nh + ngy);
    const emph = d.st === "LIVE";
    ng.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: nw, h: nh, rectRadius: 0.11,
      fill: { color: emph ? "13241d" : C.cardFill, transparency: emph ? 10 : 20 },
      line: { color: emph ? C.live : C.gold, width: emph ? 1 : 0.75, transparency: emph ? 40 : 58 },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.3 } });
    ng.addShape(pres.shapes.OVAL, { x: cx + 0.24, y: cy + 0.24, w: 0.72, h: 0.72, fill: { color: "0f1c33" }, line: { color: stColor[d.st], width: 0.9, transparency: 30 } });
    ng.addImage({ data: d.ic, x: cx + 0.42, y: cy + 0.42, w: 0.36, h: 0.36 });
    ng.addText([dot(d.st), { text: d.n, options: { color: C.paper, bold: true, fontSize: 12 } }],
      { x: cx + 1.12, y: cy + 0.26, w: nw - 1.28, h: 0.3, valign: "middle", margin: 0, fontFace: JH });
    ng.addText(d.tag, { x: cx + 1.12, y: cy + 0.58, w: nw - 1.28, h: 0.26, color: stColor[d.st], bold: true, fontSize: 10, charSpacing: 1, margin: 0, fontFace: JH });
    ng.addShape(pres.shapes.LINE, { x: cx + 0.26, y: cy + 1.12, w: nw - 0.52, h: 0, line: { color: C.gold, width: 0.5, dashType: "dash", transparency: 55 } });
    ng.addText(d.s, { x: cx + 0.28, y: cy + 1.2, w: nw - 0.54, h: 0.58, color: C.capt, fontSize: 9.5, margin: 0, fontFace: JH, lineSpacingMultiple: 1.04, valign: "top" });
  });
  ng.addText("※ Nest 音箱／顯示器的語音裝置控制經 Google 官方 Cloud-to-Cloud 標準整合；其餘 Nest 硬體為建議選配的同生態系設備,非既有程式整合。",
    { x: 0.5, y: 6.74, w: 12.33, h: 0.3, fontSize: 10, italic: true, color: C.cardMute, margin: 0, fontFace: JH });
  legend(ng, 1.28);
  footer(ng, "推薦硬體配置清單 ── Google Nest 生態系", "官方標準整合 · 國際級硬體品質");

  // ============ Slide 4 · 分區推薦硬體清單（6 卡）============
  const g = pres.addSlide();
  g.background = { data: bgPlain };
  header(g, "HARDWARE CHECKLIST BY ZONE", "分區推薦硬體清單",
    "六大區塊逐項列出建議設備、規格與整合狀態",
    [{ text: "涵蓋六大區塊\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "中樞 · 網路 · 公設 · 住戶 · 管理 · 雲端", options: { color: C.goldSoft, fontSize: 11, bold: true } }]);
  legend(g, 1.28);

  const zones = [
    { ic: gold.hub, t: "社區中樞・邊緣閘道", en: "Edge Gateway", items: [
      { st: "CORE", n: "邊緣閘道主機", s: "無風扇工控機(N100/8GB/128GB),常駐 Gateway 服務" },
      { st: "LIVE", n: "HTTP 硬體閘道", s: "App 經 x-api-key 下發:光/空調/窗簾/安防/影音/電源" },
      { st: "OPT",  n: "協定橋接模組", s: "MQTT Broker + Modbus 閘道(現為 stub,待接實體設備)" },
      { st: "CORE", n: "不斷電系統 UPS", s: "≥600VA,保障中樞與網路斷電續航" },
    ]},
    { ic: gold.network, t: "網路基礎建設", en: "Network", items: [
      { st: "CORE", n: "路由 / 防火牆", s: "具 VLAN 分流:IoT / 管理 / 訪客網段隔離" },
      { st: "CORE", n: "PoE 網路交換器", s: "8–24 埠,供電掃碼機 / 攝影機 / AP" },
      { st: "OPT",  n: "Wi-Fi 6E 無線 AP", s: "公區覆蓋(建議 Google Nest Wifi Pro)" },
    ]},
    { ic: gold.scan, t: "公共設備・門禁", en: "Amenity & Access", items: [
      { st: "OPT", n: "大廳掃碼門禁", s: "QR 掃描器 + 電子鎖控制器(通行證 QR 已實作,現模擬掃描)" },
      { st: "OPT", n: "車道柵欄 + 車牌辨識", s: "停車現為人工輸入車牌,LPR 可自動放行" },
      { st: "OPT", n: "智能包裹櫃", s: "包裹位置現為文字欄位,智能櫃可自動通知取件" },
      { st: "OPT", n: "電梯介接控制器", s: "乾接點 / BACnet,支援『電梯禮賓』呼梯" },
    ]},
    { ic: gold.bulb, t: "住戶端智慧設備", en: "In-home", items: [
      { st: "LIVE", n: "Google Nest 音箱 / 顯示器", s: "Cloud-to-Cloud 語音『開關』控制(僅裝置控制,非語音預約)" },
      { st: "LIVE", n: "住戶智慧設備", s: "光/空調/窗簾/安防,經閘道由住戶 App 控制" },
      { st: "LIVE", n: "住戶智慧型手機", s: "主要用戶端(iOS/Android),語音預約麥克風;自備" },
    ]},
    { ic: gold.monitor, t: "管理與終端", en: "Terminals", items: [
      { st: "CORE", n: "物業櫃檯平板", s: "10 吋以上,語音代訂 + 管理後台" },
      { st: "LIVE", n: "管理中心 Web Kiosk", s: "react-native-web 儀表板,櫃檯大螢幕一體機" },
      { st: "LIVE", n: "派工人員行動裝置", s: "物業 / 維修手機,接收 LINE・推播派工單" },
    ]},
    { ic: gold.cloud, t: "雲端與服務", en: "Cloud & Services", items: [
      { st: "LIVE", n: "後端主機(Render)", s: "Node/tRPC;建議 Starter+ 含持久磁碟(SQLite/PG)" },
      { st: "LIVE", n: "Web 前端(Vercel)", s: "Expo Router web build" },
      { st: "LIVE", n: "訊息通道", s: "LINE OA · Twilio SMS · SMTP · Expo 推播" },
      { st: "OPT",  n: "NLP 服務(FastAPI)", s: "100+ 模型自架(選配),現以 Gemini 代理" },
    ]},
  ];

  const gx0 = 0.5, gy0 = 1.72, gw = 4.05, gh = 2.52, ggx = 0.19, ggy = 0.16;
  zones.forEach((z, i) => {
    const cx = gx0 + (i % 3) * (gw + ggx);
    const cy = gy0 + Math.floor(i / 3) * (gh + ggy);
    g.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: gw, h: gh, rectRadius: 0.11,
      fill: { color: C.cardFill, transparency: 20 }, line: { color: C.gold, width: 0.75, transparency: 58 },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.3 } });
    // 卡頭
    g.addShape(pres.shapes.OVAL, { x: cx + 0.2, y: cy + 0.18, w: 0.5, h: 0.5, fill: { color: "0f1c33" }, line: { color: C.gold, width: 0.75, transparency: 35 } });
    g.addImage({ data: z.ic, x: cx + 0.31, y: cy + 0.29, w: 0.28, h: 0.28 });
    g.addText([
      { text: z.t + "\n", options: { fontSize: 13, bold: true, color: C.paper } },
      { text: z.en, options: { fontSize: 9, color: C.cardMute } },
    ], { x: cx + 0.82, y: cy + 0.16, w: gw - 0.95, h: 0.54, valign: "middle", margin: 0, fontFace: JH, lineSpacingMultiple: 0.95 });
    g.addShape(pres.shapes.LINE, { x: cx + 0.22, y: cy + 0.78, w: gw - 0.44, h: 0, line: { color: C.gold, width: 0.5, dashType: "dash", transparency: 55 } });
    // 設備列
    const n = z.items.length;
    const rowH = (gh - 0.92) / n;
    z.items.forEach((it, k) => {
      const ry = cy + 0.86 + k * rowH;
      g.addText([
        dot(it.st),
        { text: it.n, options: { color: C.paper, bold: true, fontSize: 10.5 } },
      ], { x: cx + 0.22, y: ry, w: gw - 0.42, h: 0.24, margin: 0, fontFace: JH });
      g.addText(it.s, { x: cx + 0.44, y: ry + 0.24, w: gw - 0.62, h: rowH - 0.26, fontSize: 8.3, color: C.capt, margin: 0, fontFace: JH, lineSpacingMultiple: 0.98, valign: "top" });
    });
  });
  footer(g, "推薦硬體配置清單 ── 分區明細", "狀態依實際程式整合現況標註");

  // ============ Slide 5 · 分階段採購建議（對齊系統方案規劃書 P0–P3）============
  const t = pres.addSlide();
  t.background = { data: bgPlain };
  header(t, "PHASED PROCUREMENT PLAN", "分階段採購建議：什麼階段，買什麼",
    "與《系統方案規劃書》P0–P3 對齊 —— 硬體隨建案工程分批就位,避免一次性重投資",
    [{ text: "同一平台\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "四階段分批採購", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);
  legend(t, 1.28);

  // Phase 定義(與 proposal.build.cjs 一致)
  const PH = [
    { id: "P0", name: "平台開發・客製", tag: "預售期・即刻啟動", col: C.live },
    { id: "P1", name: "基礎上線",       tag: "工程期・交屋前",   col: C.core },
    { id: "P2", name: "智慧擴充",       tag: "交屋・入住期",     col: C.opt },
    { id: "P3", name: "旗艦完善",       tag: "營運成熟期",       col: C.goldSoft },
  ];
  const buys = [
    { note: "最小配置:平板 ×1 + 音箱 ×1", items: [
      { st: "CORE", n: "櫃檯平板 ×1", s: "樣品屋語音預約→派單實演" },
      { st: "CORE", n: "Nest 音箱 ×1", s: "語音裝置控制展示" },
      { st: "OPT",  n: "示範閘道＋情境設備", s: "少量燈光/空調(或乾跑展示)" },
      { st: "LIVE", n: "雲端(免費層)", s: "Render + Vercel + LINE OA" },
    ]},
    { note: "機房/弱電需工程期預留", items: [
      { st: "CORE", n: "路由/防火牆(VLAN)", s: "IoT/管理/訪客網段隔離" },
      { st: "CORE", n: "PoE 交換器 8–24 埠", s: "供電掃碼機/攝影機/AP" },
      { st: "CORE", n: "邊緣閘道主機 + UPS", s: "工控機常駐 + 斷電續航" },
      { st: "CORE", n: "櫃檯平板・管理 Kiosk", s: "物業營運雙終端" },
      { st: "LIVE", n: "雲端升級 Starter", s: "持久磁碟,正式營運等級" },
    ]},
    { note: "住戶體驗集中在此階段", items: [
      { st: "OPT",  n: "大廳 QR 掃碼門禁", s: "通行證 QR 已實作,接上即用" },
      { st: "LIVE", n: "住戶 IoT 設備", s: "光/空調/窗簾,App 控制" },
      { st: "LIVE", n: "Nest 音箱/顯示器", s: "住戶語音裝置控制" },
      { st: "CORE", n: "Nest Wifi Pro(6E)", s: "公區與示範戶無線覆蓋" },
      { st: "OPT",  n: "協定橋接模組", s: "MQTT/Modbus 對接設備廠牌" },
    ]},
    { note: "全數選配,逐項導入", items: [
      { st: "OPT", n: "車牌辨識柵欄(LPR)", s: "住戶車自動放行" },
      { st: "OPT", n: "智能包裹櫃", s: "自助取件免排隊" },
      { st: "OPT", n: "電梯介接控制器", s: "乾接點/BACnet 呼梯" },
      { st: "OPT", n: "Nest Hub Max 看板", s: "公設迎賓/管理大屏" },
      { st: "OPT", n: "自架 NLP + PG・雙備援", s: "資料自主 + 旗艦可用性" },
    ]},
  ];
  const tY = 1.72, tH = 4.62, tW = 3.0, tGap = 0.12, tx0 = 0.52;
  buys.forEach((b, i) => {
    const p = PH[i];
    const cx = tx0 + i * (tW + tGap);
    card(t, cx, tY, tW, tH, i === 0 ? { fill: "13241d", tr: 10, line: C.live, ltr: 40, lw: 1 } : {});
    // 階段頭:圓形節點 + 名稱 + 時點
    t.addShape(pres.shapes.OVAL, { x: cx + 0.22, y: tY + 0.16, w: 0.44, h: 0.44, fill: { color: p.col }, line: { color: "0b1220", width: 1.2 } });
    t.addText(p.id, { x: cx + 0.22, y: tY + 0.16, w: 0.44, h: 0.44, fontSize: 11.5, bold: true, color: "0b1220", align: "center", valign: "middle", margin: 0 });
    t.addText([
      { text: p.name + "\n", options: { fontSize: 12.5, bold: true, color: C.paper } },
      { text: p.tag, options: { fontSize: 9, bold: true, color: p.col, charSpacing: 1 } },
    ], { x: cx + 0.76, y: tY + 0.12, w: tW - 0.9, h: 0.54, valign: "middle", margin: 0, fontFace: JH, lineSpacingMultiple: 1.0 });
    t.addShape(pres.shapes.LINE, { x: cx + 0.2, y: tY + 0.76, w: tW - 0.4, h: 0, line: { color: p.col, width: 0.6, dashType: "dash", transparency: 40 } });
    // 採購項目列
    const n = b.items.length, rowH = (tH - 1.42) / n;
    b.items.forEach((it, k) => {
      const ry = tY + 0.88 + k * rowH;
      t.addText([dot(it.st), { text: it.n, options: { color: C.paper, bold: true, fontSize: 10.3 } }],
        { x: cx + 0.2, y: ry, w: tW - 0.36, h: 0.24, margin: 0, fontFace: JH });
      t.addText(it.s, { x: cx + 0.42, y: ry + 0.24, w: tW - 0.58, h: rowH - 0.26, fontSize: 8.2, color: C.capt, margin: 0, fontFace: JH, lineSpacingMultiple: 0.98, valign: "top" });
    });
    // 底部採購註記
    t.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx + 0.16, y: tY + tH - 0.5, w: tW - 0.32, h: 0.36, rectRadius: 0.07, fill: { color: "0e1a30", transparency: 10 }, line: { color: p.col, width: 0.6, transparency: 45 } });
    t.addText(b.note, { x: cx + 0.16, y: tY + tH - 0.5, w: tW - 0.32, h: 0.36, fontSize: 9, bold: true, color: C.goldSoft, align: "center", valign: "middle", margin: 0, fontFace: JH });
    // 欄間箭頭
    if (i < buys.length - 1)
      t.addText("→", { x: cx + tW - 0.03, y: tY + 0.16, w: tGap + 0.06, h: 0.44, fontSize: 13, bold: true, color: C.gold, align: "center", valign: "middle", margin: 0 });
  });
  t.addText("※ 每階段獨立驗收,採購節奏可依銷售進度調節;P1 的機房位置與弱電管線需於建案工程期預留(與土建併行)。",
    { x: 0.52, y: 6.72, w: 12.3, h: 0.3, fontSize: 10, italic: true, color: C.cardMute, margin: 0, fontFace: JH });
  footer(t, "推薦硬體配置清單 ── 分階段採購建議", "P0 開發 → P1 基礎 → P2 智慧 → P3 旗艦");

  await pres.writeFile({ fileName: "../推薦硬體配置清單.pptx" });
  console.log("written ../推薦硬體配置清單.pptx (5 slides)");
})();
