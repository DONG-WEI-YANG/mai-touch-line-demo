import type { Lang } from '../ai/types';
import { t } from './i18n';
import { serviceIcon } from './serviceIcon';

const FACILITIES = ['gym','pool','meeting_room','lounge','bbq','sauna'] as const;

export function facilityCarousel(lang: Lang, availability = false) {
  return {
    type: 'flex',
    altText: t('ask.facility', lang),
    contents: {
      type: 'carousel',
      contents: FACILITIES.map(f => ({
        type: 'bubble', size: 'micro',
        body: { type:'box', layout:'vertical', spacing:'sm', paddingAll:'12px',
          contents: [
            serviceIcon(f),
            { type:'text', text: t(`facility.${f}` as any, lang), weight:'bold', align:'center', wrap:true },
          ] },
        footer: { type:'box', layout:'vertical',
          contents: [
            { type:'button', style:'primary', color:'#C9A96E', height:'sm',
              action:{ type:'postback', label: availability ? '查可用時段' : '選擇設施',
                       data: `act=${availability ? 'availability' : 'book'}&fac=${f}`, displayText: t(`facility.${f}` as any, lang) } },
          ] },
      })),
    },
  } as const;
}
