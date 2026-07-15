/* 由純向量 SVG 組成 pptx：每頁 = 一張滿版 SVG（向量），並附高解析 PNG 後援確保各家軟體都能顯示。
   輸出 ../推薦硬體配置清單.pptx（5 頁）。來源：../svg/slide-1..5.svg */
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

(async () => {
  const svgDir = path.join(__dirname, "..", "svg");
  const pres = new pptxgen();
  pres.defineLayout({ name: "S169", width: 13.333, height: 7.5 });
  pres.layout = "S169";
  pres.author = "智慧住宅管理平台";
  pres.title = "推薦硬體配置清單";

  const mode = process.argv[2] === "svg" ? "svg" : "png";
  for (let i = 1; i <= 5; i++) {
    const svgBuf = fs.readFileSync(path.join(svgDir, `slide-${i}.svg`));
    const slide = pres.addSlide();
    if (mode === "svg") {
      // 直接內嵌向量 SVG（PowerPoint 2016+ 原生支援；部分檢視器需光柵後援）
      slide.addImage({ data: "image/svg+xml;base64," + svgBuf.toString("base64"), x: 0, y: 0, w: 13.333, h: 7.5 });
    } else {
      // 由向量 SVG 高解析重繪（2600px ≈ 195dpi）滿版底圖，任何檢視器皆可顯示
      const png = await sharp(svgBuf, { density: 200 }).resize(2600, 1463).png().toBuffer();
      slide.addImage({ data: "image/png;base64," + png.toString("base64"), x: 0, y: 0, w: 13.333, h: 7.5 });
    }
  }

  const out = `../推薦硬體配置清單_向量${mode === "svg" ? "SVG" : ""}.pptx`;
  await pres.writeFile({ fileName: out });
  console.log(`written ${out} (5 頁, mode=${mode})`);
})();
