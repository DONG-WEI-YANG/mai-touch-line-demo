import type { Lang } from '../ai/types';
import { t } from './i18n';

export function bookingDone(input: { orderId: string }, lang: Lang) {
  return {
    type: 'flex',
    altText: `${t('booking.done.title', lang)} ${input.orderId}`,
    contents: {
      type: 'bubble',
      header: { type:'box', layout:'vertical', backgroundColor:'#0a5d0a', paddingAll:'12px',
        contents: [{ type:'text', text:`✅ ${t('booking.done.title', lang)}`, color:'#FFFFFF', weight:'bold' }] },
      body: { type:'box', layout:'vertical', spacing:'sm', contents: [
        { type:'text', text:`${t('booking.done.orderNo', lang)}: ${input.orderId}`, weight:'bold' },
      ] },
      footer: { type:'box', layout:'vertical', contents: [
        { type:'button', style:'primary', color:'#8B6C35', action:{type:'postback',label:'查看預約與關聯',data:`query=${encodeURIComponent('查詢 '+input.orderId)}`} },
        { type:'button', style:'secondary',
          action:{ type:'postback', label: t('booking.done.again', lang), data:'nav=facilities' } },
      ] },
    },
  } as const;
}
