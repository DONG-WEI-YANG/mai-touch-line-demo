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

  // ============ Slide 1 · 封面 ============
  const cov = pres.addSlide();
  cov.background = { data: bgPlain };
  cov.addImage({ data: gold.hub, x: 6.06, y: 1.42, w: 1.2, h: 1.2 });
  cov.addText("RECOMMENDED HARDWARE CONFIGURATION",
    { x: 0, y: 2.98, w: 13.333, h: 0.34, fontSize: 13, color: C.gold, bold: true, charSpacing: 4, align: "center", margin: 0 });
  cov.addText("推薦硬體配置清單",
    { x: 0, y: 3.42, w: 13.333, h: 0.9, fontSize: 44, bold: true, color: C.paper, align: "center", margin: 0, fontFace: JH });
  cov.addShape(pres.shapes.LINE, { x: 6.16, y: 4.52, w: 1.0, h: 0, line: { color: C.gold, width: 1.2 } });
  cov.addText("高級住宅・智慧管理平台　｜　從雲端到終端，一次配齊",
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

  // ============ Slide 4 · 三級部署方案 ============
  const t = pres.addSlide();
  t.background = { data: bgPlain };
  header(t, "DEPLOYMENT TIERS", "三級部署方案：依規模逐級擴充",
    "從接待中心示範，到單棟上線，再到多棟大型建案",
    [{ text: "同一平台\n", options: { color: C.muted, fontSize: 11.5 } },
     { text: "三種硬體規模", options: { color: C.goldSoft, fontSize: 12, bold: true } }]);

  const tiers = [
    { ic: blu.mic, tag: "PoC · 示範驗證", name: "體驗版", col: C.opt, use: "接待中心 · 樣品屋",
      rows: [
        "現有雲端:Render Free + Vercel",
        "櫃檯平板 ×1 + 住戶手機 App",
        "示範閘道 ×1(或 DRY_RUN 乾跑)",
        "少量燈光 / 空調示範設備",
        "Google Nest 音箱 ×1(裝置控制)",
      ]},
    { ic: gold.hub, tag: "Standard · 單棟上線", name: "標準版", col: C.core, use: "單棟社區正式營運",
      rows: [
        "邊緣閘道主機 + UPS",
        "網路:路由/防火牆 · PoE · AP",
        "大廳掃碼門禁 + 電梯介接",
        "住戶 IoT(光/空調/窗簾)",
        "雲端升級:Render Starter(持久碟)",
      ]},
    { ic: gold.route, tag: "Flagship · 多棟旗艦", name: "旗艦版", col: C.gold, use: "大型建案 · 多棟社區",
      rows: [
        "含『標準版』全部項目",
        "車牌辨識柵欄 + 智能包裹櫃",
        "全區 Nest Wifi Pro(6E)+ 協定橋接",
        "自架 NLP(FastAPI)+ PostgreSQL",
        "冗餘:雙 UPS / 雙上聯備援",
      ]},
  ];
  const tY = 1.86, tH = 4.7, tW = 3.9, tGap = 0.27, tx0 = 0.62;
  tiers.forEach((tr, i) => {
    const cx = tx0 + i * (tW + tGap);
    const flagship = i === 2;
    t.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: tY, w: tW, h: tH, rectRadius: 0.12,
      fill: { color: flagship ? "1a2942" : C.cardFill, transparency: flagship ? 6 : 18 },
      line: { color: C.gold, width: flagship ? 1.4 : 0.75, transparency: flagship ? 20 : 55 },
      shadow: { type: "outer", color: "000000", blur: 9, offset: 3, angle: 90, opacity: 0.32 } });
    // 圖示圈
    t.addShape(pres.shapes.OVAL, { x: cx + tW / 2 - 0.44, y: tY + 0.34, w: 0.88, h: 0.88, fill: { color: "0f1c33" }, line: { color: tr.col, width: 1, transparency: 25 } });
    t.addImage({ data: tr.ic, x: cx + tW / 2 - 0.24, y: tY + 0.54, w: 0.48, h: 0.48 });
    t.addText(tr.name, { x: cx, y: tY + 1.3, w: tW, h: 0.46, fontSize: 24, bold: true, color: C.paper, align: "center", margin: 0, fontFace: JH });
    t.addText(tr.tag, { x: cx, y: tY + 1.8, w: tW, h: 0.28, fontSize: 11, bold: true, color: tr.col, align: "center", charSpacing: 1, margin: 0, fontFace: JH });
    t.addShape(pres.shapes.LINE, { x: cx + 0.5, y: tY + 2.16, w: tW - 1.0, h: 0, line: { color: C.gold, width: 0.5, dashType: "dash", transparency: 50 } });
    t.addText(tr.rows.map((r) => ({ text: r, options: { color: C.capt, fontSize: 11, bullet: { code: "2022", indent: 14 }, paraSpaceAfter: 8 } })),
      { x: cx + 0.36, y: tY + 2.3, w: tW - 0.62, h: 1.7, valign: "top", margin: 0, fontFace: JH, lineSpacingMultiple: 1.05 });
    // 適用帶
    t.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx + 0.28, y: tY + tH - 0.62, w: tW - 0.56, h: 0.42, rectRadius: 0.08, fill: { color: "0e1a30", transparency: 10 }, line: { color: tr.col, width: 0.75, transparency: 45 } });
    t.addText([{ text: "適用　", options: { color: C.cardMute, fontSize: 9.5 } }, { text: tr.use, options: { color: C.goldSoft, fontSize: 10.5, bold: true } }],
      { x: cx + 0.28, y: tY + tH - 0.62, w: tW - 0.56, h: 0.42, align: "center", valign: "middle", margin: 0, fontFace: JH });
  });
  t.addText("※ 各級可疊加：先以體驗版驗證流程與住戶接受度，再逐棟升級標準版、擴至旗艦版；雲端與 App 用戶端全程沿用同一套系統。",
    { x: 0.62, y: 6.74, w: 12.1, h: 0.3, fontSize: 10, italic: true, color: C.cardMute, margin: 0, fontFace: JH });
  footer(t, "推薦硬體配置清單 ── 三級部署方案", "體驗 → 標準 → 旗艦，逐級擴充");

  await pres.writeFile({ fileName: "../推薦硬體配置清單.pptx" });
  console.log("written ../推薦硬體配置清單.pptx (5 slides)");
})();
