import { slotMessage } from '../src/server/line/record-query';
import { readFileSync } from 'node:fs';
import { serviceHome, serviceActions, recordResult } from '../src/server/line/flex/serviceHome';
import { bookingDone } from '../src/server/line/flex/bookingDone';
import { facilityCarousel } from '../src/server/line/flex/facilityCarousel';
async function main() {
  const token=process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is required');
  const slots=Array.from({length:24},(_,i)=>({startTime:`${String(i).padStart(2,'0')}:00`,endTime:'23:59',remainingCapacity:20}));
  const groups=[
    [slotMessage(slots,'2026-09-12',0,{facility:'pool',readOnly:false}),slotMessage(slots,'2026-09-12',10,{facility:'pool',readOnly:true}),slotMessage([],'2026-09-12',0,{facility:'pool'})],
    [serviceHome('resident','zh-TW'),serviceHome('housekeeper','zh-TW'),serviceHome('admin','zh-TW')],
    [bookingDone({orderId:'BK-4'},'zh-TW'),facilityCarousel('zh-TW'),recordResult('BK-4｜泳池 預約已確認')],
    [serviceActions('報修與服務','點選下方按鈕開始操作。',[{type:'postback',label:'我要報修',data:'flow=repair.report'}],'services'),serviceActions('我的行事曆','查看預約歷史與服務紀錄。',[{type:'uri',label:'開啟行事曆與紀錄',uri:'https://mai-touch-history-20260908.web.app'}])],
    [serviceActions('報修服務｜1 / 3','請在訊息欄輸入問題並送出。',[{type:'postback',label:'取消填寫',data:'act=cancel'}],'services'),serviceActions('訪客登記','請輸入姓名。',[{type:'postback',label:'取消填寫',data:'act=cancel'}],'visitors')],
  ];
  for (const messages of groups) {
    const response=await fetch('https://api.line.me/v2/bot/message/validate/reply',{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messages}),signal:AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`LINE Flex validation ${response.status}: ${await response.text()}`);
    console.log(`Validated ${messages.length} LINE messages; none sent.`);
  }
  const response=await fetch('https://api.line.me/v2/bot/richmenu/validate',{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:readFileSync('public/line-menu/community.json','utf8'),signal:AbortSignal.timeout(25000),
  });
  if(!response.ok) throw new Error(`Rich menu validation ${response.status}: ${await response.text()}`);
  console.log('Rich menu object validated.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
