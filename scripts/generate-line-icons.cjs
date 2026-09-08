const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
const drawings={
  gym:'<path d="M8 9v6m3-8v10m10-8v6m-3-8v10M11 12h7"/>',
  pool:'<path d="M4 18q3-3 6 0t6 0t6 0M4 22q3-3 6 0t6 0t6 0M9 15V6a2 2 0 0 1 4 0m3 9V6a2 2 0 0 1 4 0M9 9h7m-7 4h7"/>',
  meeting_room:'<rect x="5" y="9" width="18" height="8" rx="2"/><path d="M9 5v2m10-2v2M9 19v3m10-3v3M7 17v5m14-5v5"/>',
  lounge:'<path d="M7 13V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M5 12a2 2 0 0 1 2 2v2h14v-2a2 2 0 0 1 4 0v6H3v-6a2 2 0 0 1 2-2Zm2 8v3m14-3v3"/>',
  bbq:'<path d="M6 12h16a8 8 0 0 1-16 0Zm4 7-3 5m11-5 3 5M10 8c-3-3 3-3 0-6m8 6c-3-3 3-3 0-6"/>',
  sauna:'<path d="M5 16h18v7H5Zm4-4c-4-4 4-4 0-8m5 8c-4-4 4-4 0-8m5 8c-4-4 4-4 0-8"/>',
  calendar:'<rect x="4" y="6" width="20" height="18" rx="2"/><path d="M9 3v6m10-6v6M4 12h20M9 17h2m5 0h2m-9 4h2"/>',
  records:'<rect x="6" y="4" width="16" height="21" rx="2"/><path d="M10 10h8m-8 5h8m-8 5h5"/>',
  visitors:'<circle cx="11" cy="9" r="4"/><path d="M3 24v-3a8 8 0 0 1 16 0v3m1-19a4 4 0 0 1 0 8m3 11v-3a8 8 0 0 0-3-6"/>',
  car:'<path d="m5 11 2-6h14l2 6m-18 0h18v10H5Zm0 10v3m18-3v3M8 16h2m8 0h2"/>',
  service:'<path d="m16 5 1 5 5 1a7 7 0 0 1-8 7l-7 7-4-4 7-7a7 7 0 0 1 6-9Z"/>',
  portal:'<path d="M5 24V5h13v19M2 24h24m-8-14h6v14M9 9h5m-5 5h5m-5 5h5"/>',
};
(async()=>{
  const dir=path.resolve(__dirname,'../public/line-icons');
  await fs.mkdir(dir,{recursive:true});
  for(const [name,drawing] of Object.entries(drawings)){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 28 28"><rect width="28" height="28" rx="5" fill="#F5F2EB"/><g fill="none" stroke="#8B6C35" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${drawing}</g></svg>`;
    await fs.writeFile(path.join(dir,name+'.svg'),svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(dir,name+'.png'));
  }
  console.log('Generated 12 SVG originals and LINE PNG icons');
})();
