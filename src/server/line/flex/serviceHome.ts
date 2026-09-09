import type { Lang } from '../ai/types';
import { t } from './i18n';
import { serviceIcon } from './serviceIcon';

type ShortcutContext = 'home' | 'booking' | 'services' | 'visitors';
export function homeQuickReply(context: ShortcutContext = 'home') {
  const links = context === 'booking' ? [['查空時段','availability'],['預約紀錄','bookings']]
    : context === 'services' ? [['工單進度','workorders'],['報修與服務','services']]
    : context === 'visitors' ? [['訪客與車號','visitors']] : [];
  return { items:[['服務首頁','home'],...links].map(([label,nav])=>({ type:'action', action:{ type:'postback', label, data:`nav=${nav}`, displayText:label } })) };
}
export function serviceHome(role: 'resident'|'housekeeper'|'admin', lang: Lang) {
  const staff=role!=='resident';
  const icons:Record<string,string>={facilities:'gym',availability:'calendar',bookings:'records',visitors:'visitors',visitorRegister:'visitors',workorders:'service',services:'service',portal:'portal'};
  const tiles = staff ? [
    ['公設空檔','依日期查看剩餘名額','availability'],
    ['空間預約','查詢住戶預約與關聯紀錄','bookings'],
    ['訪客與車號','查訪客通知及停車資料','visitors'],
    ['服務工單','查看報修與服務處理狀態','workorders'],
    ['管理後台','開啟已綁定帳戶的後台','portal'],
  ] : [
    ['預約公設','選設施、日期與可用時段','facilities'],
    ['查空時段','依日期查看剩餘名額','availability'],
    ['我的預約','查看歷史與關聯訪客／車號','bookings'],
    ['訪客登記','登記來訪姓名與時間','visitorRegister'],
    ['報修與服務','報修、反映問題、查進度','services'],
    ['我的行事曆','開啟住戶後台查看預約歷史','portal'],
  ];
  return { type:'flex', altText:staff ? '物業服務中心' : '住戶服務中心', quickReply:homeQuickReply(), contents:{
    type:'bubble',size:'giga',
    header:{type:'box',layout:'vertical',backgroundColor:'#1a1a1a',paddingAll:'20px',contents:[
      {type:'text',text:t('welcome.title',lang),color:'#C9A96E',weight:'bold',size:'lg',wrap:true},
      {type:'text',text:staff?'物業服務中心｜空間・訪客・工單':'住戶服務中心｜空間・訪客・生活',color:'#FFFFFF',size:'sm',margin:'md',wrap:true},
    ]},
    body:{type:'box',layout:'vertical',spacing:'sm',paddingAll:'16px',contents:Array.from({length:Math.ceil(tiles.length/2)},(_,row)=>({
      type:'box',layout:'horizontal',spacing:'sm',contents:tiles.slice(row*2,row*2+2).map(([title,description,nav])=>({
        type:'box',layout:'vertical',flex:1,spacing:'sm',paddingAll:'14px',backgroundColor:nav==='facilities'?'#E8D7B4':'#F5F2EB',cornerRadius:'8px',action:{type:'postback',data:`nav=${nav}`,displayText:title},contents:[
          {...serviceIcon(icons[nav],'36px'),align:'center'},
          {type:'text',text:title,color:'#202020',weight:'bold',size:'md',align:'center',wrap:true},
          {type:'text',text:description,color:'#626262',size:'xs',align:'center',wrap:true},
        ],
      })),
    }))},
    footer:{type:'box',layout:'vertical',paddingAll:'12px',contents:[
      {type:'text',text:staff?'點選上方項目，查詢與管理社區服務':'點選上方按鈕開始，也可展開下方「社區服務」選單',size:'xs',color:'#626262',wrap:true,align:'center'},
    ]},
  }};
}
export function serviceActions(title: string, description: string, actions: any[], context: ShortcutContext = 'home') {
  return {type:'flex',altText:title,quickReply:homeQuickReply(context),contents:{
    type:'bubble',
    body:{type:'box',layout:'vertical',spacing:'md',contents:[
      {type:'text',text:title,weight:'bold',size:'lg',color:'#202020'},
      {type:'text',text:description,wrap:true,size:'sm',color:'#626262'},
    ]},
    footer:{type:'box',layout:'vertical',spacing:'sm',contents:[
      ...actions.map((action,index)=>({type:'button',style:index===0?'primary':'secondary',...(index===0?{color:'#8B6C35'}:{}),action})),
      {type:'button',style:'link',color:'#626262',action:{type:'postback',label:'回服務首頁',data:'nav=home'}},
    ]},
  }};
}
export function recordResult(text: string): any {
  const rows=text.split('\n').filter(line=>/^(?:BK|V|P|WO)-\d+｜/.test(line));
  if (!rows.length) return {type:'text',text,quickReply:homeQuickReply()};
  const cards=rows.slice(0,10).map(line=>{
    const split=line.indexOf('｜');
    const ref=line.slice(0,split);
    return {type:'bubble',size:'kilo',body:{type:'box',layout:'vertical',spacing:'md',contents:[
      {type:'text',text:ref,color:'#8B6C35',weight:'bold',size:'lg'},
      {type:'text',text:line.slice(split+1),color:'#202020',wrap:true,size:'sm'},
    ]},footer:{type:'box',layout:'vertical',contents:[{type:'button',style:'secondary',action:{type:'postback',label:'查看關聯紀錄',data:`query=${encodeURIComponent('查詢 '+ref)}`}}]}};
  });
  const result={type:'flex',altText:`服務紀錄 ${rows.length} 筆`,contents:{type:'carousel',contents:cards},quickReply:homeQuickReply()};
  return rows.length>10 ? [result,{type:'text',text:'其餘紀錄：\n'+rows.slice(10).join('\n'),quickReply:homeQuickReply()}] : result;
}
