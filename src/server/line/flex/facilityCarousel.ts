import type { Lang } from '../ai/types';
import { t } from './i18n';

const FACILITIES = ['gym','pool','meeting_room','lounge','bbq','sauna'] as const;
const ICONS: Record<typeof FACILITIES[number], string> = {
  gym:'🏋️', pool:'🏊', meeting_room:'💼', lounge:'🛋️', bbq:'🔥', sauna:'♨️',
};

export function facilityCarousel(lang: Lang) {
  return {
    type: 'flex',
    altText: t('ask.facility', lang),
    contents: {
      type: 'carousel',
      contents: FACILITIES.map(f => ({
        type: 'bubble', size: 'micro',
        body: { type:'box', layout:'vertical', spacing:'sm', paddingAll:'12px',
          contents: [
            { type:'text', text: ICONS[f], size:'xxl', align:'center' },
            { type:'text', text: t(`facility.${f}` as any, lang), weight:'bold', align:'center', wrap:true },
          ] },
        footer: { type:'box', layout:'vertical',
          contents: [
            { type:'button', style:'primary', color:'#C9A96E', height:'sm',
              action:{ type:'postback', label: t('booking.btn.confirm', lang),
                       data: `act=book&fac=${f}`, displayText: t(`facility.${f}` as any, lang) } },
          ] },
      })),
    },
  } as const;
}
