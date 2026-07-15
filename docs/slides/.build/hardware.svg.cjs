/* 推薦硬體配置清單 —— 直接產生純向量 SVG（不經 PNG 光柵化）
   輸出：../svg/slide-1.svg … slide-5.svg + ../推薦硬體配置清單_svg.html 預覽
   座標系：viewBox 0 0 1333 750（1 英吋 = 100 單位，與 pptx 版一致）；字級 pt → 單位 ×1.389 */
const fs = require("fs");
const path = require("path");

// ---- 調色盤 ----
const C = {
  gold: "c9a35a", goldSoft: "e6cf9a", paper: "f6f3ec", muted: "9fb0cc",
  live: "69d6a8", core: "c9a35a", opt: "6fb1ff",
  cardFill: "12203a", cardLine: "3a4f73", white: "ffffff", capt: "cdd8ec",
  cardMute: "5e74a0", band: "14253f",
};
const stColor = { LIVE: C.live, CORE: C.core, OPT: C.opt };
const FF = "'Microsoft JhengHei','PingFang TC','Noto Sans TC','Segoe UI',sans-serif";
const U = (inch) => +(inch * 100).toFixed(2);     // 英吋 → 單位
const PT = (pt) => +(pt * 1.389).toFixed(2);       // pt → 單位
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---- CJK 自動斷行：估寬（中日韓=1、其餘≈0.56），貪婪填入 ----
function wrap(text, maxUnits, fsize) {
  const per = fsize;                       // 一個全形字 ≈ 字級寬
  const maxW = maxUnits / per;             // 每行可容納「全形當量」
  const isCJK = (c) => /[　-鿿＀-￯‘-”]/.test(c);
  // 斷詞：連續非 CJK 併為一個 token；CJK 每字一 token
  const tokens = []; let buf = "";
  for (const ch of text) {
    if (isCJK(ch) || ch === "\n") { if (buf) { tokens.push(buf); buf = ""; } tokens.push(ch); }
    else buf += ch;
  }
  if (buf) tokens.push(buf);
  const wOf = (t) => (t === "\n" ? 0 : isCJK(t) ? 1 : t.length * 0.56);
  const lines = []; let cur = "", cw = 0;
  for (const t of tokens) {
    if (t === "\n") { lines.push(cur); cur = ""; cw = 0; continue; }
    const w = wOf(t);
    if (cw + w > maxW && cur !== "") { lines.push(cur); cur = t.replace(/^ /, ""); cw = w; }
    else { cur += t; cw += w; }
  }
  if (cur !== "") lines.push(cur);
  return lines.length ? lines : [""];
}

// ---- SVG primitives（座標皆為單位空間）----
const S = [];
const push = (s) => S.push(s);
function rrect(x, y, w, h, r, { fill, fo = 0, stroke, sw = 0, so = 0 } = {}) {
  const f = fill ? `fill="#${fill}"${fo ? ` fill-opacity="${1 - fo / 100}"` : ""}` : `fill="none"`;
  const st = stroke ? ` stroke="#${stroke}" stroke-width="${sw}"${so ? ` stroke-opacity="${1 - so / 100}"` : ""}` : "";
  push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"${r ? ` ry="${r}"` : ""} ${f}${st}/>`);
}
function oval(cx, cy, rx, ry, { fill, stroke, sw = 0, so = 0 } = {}) {
  const f = fill ? `fill="#${fill}"` : `fill="none"`;
  const st = stroke ? ` stroke="#${stroke}" stroke-width="${sw}"${so ? ` stroke-opacity="${1 - so / 100}"` : ""}` : "";
  push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${f}${st}/>`);
}
function dline(x, y, w, { color, sw = 0.5, dash, so = 0 } = {}) {
  push(`<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="#${color}" stroke-width="${PT(sw)}"${dash ? ` stroke-dasharray="${dash}"` : ""}${so ? ` stroke-opacity="${1 - so / 100}"` : ""}/>`);
}
// 單行富文字（runs = [{t,color,bold,size,italic,spacing}]），align: start|middle|end；y = 基線
function tline(x, baseline, runs, { align = "start", spacing } = {}) {
  const anchor = align === "middle" ? "middle" : align === "end" ? "end" : "start";
  const sp = spacing ? ` letter-spacing="${spacing}"` : "";
  const spans = runs.map((r) =>
    `<tspan fill="#${r.color}"${r.bold ? ` font-weight="700"` : ""}${r.italic ? ` font-style="italic"` : ""}${r.size ? ` font-size="${PT(r.size)}"` : ""}>${esc(r.t)}</tspan>`
  ).join("");
  push(`<text x="${x}" y="${baseline}" text-anchor="${anchor}" font-family="${FF}"${sp} xml:space="preserve">${spans}</text>`);
}
// 多行段落（自動斷行），x/y = 方塊左上；回傳結束 y
function para(x, y, w, text, { size, color, align = "start", lh = 1.15, italic } = {}) {
  const fsize = PT(size);
  const lines = wrap(text, w, fsize);
  const step = fsize * lh;
  const anchor = align === "middle" ? "middle" : align === "end" ? "end" : "start";
  const ax = align === "middle" ? x + w / 2 : align === "end" ? x + w : x;
  lines.forEach((ln, i) => {
    push(`<text x="${ax}" y="${(y + fsize * 0.82 + i * step).toFixed(2)}" text-anchor="${anchor}" font-family="${FF}" font-size="${fsize}" fill="#${color}"${italic ? ` font-style="italic"` : ""}>${esc(ln)}</text>`);
  });
  return y + fsize * 0.82 + lines.length * step;
}

// ---- 圖示（24×24 viewBox 內部描邊路徑）----
const ICON = (col) => ({
  cloud:   `<path d="M7 18a4 4 0 0 1 .4-8 5.5 5.5 0 0 1 10.7 1.4A3.4 3.4 0 0 1 17.5 18z"/>`,
  hub:     `<rect x="6" y="10" width="12" height="9.5" rx="2"/><circle cx="12" cy="14.7" r="1.3"/><path d="M9 8a5 5 0 0 1 6 0M7 6a8 8 0 0 1 10 0"/>`,
  network: `<rect x="3" y="9" width="18" height="6.5" rx="1.4"/><path d="M7 15.5v2.3M12 15.5v2.3M17 15.5v2.3M7 9V6.8M12 9V6.8M17 9V6.8"/>`,
  wifi:    `<path d="M5 9.5a10 10 0 0 1 14 0M7.6 12.4a6 6 0 0 1 8.8 0M10 15.2a2.4 2.4 0 0 1 4 0"/><circle cx="12" cy="18.4" r="0.9" fill="#${col}" stroke="none"/>`,
  scan:    `<rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h3v3M20.5 14.5v0M17.5 20.5h3M20.5 17.5v3"/>`,
  bulb:    `<path d="M9.5 18.5h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.6.6 1 1.3 1 2.4h5.6c0-1.1.4-1.8 1-2.4A6 6 0 0 0 12 3z"/>`,
  monitor: `<rect x="3" y="4.5" width="18" height="11.5" rx="2"/><path d="M8.5 20.5h7M12 16v4.5"/>`,
  mic:     `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>`,
  route:   `<rect x="3" y="13" width="18" height="6.5" rx="1.6"/><path d="M7 16.2h.01M11 16.2h.01"/><path d="M17 13V9.5M13 9.5h8M18.5 7l2.5 2.5-2.5 2.5"/>`,
  disc:    `<ellipse cx="12" cy="12" rx="8.6" ry="5.2"/><ellipse cx="12" cy="12" rx="4" ry="2.3"/><circle cx="12" cy="12" r="0.9" fill="#${col}" stroke="none"/>`,
  display: `<rect x="4" y="3.6" width="16" height="11" rx="1.6"/><path d="M9 14.6v3.4h6v-3.4M6.5 21h11"/>`,
  dial:    `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3.2v2.1M20.8 12h-2.1M12 20.8v-2.1M3.2 12h2.1"/>`,
  camera:  `<rect x="3" y="7.5" width="13" height="10" rx="2"/><path d="M16 11l5-2.4v7.8L16 14z"/><circle cx="9" cy="12.5" r="2.2"/>`,
  google:  `<path d="M20.5 12.2c0-.7-.06-1.2-.2-1.8H12v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.5z"/><path d="M12 21c2.4 0 4.4-.8 5.9-2.2l-2.9-2.2c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21z"/><path d="M7 11.8a5.4 5.4 0 0 1 0-3.5V6H4a9 9 0 0 0 0 8.1z"/><path d="M12 6.6c1.3 0 2.5.45 3.4 1.3l2.5-2.5A9 9 0 0 0 4 6l3 2.3c.7-2.1 2.7-3.7 5-3.7z"/>`,
});
// 置放圖示：中心 (cx,cy) 單位、目標尺寸 size 單位
function icon(name, cx, cy, size, col) {
  const s = size / 24;
  const tx = (cx - size / 2).toFixed(2), ty = (cy - size / 2).toFixed(2);
  const inner = ICON(col)[name];
  push(`<g transform="translate(${tx},${ty}) scale(${s.toFixed(4)})" fill="none" stroke="#${col}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`);
}
// 狀態圖示圈
function iconCircle(name, cx, cy, r, ringCol, iconCol, iconSize) {
  oval(cx, cy, r, r, { fill: "0f1c33", stroke: ringCol, sw: 0.75, so: 35 });
  icon(name, cx, cy, iconSize, iconCol);
}

// ---- 背景 ----
function bg(defsId) {
  return `<defs><radialGradient id="${defsId}" cx="50%" cy="-8%" r="85%">
    <stop offset="0" stop-color="#1a2c4d"/><stop offset="0.55" stop-color="#0c1322"/><stop offset="1" stop-color="#070d18"/>
  </radialGradient></defs>
  <rect width="1333" height="750" fill="#070b14"/>
  <rect width="1333" height="750" fill="url(#${defsId})"/>
  <rect x="20" y="20" width="1293" height="710" rx="10" fill="none" stroke="#c9a35a" stroke-width="1" stroke-opacity="0.28"/>`;
}

// ---- 共用區塊 ----
function header(eyebrow, title, sub, rightLines) {
  tline(U(0.6), U(0.34) + PT(11) * 0.9, [{ t: eyebrow, color: C.gold, bold: true, size: 11 }], { spacing: 3 });
  tline(U(0.58), U(0.58) + PT(26) * 0.9, [{ t: title, color: C.paper, bold: true, size: 26 }]);
  para(U(0.6), U(1.24), U(9.6), sub, { size: 12.5, color: C.muted });
  if (rightLines) rightLines.forEach((ln, i) =>
    tline(U(9.4) + U(3.33), U(0.5) + PT(11.5) * 0.9 + i * PT(12) * 1.25, ln, { align: "end" }));
}
function legend(y) {
  const parts = [
    { t: "● ", color: C.live }, { t: "已整合上線　", color: C.capt },
    { t: "● ", color: C.core }, { t: "建議必備　", color: C.capt },
    { t: "○ ", color: C.opt }, { t: "選配・待接", color: C.capt },
  ].map((p) => ({ ...p, size: 10.5 }));
  tline(U(12.73), U(y) + PT(10.5) * 0.9, parts, { align: "end" });
}
function footer(l, r) {
  tline(U(0.6), U(7.12) + PT(10.5) * 0.9, [{ t: l, color: C.cardMute, size: 10.5 }]);
  tline(U(12.73), U(7.12) + PT(10.5) * 0.9, [{ t: r, color: C.cardMute, size: 10.5 }], { align: "end" });
}
const dotRun = (st) => ({ t: st === "OPT" ? "○ " : "● ", color: stColor[st], size: 10.5 });

// ==================================================================
function slideWrap(defsId, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1333 750" width="1333" height="750" font-family="${FF}">
${bg(defsId)}
${body}
</svg>`;
}
function build(fn) { S.length = 0; fn(); return S.join("\n"); }

// ---------- Slide 1 · 封面 ----------
const s1 = slideWrap("g1", build(() => {
  iconCircle; // noop
  icon("hub", U(6.66), U(2.02), U(1.2), C.gold);
  tline(U(6.666), U(2.98) + PT(13) * 0.9, [{ t: "RECOMMENDED HARDWARE CONFIGURATION", color: C.gold, bold: true, size: 13 }], { align: "middle", spacing: 4 });
  tline(U(6.666), U(3.42) + PT(44) * 0.82, [{ t: "推薦硬體配置清單", color: C.paper, bold: true, size: 44 }], { align: "middle" });
  dline(U(6.16), U(4.52), U(1.0), { color: C.gold, sw: 1.2 });
  tline(U(6.666), U(4.7) + PT(15) * 0.9, [{ t: "高級住宅・智慧管理平台　｜　從雲端到終端，一次配齊", color: C.capt, size: 15 }], { align: "middle" });
  tline(U(6.666), U(5.66) + PT(12.5) * 0.9, [{ t: "邊緣閘道 × 網路基礎 × 公設門禁 × 住戶智慧 × 管理終端 × 雲端服務", color: C.goldSoft, bold: true, size: 12.5 }], { align: "middle" });
  tline(U(6.666), U(6.7) + PT(10.5) * 0.9, [{ t: "※ 配置分級對應實際程式整合現況：已整合上線 · 建議必備 · 選配待接", color: C.cardMute, size: 10.5 }], { align: "middle" });
}));

// ---------- Slide 2 · 五層架構 ----------
const s2 = slideWrap("g2", build(() => {
  header("SYSTEM HARDWARE ARCHITECTURE", "五層硬體架構：從雲端指令到終端執行",
    "App 不直接對接設備 —— 指令經『邊緣閘道』下發，設備狀態逐層回報",
    [[{ t: "建商級住宅管理平台", color: C.muted, size: 11.5 }], [{ t: "雲 → 端 · 分層解耦", color: C.goldSoft, bold: true, size: 12 }]]);
  legend(1.28);
  const bands = [
    { ic: "cloud",   t: "雲端與服務層", en: "Cloud & Services", ex: "Render 後端 · Vercel Web · LINE OA · Twilio SMS · Gemini · FastAPI NLP", st: "LIVE" },
    { ic: "monitor", t: "管理終端層",   en: "Terminals",        ex: "物業櫃檯平板 · 管理中心 Web Kiosk · 住戶手機 App", st: "LIVE" },
    { ic: "network", t: "社區網路層",   en: "Network",          ex: "路由 / 防火牆(VLAN) · PoE 交換器 · Wi-Fi 6E(Nest Wifi Pro)", st: "CORE" },
    { ic: "hub",     t: "邊緣閘道層",   en: "Edge Gateway",     ex: "工控閘道主機 · HTTP(已通) / MQTT · Modbus 橋接 · UPS", st: "CORE" },
    { ic: "bulb",    t: "設備層",       en: "Devices",          ex: "光/空調/窗簾/安防 · Nest 音箱/顯示器 · 門禁/電梯/柵欄/包裹櫃", st: "OPT" },
  ];
  const bY = 1.78, bH = 0.9, bGap = 0.14, bx = 0.62, bw = 11.05;
  bands.forEach((b, i) => {
    const y = bY + i * (bH + bGap);
    rrect(U(bx), U(y), U(bw), U(bH), U(0.1), { fill: C.band, fo: 12, stroke: C.gold, sw: 0.75, so: 55 });
    rrect(U(bx), U(y), U(0.09), U(bH), U(0.04), { fill: stColor[b.st] });
    iconCircle(b.ic, U(bx + 0.59), U(y + bH / 2), U(0.31), C.gold, C.gold, U(0.34));
    tline(U(bx + 1.1), U(y + bH / 2) + PT(15) * 0.36, [{ t: b.t + "  ", color: C.paper, bold: true, size: 15 }, { t: b.en, color: C.cardMute, size: 10 }]);
    para(U(bx + 4.05), U(y + bH / 2) - PT(11) * 0.5, U(bw - 4.2), b.ex, { size: 11, color: C.capt });
    if (i < bands.length - 1) tline(U(bx + 0.59), U(y + bH) + PT(12) * 0.9, [{ t: "↓", color: C.gold, size: 12 }], { align: "middle" });
  });
  const axX = 12.05, axTop = bY + 0.2, axLen = bH * 5 + bGap * 4 - 0.4;
  push(`<line x1="${U(axX)}" y1="${U(axTop)}" x2="${U(axX)}" y2="${U(axTop + axLen)}" stroke="#${C.cardLine}" stroke-width="1.4" stroke-dasharray="5 4"/>`);
  para(U(axX + 0.06), U(axTop + 0.05), U(0.85), "指令下行", { size: 10.5, color: C.goldSoft, align: "middle" });
  para(U(axX + 0.06), U(axTop + axLen - 0.55), U(0.85), "狀態回報", { size: 10.5, color: C.opt, align: "middle" });
  footer("推薦硬體配置清單 ── 五層硬體架構", "分層解耦：任一層可獨立擴充或替換");
}));

// ---------- Slide 3 · Google Nest 生態系 ----------
const s3 = slideWrap("g3", build(() => {
  header("GOOGLE NEST ECOSYSTEM", "採用 Google Nest 智慧生態系",
    "國際級硬體品質，以 Google 官方 Cloud-to-Cloud 標準串接，語音裝置控制已完成整合",
    [[{ t: "國際品牌背書", color: C.muted, size: 11.5 }], [{ t: "Google Nest 全系列", color: C.goldSoft, bold: true, size: 12 }]]);
  legend(1.28);
  // Hero band
  const hbY = 1.68, hbH = 0.86;
  rrect(U(0.5), U(hbY), U(12.33), U(hbH), U(0.1), { fill: "10241d", fo: 8, stroke: C.live, sw: 1, so: 30 });
  rrect(U(0.5), U(hbY), U(0.09), U(hbH), U(0.04), { fill: C.live });
  iconCircle("google", U(1.07), U(hbY + hbH / 2), U(0.29), C.live, C.live, U(0.3));
  tline(U(1.55), U(hbY + 0.12) + PT(12.5) * 0.9, [{ t: "● 已整合上線　", color: C.live, bold: true, size: 12.5 }, { t: "Google 官方 Cloud-to-Cloud 標準", color: C.paper, bold: true, size: 12.5 }]);
  tline(U(1.55), U(hbY + 0.46) + PT(10.5) * 0.9, [{ t: "SYNC · QUERY · EXECUTE 語音裝置控制 —— 對 Nest 音箱／顯示器說一句話即可開關燈光・空調・窗簾", color: C.capt, size: 10.5 }]);
  tline(U(12.75), U(hbY + 0.14) + PT(10) * 0.9, [{ t: "※ 僅『裝置控制』", color: C.goldSoft, bold: true, size: 10 }], { align: "end" });
  tline(U(12.75), U(hbY + 0.42) + PT(9.5) * 0.9, [{ t: "語音預約由平台自建麥克風管道", color: C.cardMute, size: 9.5 }], { align: "end" });
  // 6 卡
  const nest = [
    { ic: "disc",    st: "LIVE", n: "Google Nest Mini / Audio", tag: "智能音箱", s: "語音開關燈光・空調・窗簾(Cloud-to-Cloud)" },
    { ic: "display", st: "LIVE", n: "Google Nest Hub", tag: "智能顯示器", s: "7 吋觸控 + 語音,可視化住戶控制面板" },
    { ic: "display", st: "OPT",  n: "Google Nest Hub Max", tag: "大屏 + 視訊", s: "10 吋,公設迎賓 / 管理端資訊看板" },
    { ic: "wifi",    st: "CORE", n: "Google Nest Wifi Pro", tag: "Wi-Fi 6E Mesh", s: "對應網路層,社區全區無線覆蓋" },
    { ic: "camera",  st: "OPT",  n: "Nest Cam / Doorbell", tag: "影像門禁", s: "門口 / 公區影像,對接門禁層" },
    { ic: "dial",    st: "OPT",  n: "Google Nest Thermostat", tag: "智能溫控", s: "空調節能控制,連動 IoT 排程" },
  ];
  const nx0 = 0.5, ny0 = 2.78, nw = 4.05, nh = 1.92, ngx = 0.19, ngy = 0.16;
  nest.forEach((d, i) => {
    const cx = nx0 + (i % 3) * (nw + ngx), cy = ny0 + Math.floor(i / 3) * (nh + ngy);
    const emph = d.st === "LIVE";
    rrect(U(cx), U(cy), U(nw), U(nh), U(0.11), { fill: emph ? "13241d" : C.cardFill, fo: emph ? 10 : 20, stroke: emph ? C.live : C.gold, sw: emph ? 1 : 0.75, so: emph ? 40 : 58 });
    iconCircle(d.ic, U(cx + 0.6), U(cy + 0.6), U(0.36), stColor[d.st], stColor[d.st], U(0.36));
    tline(U(cx + 1.12), U(cy + 0.26) + PT(12) * 0.55 + 6, [dotRun(d.st), { t: d.n, color: C.paper, bold: true, size: 12 }]);
    tline(U(cx + 1.12), U(cy + 0.58) + PT(10) * 0.9, [{ t: d.tag, color: stColor[d.st], bold: true, size: 10 }]);
    dline(U(cx + 0.26), U(cy + 1.12), U(nw - 0.52), { color: C.gold, sw: 0.5, dash: "3 3", so: 55 });
    para(U(cx + 0.28), U(cy + 1.2), U(nw - 0.54), d.s, { size: 9.5, color: C.capt, lh: 1.12 });
  });
  para(U(0.5), U(6.74), U(12.33), "※ Nest 音箱／顯示器的語音裝置控制經 Google 官方 Cloud-to-Cloud 標準整合；其餘 Nest 硬體為建議選配的同生態系設備，非既有程式整合。", { size: 10, color: C.cardMute, italic: true });
  footer("推薦硬體配置清單 ── Google Nest 生態系", "官方標準整合 · 國際級硬體品質");
}));

// ---------- Slide 4 · 分區清單 ----------
const s4 = slideWrap("g4", build(() => {
  header("HARDWARE CHECKLIST BY ZONE", "分區推薦硬體清單", "六大區塊逐項列出建議設備、規格與整合狀態",
    [[{ t: "涵蓋六大區塊", color: C.muted, size: 11.5 }], [{ t: "中樞 · 網路 · 公設 · 住戶 · 管理 · 雲端", color: C.goldSoft, bold: true, size: 11 }]]);
  legend(1.28);
  const zones = [
    { ic: "hub", t: "社區中樞・邊緣閘道", en: "Edge Gateway", items: [
      { st: "CORE", n: "邊緣閘道主機", s: "無風扇工控機(N100/8GB/128GB),常駐 Gateway 服務" },
      { st: "LIVE", n: "HTTP 硬體閘道", s: "App 經 x-api-key 下發:光/空調/窗簾/安防/影音/電源" },
      { st: "OPT",  n: "協定橋接模組", s: "MQTT Broker + Modbus 閘道(現為 stub,待接實體設備)" },
      { st: "CORE", n: "不斷電系統 UPS", s: "≥600VA,保障中樞與網路斷電續航" }] },
    { ic: "network", t: "網路基礎建設", en: "Network", items: [
      { st: "CORE", n: "路由 / 防火牆", s: "具 VLAN 分流:IoT / 管理 / 訪客網段隔離" },
      { st: "CORE", n: "PoE 網路交換器", s: "8–24 埠,供電掃碼機 / 攝影機 / AP" },
      { st: "OPT",  n: "Wi-Fi 6E 無線 AP", s: "公區覆蓋(建議 Google Nest Wifi Pro)" }] },
    { ic: "scan", t: "公共設備・門禁", en: "Amenity & Access", items: [
      { st: "OPT", n: "大廳掃碼門禁", s: "QR 掃描器 + 電子鎖控制器(通行證 QR 已實作,現模擬掃描)" },
      { st: "OPT", n: "車道柵欄 + 車牌辨識", s: "停車現為人工輸入車牌,LPR 可自動放行" },
      { st: "OPT", n: "智能包裹櫃", s: "包裹位置現為文字欄位,智能櫃可自動通知取件" },
      { st: "OPT", n: "電梯介接控制器", s: "乾接點 / BACnet,支援『電梯禮賓』呼梯" }] },
    { ic: "bulb", t: "住戶端智慧設備", en: "In-home", items: [
      { st: "LIVE", n: "Google Nest 音箱 / 顯示器", s: "Cloud-to-Cloud 語音『開關』控制(僅裝置控制,非語音預約)" },
      { st: "LIVE", n: "住戶智慧設備", s: "光/空調/窗簾/安防,經閘道由住戶 App 控制" },
      { st: "LIVE", n: "住戶智慧型手機", s: "主要用戶端(iOS/Android),語音預約麥克風;自備" }] },
    { ic: "monitor", t: "管理與終端", en: "Terminals", items: [
      { st: "CORE", n: "物業櫃檯平板", s: "10 吋以上,語音代訂 + 管理後台" },
      { st: "LIVE", n: "管理中心 Web Kiosk", s: "react-native-web 儀表板,櫃檯大螢幕一體機" },
      { st: "LIVE", n: "派工人員行動裝置", s: "物業 / 維修手機,接收 LINE・推播派工單" }] },
    { ic: "cloud", t: "雲端與服務", en: "Cloud & Services", items: [
      { st: "LIVE", n: "後端主機(Render)", s: "Node/tRPC;建議 Starter+ 含持久磁碟(SQLite/PG)" },
      { st: "LIVE", n: "Web 前端(Vercel)", s: "Expo Router web build" },
      { st: "LIVE", n: "訊息通道", s: "LINE OA · Twilio SMS · SMTP · Expo 推播" },
      { st: "OPT",  n: "NLP 服務(FastAPI)", s: "100+ 模型自架(選配),現以 Gemini 代理" }] },
  ];
  const gx0 = 0.5, gy0 = 1.72, gw = 4.05, gh = 2.52, ggx = 0.19, ggy = 0.16;
  zones.forEach((z, i) => {
    const cx = gx0 + (i % 3) * (gw + ggx), cy = gy0 + Math.floor(i / 3) * (gh + ggy);
    rrect(U(cx), U(cy), U(gw), U(gh), U(0.11), { fill: C.cardFill, fo: 20, stroke: C.gold, sw: 0.75, so: 58 });
    iconCircle(z.ic, U(cx + 0.45), U(cy + 0.43), U(0.25), C.gold, C.gold, U(0.28));
    tline(U(cx + 0.82), U(cy + 0.16) + PT(13) * 0.95, [{ t: z.t, color: C.paper, bold: true, size: 13 }]);
    tline(U(cx + 0.82), U(cy + 0.16) + PT(13) * 0.95 + PT(9) * 1.15, [{ t: z.en, color: C.cardMute, size: 9 }]);
    dline(U(cx + 0.22), U(cy + 0.78), U(gw - 0.44), { color: C.gold, sw: 0.5, dash: "3 3", so: 55 });
    const n = z.items.length, rowH = (gh - 0.92) / n;
    z.items.forEach((it, k) => {
      const ry = cy + 0.86 + k * rowH;
      tline(U(cx + 0.22), U(ry) + PT(10.5) * 0.9, [dotRun(it.st), { t: it.n, color: C.paper, bold: true, size: 10.5 }]);
      para(U(cx + 0.44), U(ry + 0.24), U(gw - 0.62), it.s, { size: 8.3, color: C.capt, lh: 1.05 });
    });
  });
  footer("推薦硬體配置清單 ── 分區明細", "狀態依實際程式整合現況標註");
}));

// ---------- Slide 5 · 三級部署方案 ----------
const s5 = slideWrap("g5", build(() => {
  header("DEPLOYMENT TIERS", "三級部署方案：依規模逐級擴充", "從接待中心示範，到單棟上線，再到多棟大型建案",
    [[{ t: "同一平台", color: C.muted, size: 11.5 }], [{ t: "三種硬體規模", color: C.goldSoft, bold: true, size: 12 }]]);
  const tiers = [
    { ic: "mic", tag: "PoC · 示範驗證", name: "體驗版", col: C.opt, use: "接待中心 · 樣品屋",
      rows: ["現有雲端:Render Free + Vercel", "櫃檯平板 ×1 + 住戶手機 App", "示範閘道 ×1(或 DRY_RUN 乾跑)", "少量燈光 / 空調示範設備", "Google Nest 音箱 ×1(裝置控制)"] },
    { ic: "hub", tag: "Standard · 單棟上線", name: "標準版", col: C.core, use: "單棟社區正式營運",
      rows: ["邊緣閘道主機 + UPS", "網路:路由/防火牆 · PoE · AP", "大廳掃碼門禁 + 電梯介接", "住戶 IoT(光/空調/窗簾)", "雲端升級:Render Starter(持久碟)"] },
    { ic: "route", tag: "Flagship · 多棟旗艦", name: "旗艦版", col: C.gold, use: "大型建案 · 多棟社區",
      rows: ["含『標準版』全部項目", "車牌辨識柵欄 + 智能包裹櫃", "全區 Nest Wifi Pro(6E)+ 協定橋接", "自架 NLP(FastAPI)+ PostgreSQL", "冗餘:雙 UPS / 雙上聯備援"] },
  ];
  const tY = 1.86, tH = 4.7, tW = 3.9, tGap = 0.27, tx0 = 0.62;
  tiers.forEach((tr, i) => {
    const cx = tx0 + i * (tW + tGap), flagship = i === 2;
    rrect(U(cx), U(tY), U(tW), U(tH), U(0.12), { fill: flagship ? "1a2942" : C.cardFill, fo: flagship ? 6 : 18, stroke: C.gold, sw: flagship ? 1.4 : 0.75, so: flagship ? 20 : 55 });
    iconCircle(tr.ic, U(cx + tW / 2), U(tY + 0.78), U(0.44), tr.col, tr.col, U(0.48));
    tline(U(cx + tW / 2), U(tY + 1.3) + PT(24) * 0.82, [{ t: tr.name, color: C.paper, bold: true, size: 24 }], { align: "middle" });
    tline(U(cx + tW / 2), U(tY + 1.8) + PT(11) * 0.9, [{ t: tr.tag, color: tr.col, bold: true, size: 11 }], { align: "middle" });
    dline(U(cx + 0.5), U(tY + 2.16), U(tW - 1.0), { color: C.gold, sw: 0.5, dash: "3 3", so: 50 });
    tr.rows.forEach((r, k) => {
      const ry = tY + 2.34 + k * 0.34;
      tline(U(cx + 0.4), U(ry) + PT(11) * 0.9, [{ t: "•  ", color: tr.col, size: 11 }, { t: r, color: C.capt, size: 11 }]);
    });
    rrect(U(cx + 0.28), U(tY + tH - 0.62), U(tW - 0.56), U(0.42), U(0.08), { fill: "0e1a30", fo: 10, stroke: tr.col, sw: 0.75, so: 45 });
    tline(U(cx + tW / 2), U(tY + tH - 0.62 + 0.21) + PT(10.5) * 0.35, [{ t: "適用　", color: C.cardMute, size: 9.5 }, { t: tr.use, color: C.goldSoft, bold: true, size: 10.5 }], { align: "middle" });
  });
  para(U(0.62), U(6.74), U(12.1), "※ 各級可疊加：先以體驗版驗證流程與住戶接受度，再逐棟升級標準版、擴至旗艦版；雲端與 App 用戶端全程沿用同一套系統。", { size: 10, color: C.cardMute, italic: true });
  footer("推薦硬體配置清單 ── 三級部署方案", "體驗 → 標準 → 旗艦，逐級擴充");
}));

// ---- 輸出 ----
const slides = [s1, s2, s3, s4, s5];
const outDir = path.join(__dirname, "..", "svg");
fs.mkdirSync(outDir, { recursive: true });
slides.forEach((svg, i) => fs.writeFileSync(path.join(outDir, `slide-${i + 1}.svg`), svg, "utf8"));

const titles = ["封面", "五層硬體架構", "Google Nest 生態系", "分區推薦硬體清單", "三級部署方案"];
const htmlBody = slides.map((svg, i) =>
  `<figure><figcaption>${i + 1}. ${titles[i]}</figcaption><div class="slide">${svg}</div></figure>`).join("\n");
const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<title>推薦硬體配置清單 · SVG 向量版</title>
<style>
  body{margin:0;background:#05080f;color:#cdd8ec;font-family:${FF};padding:28px 0;}
  h1{text-align:center;font-size:20px;font-weight:700;color:#e6cf9a;margin:0 0 6px;}
  p.sub{text-align:center;color:#5e74a0;font-size:12px;margin:0 0 26px;}
  figure{margin:0 auto 30px;max-width:1120px;}
  figcaption{color:#9fb0cc;font-size:13px;margin:0 0 8px 4px;}
  .slide{width:100%;aspect-ratio:1333/750;box-shadow:0 12px 40px rgba(0,0,0,.55);border-radius:10px;overflow:hidden;}
  .slide svg{width:100%;height:100%;display:block;}
</style></head><body>
<h1>推薦硬體配置清單</h1><p class="sub">純向量 SVG · 5 slides · 直接由 SVG 產生（無 PNG 光柵化）</p>
${htmlBody}
</body></html>`;
fs.writeFileSync(path.join(__dirname, "..", "推薦硬體配置清單_svg.html"), html, "utf8");

console.log(`written ../svg/slide-1..5.svg + ../推薦硬體配置清單_svg.html (pure vector)`);
