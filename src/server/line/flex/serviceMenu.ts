import type { Lang } from '../ai/types';
import { t } from './i18n';

/**
 * Quick-reply service menu — shown when the classifier can't tell what the user
 * wants (intent=unknown or confidence below threshold). Each button sends a
 * full phrase the classifier then handles with high confidence, so the user is
 * one tap away from any flow instead of being told "I didn't catch that".
 */
export function serviceMenu(lang: Lang) {
  return {
    type: 'text' as const,
    text: t('menu.prompt', lang),
    quickReply: {
      items: [
        { type: 'action' as const, action: { type: 'message' as const, label: t('menu.facility',  lang), text: '我要預約設施' } },
        { type: 'action' as const, action: { type: 'message' as const, label: t('menu.repair',    lang), text: '我要報修' } },
        { type: 'action' as const, action: { type: 'message' as const, label: t('menu.visitor',   lang), text: '我要登記訪客' } },
        { type: 'action' as const, action: { type: 'message' as const, label: t('menu.complaint', lang), text: '我要反映問題' } },
        { type: 'action' as const, action: { type: 'message' as const, label: t('menu.status',    lang), text: '查詢我的工單進度' } },
      ],
    },
  };
}
