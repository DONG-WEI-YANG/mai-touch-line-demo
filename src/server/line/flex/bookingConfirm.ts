import type { Lang } from '../ai/types';
import { t } from './i18n';

export function bookingConfirm(input: { facility: string; date: string; time: string }, lang: Lang) {
  const row = (label: string, value: string) => ({
    type: 'box', layout: 'baseline',
    contents: [
      { type:'text', text: label, color:'#999999', flex: 2 },
      { type:'text', text: value, weight:'bold', flex: 5, wrap: true },
    ],
  });
  return {
    type: 'flex',
    altText: `${t('booking.confirm.title', lang)}: ${input.facility} ${input.date} ${input.time}`,
    contents: {
      type: 'bubble', size: 'mega',
      header: { type:'box', layout:'vertical', backgroundColor:'#1a1a1a', paddingAll:'16px',
        contents: [{ type:'text', text: t('booking.confirm.title', lang), color:'#C9A96E', weight:'bold', size:'lg' }] },
      body: { type:'box', layout:'vertical', spacing:'md', contents: [
        row(t('booking.confirm.facility', lang), t(`facility.${input.facility}` as any, lang)),
        row(t('booking.confirm.date', lang), input.date),
        row(t('booking.confirm.time', lang), input.time),
      ] },
      footer: { type:'box', layout:'horizontal', spacing:'sm', contents: [
        { type:'button', style:'primary', color:'#C9A96E',
          action: { type:'postback', label: t('booking.btn.confirm', lang),
                    data: 'act=confirm&intent=facility.book', displayText: t('booking.btn.confirm', lang) } },
        { type:'button', style:'secondary',
          action: { type:'postback', label: t('booking.btn.edit', lang), data:'act=edit&intent=facility.book' } },
        { type:'button', style:'secondary',
          action: { type:'postback', label: t('booking.btn.cancel', lang), data:'act=cancel', displayText: t('booking.btn.cancel', lang) } },
      ] },
    },
  } as const;
}
