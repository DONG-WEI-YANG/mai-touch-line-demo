import { expect,it } from 'vitest';
import { serviceHome,recordResult } from '../../src/server/line/flex/serviceHome';
import { facilityCarousel } from '../../src/server/line/flex/facilityCarousel';
it('uses postback navigation and SVG-derived HTTPS icons',()=>{
  const home=serviceHome('resident','zh-TW');
  expect(home.contents.body.contents).toHaveLength(3);
  expect(home.contents.body.contents.every(row=>row.contents.length===2)).toBe(true);
  expect(home.contents.body.contents.flatMap(row=>row.contents).every(c=>c.action.type==='postback')).toBe(true);
  expect(JSON.stringify(facilityCarousel('zh-TW'))).toContain('/line-icons/pool.png');
  expect(serviceHome('housekeeper','zh-TW').contents.body.contents.flatMap(row=>row.contents).some(c=>c.action.data==='nav=workorders')).toBe(true);
});
it('shows record cards with links and preserves overflow',()=>{
  const text=Array.from({length:12},(_,i)=>`BK-${i+1}｜泳池`).join('\n');
  const result=recordResult(text);
  expect(result[0].contents.contents).toHaveLength(10);
  expect(result[1].text).toContain('BK-12');
  expect(result[0].contents.contents[0].footer.contents[0].action.data).toContain('query=');
});
