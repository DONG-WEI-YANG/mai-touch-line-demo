/**
 * Audit all Flex Message builders by serializing their output and pushing each
 * to the real LINE Push API. Surfaces any LINE-rejection issues (invalid
 * properties, missing fields, hex shorthands) BEFORE production deploy.
 *
 * Usage: LINE_CHANNEL_ACCESS_TOKEN=... TEST_USER_ID=U... tsx scripts/audit-line-flex.ts
 */
import 'dotenv/config';
import { welcome } from '../src/server/line/flex/welcome';
import { facilityCarousel } from '../src/server/line/flex/facilityCarousel';
import { dateTimePicker } from '../src/server/line/flex/dateTimePicker';
import { bookingConfirm } from '../src/server/line/flex/bookingConfirm';
import { bookingDone } from '../src/server/line/flex/bookingDone';
import { workOrderCard } from '../src/server/line/flex/workOrderCard';
import { workOrderStatus } from '../src/server/line/flex/workOrderStatus';

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const USER  = process.env.TEST_USER_ID;
if (!TOKEN || !USER) {
  console.error('Missing LINE_CHANNEL_ACCESS_TOKEN or TEST_USER_ID env');
  process.exit(1);
}

// Apply demo banner the same way LineClient does
const BANNER = '🧪 [DEMO] ';
function applyBanner(msg: any): any {
  if (msg.type === 'text' && typeof msg.text === 'string' && !msg.text.startsWith(BANNER)) {
    return { ...msg, text: BANNER + msg.text };
  }
  if (msg.type === 'flex' && typeof msg.altText === 'string' && !msg.altText.startsWith(BANNER)) {
    return { ...msg, altText: BANNER + msg.altText };
  }
  return msg;
}

const cases: Array<{ name: string; msg: any }> = [
  { name: 'welcome (zh-TW)',         msg: welcome('zh-TW') },
  { name: 'welcome (en)',            msg: welcome('en') },
  { name: 'welcome (ja)',            msg: welcome('ja') },
  { name: 'facilityCarousel (zh)',   msg: facilityCarousel('zh-TW') },
  { name: 'dateTimePicker date',     msg: dateTimePicker('date', 'zh-TW') },
  { name: 'dateTimePicker time',     msg: dateTimePicker('time', 'zh-TW') },
  { name: 'bookingConfirm',          msg: bookingConfirm({ facility:'gym', date:'2026-05-09', time:'19:00' }, 'zh-TW') },
  { name: 'bookingDone',             msg: bookingDone({ orderId:'BK-1' }, 'zh-TW') },
  { name: 'workOrderCard',           msg: workOrderCard({ orderId:'BK-1', from:'住戶 A', intent:'facility.book', summary:'gym 19:00' }, 'zh-TW') },
  { name: 'workOrderStatus empty',   msg: workOrderStatus([], 'zh-TW') },
  { name: 'workOrderStatus 3 items', msg: workOrderStatus([
      { id:'1', facility:'gym',  date:'2026-05-09', time:'19:00', status:'pending' as const },
      { id:'2', facility:'pool', date:'2026-05-10', time:'20:00', status:'in_progress' as const },
      { id:'3', facility:'bbq',  date:'2026-05-11', time:'18:00', status:'done' as const },
    ], 'zh-TW') },
];

async function pushOne(name: string, msg: any) {
  const wrapped = applyBanner(msg);
  const body = { to: USER, messages: [wrapped] };
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (r.ok) {
    console.log(`[OK]   ${name.padEnd(28)}  status=${r.status}`);
  } else {
    console.log(`[FAIL] ${name.padEnd(28)}  status=${r.status}  body=${text.slice(0, 250)}`);
  }
  return r.ok;
}

async function main() {
  const results: Array<[string, boolean]> = [];
  for (const c of cases) {
    const ok = await pushOne(c.name, c.msg);
    results.push([c.name, ok]);
    await new Promise(r => setTimeout(r, 800)); // gentle pacing
  }
  const failed = results.filter(([, ok]) => !ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    console.log('failed:', failed.map(([n]) => n).join(', '));
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
