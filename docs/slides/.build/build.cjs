/* 一張投影片：高級住宅・智慧管理應用場景  → 應用場景.pptx */
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");

// ---- 調色盤 ----
const C = {
  gold: "c9a35a", goldSoft: "e6cf9a", paper: "f6f3ec", muted: "9fb0cc",
  resident: "6fb1ff", property: "69d6a8", line: "27406b", cardMute: "5e74a0",
  cardFill: "12203a", cardLine: "3a4f73", white: "ffffff", capt: "cdd8ec",
};

// ---- SVG → base64 PNG ----
async function png(svg, px = 320) {
  const buf = await sharp(Buffer.from(svg)).resize(px, px, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
const W = (vb, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="${vb}">${inner}</svg>`;
const stepSvg = (color, inner) => W("0 0 24 24", `<g fill="none" stroke="${color}" stroke-width="2">${inner}</g>`);

// 角色圖示
const brainSvg = W("0 0 150 150", `
  <circle cx="75" cy="75" r="60" fill="rgba(201,163,90,0.10)" stroke="#c9a35a" stroke-width="2"/>
  <circle cx="75" cy="75" r="60" fill="none" stroke="#e6cf9a" stroke-width="1" stroke-dasharray="3 6" opacity="0.6"/>
  <path d="M75 38 C 58 38, 50 50, 53 60 C 44 64, 44 78, 53 82 C 52 95, 64 102, 75 98 C 86 102, 98 95, 97 82 C 106 78, 106 64, 97 60 C 100 50, 92 38, 75 38 Z" fill="rgba(230,207,154,0.10)" stroke="#e6cf9a" stroke-width="2.4"/>
  <path d="M75 40 L75 98 M75 56 C 66 56, 64 66, 70 70 M75 72 C 84 72, 88 80, 82 86 M75 56 C 84 56, 88 64, 82 68" fill="none" stroke="#c9a35a" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="70" cy="70" r="3.2" fill="#ffffff"/><circle cx="82" cy="86" r="3.2" fill="#ffffff"/><circle cx="82" cy="68" r="2.6" fill="#e6cf9a"/>`);
const personSvg = W("0 0 86 86", `
  <circle cx="43" cy="43" r="40" fill="rgba(111,177,255,0.10)" stroke="#6fb1ff" stroke-width="1.6"/>
  <circle cx="43" cy="35" r="13" fill="none" stroke="#6fb1ff" stroke-width="2.6"/>
  <path d="M22 64 C 22 50, 64 50, 64 64" fill="none" stroke="#6fb1ff" stroke-width="2.6" stroke-linecap="round"/>`);
const buildingSvg = W("0 0 86 86", `
  <circle cx="43" cy="43" r="40" fill="rgba(105,214,168,0.10)" stroke="#69d6a8" stroke-width="1.6"/>
  <path d="M28 60 V40 L43 30 L58 40 V60 Z" fill="none" stroke="#69d6a8" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M38 60 V49 H48 V60" fill="none" stroke="#69d6a8" stroke-width="2.4"/>
  <circle cx="43" cy="24" r="3" fill="#69d6a8"/>`);

// 場景步驟圖示
const R = C.resident, G = C.gold, P = C.property;
const icons = {
  mic:      stepSvg("#"+R, `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke-linecap="round"/>`),
  target:   stepSvg("#"+G, `<path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round"/><circle cx="12" cy="12" r="3"/>`),
  check:    stepSvg("#"+P, `<path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>`),
  gridplus: stepSvg("#"+R, `<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12h6M12 9v6" stroke-linecap="round"/>`),
  clock:    stepSvg("#"+G, `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round"/>`),
  activity: stepSvg("#"+P, `<path d="M3 12h4l3 8 4-16 3 8h4" stroke-linecap="round" stroke-linejoin="round"/>`),
  lines:    stepSvg("#"+R, `<path d="M4 6h16M4 12h10M4 18h7" stroke-linecap="round"/>`),
  network:  stepSvg("#"+G, `<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M6 8.5 11 16M18 8.5 13 16" stroke-linecap="round"/>`),
  shield:   stepSvg("#"+P, `<path d="M12 2 4 7v6c0 5 8 9 8 9s8-4 8-9V7z"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>`),
  elevator: stepSvg("#"+G, `<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 17V8M8.5 11.5 12 8l3.5 3.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  door:     stepSvg("#"+P, `<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18"/><path d="M10 9 7 12l3 3M14 9l3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/>`),
  robot:    stepSvg("#"+G, `<circle cx="12" cy="3.4" r="1.3"/><path d="M12 4.7V7" stroke-linecap="round"/><rect x="5" y="7" width="14" height="10" rx="2.5"/><circle cx="9.5" cy="12" r="1.4"/><circle cx="14.5" cy="12" r="1.4"/><path d="M8 20v-3M16 20v-3" stroke-linecap="round"/>`),
  box:      stepSvg("#"+P, `<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round"/>`),
  // 效益頁圖示
  up:       stepSvg("#"+G, `<path d="M4 18 10 12l4 4 6-7" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h5v5" stroke-linecap="round" stroke-linejoin="round"/>`),
  bolt:     stepSvg("#"+R, `<path d="M13 2 4 14h7l-1 8 9-12h-7z" stroke-linecap="round" stroke-linejoin="round"/>`),
  coin:     stepSvg("#"+P, `<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" stroke-linecap="round"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" stroke-linecap="round"/>`),
  gauge:    stepSvg("#"+G, `<path d="M4 16a8 8 0 1 1 16 0" stroke-linecap="round"/><path d="M12 16l4-4" stroke-linecap="round"/><circle cx="12" cy="16" r="1.3" fill="#${G}" stroke="none"/>`),
  star:     stepSvg("#"+G, `<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.9 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" stroke-linejoin="round"/>`),
};

// 背景（漸層 + 角色連線曲線，烘焙進底圖；座標 1px = 0.01in）
const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1333" height="750" viewBox="0 0 1333 750">
  <defs>
    <radialGradient id="g" cx="50%" cy="-8%" r="85%">
      <stop offset="0" stop-color="#1a2c4d"/><stop offset="0.55" stop-color="#0c1322"/><stop offset="1" stop-color="#070d18"/>
    </radialGradient>
    <linearGradient id="lr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6fb1ff"/><stop offset="1" stop-color="#c9a35a"/></linearGradient>
    <linearGradient id="rp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9a35a"/><stop offset="1" stop-color="#69d6a8"/></linearGradient>
  </defs>
  <rect width="1333" height="750" fill="#070b14"/>
  <rect width="1333" height="750" fill="url(#g)"/>
  <rect x="20" y="20" width="1293" height="710" rx="10" fill="none" stroke="#c9a35a" stroke-width="1" opacity="0.28"/>
  <!-- 需求上行 / 派工下行 -->
  <path d="M295,236 C 420,198 470,198 589,236" fill="none" stroke="url(#lr)" stroke-width="2.4" stroke-dasharray="2 7" stroke-linecap="round"/>
  <path d="M745,236 C 870,198 930,198 1048,236" fill="none" stroke="url(#rp)" stroke-width="2.4" stroke-dasharray="2 7" stroke-linecap="round"/>
  <text x="437" y="184" fill="#9fb0cc" font-size="13" text-anchor="middle" font-family="sans-serif">需求事件 ↗</text>
  <text x="897" y="184" fill="#9fb0cc" font-size="13" text-anchor="middle" font-family="sans-serif">智能派工 ↘</text>
  <!-- 回饋下行 -->
  <path d="M1048,392 C 660,420 620,420 285,392" fill="none" stroke="#27406b" stroke-width="2" stroke-dasharray="2 6"/>
  <text x="667" y="384" fill="#7d92ba" font-size="12.5" text-anchor="middle" font-family="sans-serif">完成回報・滿意度回饋 ←</text>
</svg>`;

// 純底圖（封面 / 效益頁）：漸層 + 邊框，無連線
const bgPlainSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1333" height="750" viewBox="0 0 1333 750">
  <defs>
    <radialGradient id="g2" cx="50%" cy="-8%" r="85%">
      <stop offset="0" stop-color="#1a2c4d"/><stop offset="0.55" stop-color="#0c1322"/><stop offset="1" stop-color="#070d18"/>
    </radialGradient>
  </defs>
  <rect width="1333" height="750" fill="#070b14"/>
  <rect width="1333" height="750" fill="url(#g2)"/>
  <rect x="20" y="20" width="1293" height="710" rx="10" fill="none" stroke="#c9a35a" stroke-width="1" opacity="0.28"/>
</svg>`;

(async () => {
  // render images
  const bg = "image/png;base64," + (await sharp(Buffer.from(bgSvg)).png().toBuffer()).toString("base64");
  const bgPlain = "image/png;base64," + (await sharp(Buffer.from(bgPlainSvg)).png().toBuffer()).toString("base64");
  const brain = await png(brainSvg, 480);
  const person = await png(personSvg, 320);
  const building = await png(buildingSvg, 320);
  const ic = {};
  for (const k of Object.keys(icons)) ic[k] = await png(icons[k], 192);

  const pres = new pptxgen();
  pres.defineLayout({ name: "S169", width: 13.333, height: 7.5 });
  pres.layout = "S169";
  pres.author = "智慧住宅管理平台";
  pres.title = "建商價值提案";

  // ============ Slide 1 · 封面 ============
  const cov = pres.addSlide();
  cov.background = { data: bgPlain };
  cov.addImage({ data: brain, x: 5.71, y: 1.32, w: 1.9, h: 1.9 }); // center 6.66
  cov.addText("BUILDER VALUE PROPOSAL · 建商價值提案",
    { x: 0, y: 3.52, w: 13.333, h: 0.34, fontSize: 13, color: C.gold, bold: true, charSpacing: 4, align: "center", margin: 0 });
  cov.addText("讓智慧，成為建案的差異化賣點",
    { x: 0, y: 3.96, w: 13.333, h: 0.9, fontSize: 40, bold: true, color: C.paper, align: "center", margin: 0, fontFace: "Microsoft JhengHei" });
  cov.addShape(pres.shapes.LINE, { x: 6.16, y: 5.04, w: 1.0, h: 0, line: { color: C.gold, width: 1.2 } });
  cov.addText("高級住宅・智慧管理平台　｜　住戶 · 管理中心 · 物業，同一顆大腦",
    { x: 0, y: 5.22, w: 13.333, h: 0.4, fontSize: 15, color: C.capt, align: "center", margin: 0, fontFace: "Microsoft JhengHei" });
  cov.addText([
    { text: "智能音箱 × LINE × IoT", options: { color: C.goldSoft, bold: true } },
    { text: "　·　聽懂需求 · 自動判斷 · 智能調度", options: { color: C.muted } },
  ], { x: 0, y: 6.22, w: 13.333, h: 0.4, fontSize: 12.5, align: "center", margin: 0 });
  cov.addText("建商打造 · 交屋即具備的智慧住宅體驗",
    { x: 0, y: 7.04, w: 13.333, h: 0.3, fontSize: 10.5, color: C.cardMute, align: "center", margin: 0 });

  // ============ Slide 2 · 應用場景總覽 ============
  const s = pres.addSlide();
  s.background = { data: bg };

  // ---------- Header ----------
  s.addText("LUXURY RESIDENCE · INTELLIGENT OPERATIONS",
    { x: 0.6, y: 0.36, w: 9, h: 0.3, fontSize: 11, color: C.gold, bold: true, charSpacing: 3, margin: 0 });
  s.addText("一顆聰明大腦，串起住戶的每個生活需求",
    { x: 0.58, y: 0.6, w: 9.3, h: 0.62, fontSize: 27, bold: true, color: C.paper, margin: 0,
      fontFace: "Microsoft JhengHei" });
  s.addText("從「口說設備」到「任務分派」— 五大生活場景，同一智能中樞",
    { x: 0.6, y: 1.28, w: 9.3, h: 0.4, fontSize: 13, color: C.muted, margin: 0 });
  s.addText([
    { text: "建商級住宅管理平台\n", options: { color: C.muted, fontSize: 11.5 } },
    { text: "智能音箱 × LINE × IoT\n", options: { color: C.goldSoft, fontSize: 12, bold: true } },
    { text: "住戶 · 管理中心 · 物業", options: { color: C.muted, fontSize: 11.5 } },
  ], { x: 9.4, y: 0.5, w: 3.33, h: 1.0, align: "right", lineSpacingMultiple: 1.25, margin: 0 });

  // ---------- 角色帶 ----------
  s.addImage({ data: person, x: 1.95, y: 1.88, w: 0.94, h: 0.94 });    // center 2.42
  s.addImage({ data: building, x: 10.46, y: 1.88, w: 0.94, h: 0.94 }); // center 10.93
  s.addImage({ data: brain, x: 5.86, y: 1.55, w: 1.6, h: 1.6 });       // center 6.66 / 2.35

  const roleTitle = (t, x) => s.addText(t, { x, y: 2.82, w: 3.0, h: 0.34, fontSize: 18, bold: true, color: C.paper, align: "center", margin: 0, fontFace: "Microsoft JhengHei" });
  roleTitle("住戶", 0.92);
  roleTitle("物業", 9.43);
  s.addText([
    { text: "管理中心", options: { fontSize: 18, bold: true, color: C.paper } },
    { text: "　智能中樞", options: { fontSize: 13, color: C.gold } },
  ], { x: 4.9, y: 2.82, w: 3.53, h: 0.34, align: "center", margin: 0, fontFace: "Microsoft JhengHei" });

  s.addText("●  多元生活需求", { x: 0.92, y: 3.18, w: 3.0, h: 0.26, fontSize: 11, bold: true, color: C.resident, align: "center", margin: 0 });
  s.addText("●  駐點執行團隊", { x: 9.43, y: 3.18, w: 3.0, h: 0.26, fontSize: 11, bold: true, color: C.property, align: "center", margin: 0 });

  s.addText("用最自然的方式提出：\n說一句話、按一個鍵、掃一個碼",
    { x: 0.72, y: 3.44, w: 3.4, h: 0.5, fontSize: 10.5, color: C.muted, align: "center", lineSpacingMultiple: 1.1, margin: 0 });
  s.addText("進駐各社區，手機收到清楚派工，\n到場服務、即時回報",
    { x: 9.23, y: 3.44, w: 3.4, h: 0.5, fontSize: 10.5, color: C.muted, align: "center", lineSpacingMultiple: 1.1, margin: 0 });
  s.addText("建商打造的住宅管理大腦\n聽懂需求 · 自動判斷 · 智能調度",
    { x: 4.7, y: 3.18, w: 3.93, h: 0.5, fontSize: 11, color: C.capt, align: "center", lineSpacingMultiple: 1.15, margin: 0 });

  // ---------- 三場景卡片 ----------
  const cardY = 4.46, cardH = 2.56, cardW = 2.40, gap = 0.16, x0 = 0.34;
  const scenes = [
    { no: "1", t1: "口說設備", t2: "　說一句話就完成",
      steps: [[ic.mic, "住戶口說\n「冷氣壞了」"], [ic.target, "大腦聽懂\n建立報修工單"], [ic.check, "物業到府\n維修並回報"]],
      ex: [{ text: "情境：對", b: 0 }, { text: "智能音箱", b: 1 }, { text: "說一句話即派工，LINE 補單、免裝 App。", b: 0 }] },
    { no: "2", t1: "電梯禮賓", t2: "　一句話到門口",
      steps: [[ic.mic, "住戶說\n「我要下樓」"], [ic.elevator, "大腦呼叫電梯\n升到你樓層"], [ic.door, "到門口\n正好開門"]],
      ex: [{ text: "情境：出門前一句話，電梯", b: 0 }, { text: "預先升到你樓層", b: 1 }, { text: "，到門口正好開門。", b: 0 }] },
    { no: "3", t1: "機器人派送", t2: "　包裹自己會走",
      steps: [[ic.mic, "住戶說\n「寄放包裹」"], [ic.robot, "大腦派出\n配送機器人"], [ic.box, "到府取件\n送達管理室"]],
      ex: [{ text: "情境：一句話叫出", b: 0 }, { text: "配送機器人", b: 1 }, { text: "，到府取件、自動送達管理室。", b: 0 }] },
    { no: "4", t1: "智能生活", t2: "　動口不動手",
      steps: [[ic.gridplus, "預約公設\n包裹 · 訪客"], [ic.clock, "大腦排程\n連動 IoT 設備"], [ic.activity, "準時就緒\n主動通知"]],
      ex: [{ text: "情境：預約公設，大腦", b: 0 }, { text: "自動排程", b: 1 }, { text: "連動 IoT，準時就緒才通知你。", b: 0 }] },
    { no: "5", t1: "任務分派", t2: "　大腦自動調度",
      steps: [[ic.lines, "多筆需求\n同時湧入"], [ic.network, "判斷優先級\n就近指派"], [ic.shield, "進度可追蹤\n結案存證"]],
      ex: [{ text: "情境：多筆需求湧入，", b: 0 }, { text: "就近指派", b: 1 }, { text: "合適人員，進度全程可追蹤。", b: 0 }] },
  ];

  scenes.forEach((sc, i) => {
    const cx = x0 + i * (cardW + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: cx, y: cardY, w: cardW, h: cardH, rectRadius: 0.12,
      fill: { color: C.cardFill, transparency: 22 }, line: { color: C.gold, width: 0.75, transparency: 60 },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.3 },
    });
    // 編號
    s.addShape(pres.shapes.OVAL, { x: cx + 0.18, y: cardY - 0.16, w: 0.34, h: 0.34, fill: { color: C.gold },
      shadow: { type: "outer", color: "000000", blur: 5, offset: 2, angle: 90, opacity: 0.4 } });
    s.addText(sc.no, { x: cx + 0.18, y: cardY - 0.16, w: 0.34, h: 0.34, fontSize: 13, bold: true, color: "1a1304", align: "center", valign: "middle", margin: 0 });
    // 標題
    s.addText([
      { text: sc.t1, options: { bold: true, color: C.paper, fontSize: 12.5 } },
      { text: sc.t2, options: { color: C.goldSoft, fontSize: 9.5 } },
    ], { x: cx + 0.54, y: cardY + 0.12, w: cardW - 0.6, h: 0.4, valign: "middle", margin: 0, fontFace: "Microsoft JhengHei" });

    // 步驟
    const centers = [cx + 0.46, cx + cardW / 2, cx + cardW - 0.46];
    const arrowsX = [cx + 0.83, cx + 1.57];
    centers.forEach((c, k) => {
      s.addImage({ data: sc.steps[k][0], x: c - 0.21, y: cardY + 0.74, w: 0.42, h: 0.42 });
      s.addText(sc.steps[k][1], { x: c - 0.35, y: cardY + 1.24, w: 0.70, h: 0.54, fontSize: 8, color: C.capt, align: "center", lineSpacingMultiple: 1.0, margin: 0 });
    });
    arrowsX.forEach((ax) => s.addText("→", { x: ax - 0.11, y: cardY + 0.72, w: 0.22, h: 0.5, fontSize: 12, color: C.gold, align: "center", valign: "middle", margin: 0 }));

    // 分隔線 + 情境
    s.addShape(pres.shapes.LINE, { x: cx + 0.18, y: cardY + 1.96, w: cardW - 0.36, h: 0, line: { color: C.gold, width: 0.5, dashType: "dash", transparency: 55 } });
    s.addText(sc.ex.map((p) => ({ text: p.text, options: { color: p.b ? C.goldSoft : C.muted, bold: !!p.b } })),
      { x: cx + 0.18, y: cardY + 2.02, w: cardW - 0.36, h: 0.48, fontSize: 8.5, lineSpacingMultiple: 1.04, margin: 0 });
  });

  // ---------- Footer ----------
  s.addText("高級住宅・智慧管理應用場景",
    { x: 0.6, y: 7.12, w: 5, h: 0.3, fontSize: 10.5, color: C.cardMute, margin: 0 });
  s.addText("住戶提出 → 管理中心理解 → 物業執行 → 回饋住戶　｜　同一顆大腦，五種場景",
    { x: 6.0, y: 7.12, w: 6.73, h: 0.3, fontSize: 10.5, color: C.cardMute, align: "right", margin: 0 });

  // ============ Slide 3 · 建商價值說帖（首案無實績，以價值邏輯帶過，不掛數字）============
  const r = pres.addSlide();
  r.background = { data: bgPlain };
  r.addText("WHY IT MATTERS TO DEVELOPERS",
    { x: 0.6, y: 0.36, w: 9, h: 0.3, fontSize: 11, color: C.gold, bold: true, charSpacing: 3, margin: 0 });
  r.addText("智慧化 ＝ 建案的硬實力",
    { x: 0.58, y: 0.6, w: 9.3, h: 0.62, fontSize: 27, bold: true, color: C.paper, margin: 0, fontFace: "Microsoft JhengHei" });
  r.addText("首案出發 — 先講清楚價值邏輯，量化數據隨導入逐案校準",
    { x: 0.6, y: 1.28, w: 9.6, h: 0.4, fontSize: 13, color: C.muted, margin: 0 });
  r.addText([
    { text: "對建商的價值\n", options: { color: C.muted, fontSize: 11.5 } },
    { text: "溢價 · 去化 · 降本 · 品牌", options: { color: C.goldSoft, fontSize: 12, bold: true } },
  ], { x: 9.4, y: 0.58, w: 3.33, h: 0.8, align: "right", lineSpacingMultiple: 1.25, margin: 0 });

  const pillars = [
    { ic: ic.up,   tag: "單價溢價", head: "定價的支點", body: "把可體驗的智能規格寫進建案賣點，支撐每坪定價的議價力。", col: C.goldSoft },
    { ic: ic.bolt, tag: "去化加速", head: "好說的故事", body: "接待中心多一個能現場演示的成交理由，縮短猶豫期。", col: C.resident },
    { ic: ic.coin, tag: "物管降本", head: "數位化派工", body: "報修、派工、回報全程上線，減少人力往返與紙本作業。", col: C.property },
    { ic: ic.star, tag: "品牌資產", head: "口碑的來源", body: "從『有人管理』升級為主動服務，交屋後沉澱為社區口碑。", col: C.goldSoft },
  ];
  const sY = 2.2, sH = 2.74, sW = 2.72, sGap = 0.35, sx0 = 0.7;
  pillars.forEach((pl, i) => {
    const cx = sx0 + i * (sW + sGap);
    r.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: sY, w: sW, h: sH, rectRadius: 0.12,
      fill: { color: C.cardFill, transparency: 18 }, line: { color: C.gold, width: 0.75, transparency: 55 },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.3 } });
    r.addImage({ data: pl.ic, x: cx + sW/2 - 0.31, y: sY + 0.32, w: 0.62, h: 0.62 });
    r.addText(pl.head, { x: cx, y: sY + 1.06, w: sW, h: 0.5, fontSize: 21, bold: true, color: pl.col, align: "center", valign: "middle", margin: 0, fontFace: "Microsoft JhengHei" });
    r.addText(pl.tag, { x: cx, y: sY + 1.6, w: sW, h: 0.3, fontSize: 12, bold: true, color: C.muted, align: "center", charSpacing: 2, margin: 0 });
    r.addShape(pres.shapes.LINE, { x: cx + 0.55, y: sY + 1.96, w: sW - 1.1, h: 0, line: { color: C.gold, width: 0.5, dashType: "dash", transparency: 50 } });
    r.addText(pl.body, { x: cx + 0.22, y: sY + 2.04, w: sW - 0.44, h: 0.62, fontSize: 10.5, color: C.capt, align: "center", lineSpacingMultiple: 1.12, margin: 0 });
  });

  // 說帖收尾 band
  r.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 5.28, w: 11.93, h: 1.06, rectRadius: 0.1,
    fill: { color: "14253f", transparency: 10 }, line: { color: C.gold, width: 0.75, transparency: 55 } });
  r.addImage({ data: ic.star, x: 1.04, y: 5.58, w: 0.5, h: 0.5 });
  r.addText([
    { text: "為什麼是現在　", options: { fontSize: 15, bold: true, color: C.goldSoft } },
    { text: "建商的先行者紅利", options: { fontSize: 15, bold: true, color: C.paper } },
  ], { x: 1.78, y: 5.44, w: 10.6, h: 0.36, valign: "middle", margin: 0, fontFace: "Microsoft JhengHei" });
  r.addText("智慧住宅正從『加分項』走向『必選項』。首案導入即建立規格話語權與營運數據，讓下一案直接帶著標準與籌碼上桌。",
    { x: 1.78, y: 5.86, w: 10.6, h: 0.4, fontSize: 11.5, color: C.muted, lineSpacingMultiple: 1.1, margin: 0 });

  // caveat + footer
  r.addText("※ 本頁為價值主張與作用機制說明；本案為平台首發落地，量化效益將隨首案試營運逐案建立。",
    { x: 0.7, y: 6.62, w: 12, h: 0.3, fontSize: 10, italic: true, color: C.cardMute, margin: 0 });
  r.addText("高級住宅・智慧管理平台 ── 建商價值說帖", { x: 0.6, y: 7.12, w: 6, h: 0.3, fontSize: 10.5, color: C.cardMute, margin: 0 });
  r.addText("住戶體驗 → 建案賣點 → 銷售溢價與管理降本", { x: 6.0, y: 7.12, w: 6.73, h: 0.3, fontSize: 10.5, color: C.cardMute, align: "right", margin: 0 });

  // ⚠️ 注意：committed 的 ../應用場景_V2.pptx 含「手動 PowerPoint 修改」，本腳本未涵蓋。
  //    重新執行 build 會覆蓋那些手改 —— 要保留請先備份或先把手改回填進本腳本。
  await pres.writeFile({ fileName: "../應用場景_V2.pptx" });
  console.log("written ../應用場景_V2.pptx (3 slides) — WARNING: overwrites manual edits");
})();
