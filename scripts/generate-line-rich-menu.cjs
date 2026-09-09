const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const entries = [
    ['預約公設', '選設施・日期・時段', 'gym', 'facilities'],
    ['查空時段', '先看看還有哪些名額', 'calendar', 'availability'],
    ['我的預約', '查看預約與歷史紀錄', 'records', 'bookings'],
    ['訪客登記', '安排親友來訪', 'visitors', 'visitorRegister'],
    ['報修服務', '報修・反映・查進度', 'service', 'services'],
    ['服務首頁', '行事曆與更多服務', 'portal', 'home'],
  ];
  const output = path.resolve('public/line-menu');
  await fs.mkdir(output, {recursive:true});
  const tiles = await Promise.all(entries.map(async ([label,description,icon],index) => {
    const x=(index%3)*400, y=Math.floor(index/3)*405;
    const primary=index===0;
    const source=await fs.readFile(`public/line-icons/${icon}.svg`,'utf8');
    const inner=source.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
    return `<g transform="translate(${x} ${y})">
      <rect x="7" y="7" width="386" height="391" rx="20" fill="${primary?'#24221F':'#F5F2EB'}"/>
      <svg x="144" y="55" width="112" height="112" viewBox="0 0 28 28">${inner}</svg>
      <text x="200" y="245" text-anchor="middle" font-size="48" font-weight="700" fill="${primary?'#E8D7B4':'#24221F'}">${label}</text>
      <text x="200" y="310" text-anchor="middle" font-size="25" fill="${primary?'#E5E0D7':'#626262'}">${description}</text>
    </g>`;
  }));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="810" viewBox="0 0 1200 810"><rect width="1200" height="810" fill="#FFFFFF"/><g font-family="Microsoft JhengHei, Noto Sans CJK TC, sans-serif">${tiles.join('')}</g></svg>`;
  await fs.writeFile(path.join(output,'community.svg'),svg);
  await sharp(Buffer.from(svg)).png().toFile(path.join(output,'community.png'));
  const menu={size:{width:1200,height:810},selected:true,name:'MAI Touch community v1',chatBarText:'社區服務',areas:entries.map(([label,,,nav],index)=>({
    bounds:{x:(index%3)*400,y:Math.floor(index/3)*405,width:400,height:405},
    action:{type:'postback',label,data:`nav=${nav}`,displayText:label},
  }))};
  await fs.writeFile(path.join(output,'community.json'),JSON.stringify(menu,null,2)+'\n');
  console.log('Generated LINE menu SVG, PNG and matching touch areas.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
