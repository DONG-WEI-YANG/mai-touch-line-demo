import type { Lang } from '../ai/types';
import { t } from './i18n';

export function welcome(lang: Lang) {
  return {
    type: 'flex',
    altText: t('welcome.title', lang),
    contents: {
      type: 'bubble', size: 'mega',
      header: { type:'box', layout:'vertical', backgroundColor:'#1a1a1a', paddingAll:'16px',
        contents: [
          { type:'text', text: t('welcome.title', lang), color:'#C9A96E', weight:'bold', size:'lg', wrap: true },
          { type:'text', text: t('welcome.subtitle', lang), color:'#999999', size:'sm', margin:'sm', wrap: true },
        ] },
      footer: { type:'box', layout:'horizontal', spacing:'sm',
        contents: [
          { type:'button', style:'primary', color:'#C9A96E',
            action:{ type:'message', label: t('welcome.btn.start', lang), text:'/help' } },
          { type:'button', style:'secondary',
            action:{ type:'message', label: t('welcome.btn.demo', lang), text:'/demo list' } },
        ] },
    },
  } as const;
}
