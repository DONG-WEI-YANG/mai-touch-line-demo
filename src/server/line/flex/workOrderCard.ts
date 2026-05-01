import type { Lang } from '../ai/types';
import { t } from './i18n';

export function workOrderCard(
  input: { orderId: string; from: string; intent: string; summary: string },
  lang: Lang
) {
  return {
    type: 'flex',
    altText: `${t('workorder.new.title', lang)}: ${input.orderId}`,
    contents: {
      type: 'bubble',
      header: { type:'box', layout:'vertical', backgroundColor:'#C9A96E', paddingAll:'12px',
        contents: [{ type:'text', text:`🛎️ ${t('workorder.new.title', lang)}`, color:'#1a1a1a', weight:'bold' }] },
      body: { type:'box', layout:'vertical', spacing:'sm', contents: [
        { type:'text', text:`#${input.orderId}`, weight:'bold' },
        { type:'text', text:`${t('workorder.new.from', lang)}: ${input.from}`, size:'sm', color:'#666666' },
        { type:'text', text: input.summary, wrap: true, margin:'md' },
      ] },
      footer: { type:'box', layout:'horizontal', spacing:'xs', contents: [
        { type:'button', style:'primary', color:'#C9A96E',
          action:{ type:'postback', label: t('workorder.new.btn.accept', lang),
                   data: `act=accept&wo=${input.orderId}` } },
        { type:'button', style:'secondary',
          action:{ type:'postback', label: t('workorder.new.btn.reassign', lang),
                   data: `act=reassign&wo=${input.orderId}` } },
        { type:'button', style:'secondary',
          action:{ type:'postback', label: t('workorder.new.btn.reject', lang),
                   data: `act=reject&wo=${input.orderId}` } },
      ] },
    },
  } as const;
}
