import type { Lang } from '../ai/types';
import { t } from './i18n';

export function bookingDone(input: { orderId: string }, lang: Lang) {
  return {
    type: 'flex',
    altText: `${t('booking.done.title', lang)} ${input.orderId}`,
    contents: {
      type: 'bubble',
      header: { type:'box', layout:'vertical', backgroundColor:'#0a5d0a', paddingAll:'12px',
        contents: [{ type:'text', text:`✅ ${t('booking.done.title', lang)}`, color:'#fff', weight:'bold' }] },
      body: { type:'box', layout:'vertical', spacing:'sm', contents: [
        { type:'text', text:`${t('booking.done.orderNo', lang)}: ${input.orderId}`, weight:'bold' },
      ] },
      footer: { type:'box', layout:'horizontal', contents: [
        { type:'button', style:'secondary',
          action:{ type:'message', label: t('booking.done.again', lang), text: t('ask.facility', lang) } },
      ] },
    },
  } as const;
}
