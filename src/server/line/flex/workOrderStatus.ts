import type { Lang } from '../ai/types';
import { t } from './i18n';

type Order = { id: string; facility: string; date: string; time: string; status: 'pending'|'in_progress'|'done' };
const STATUS_COLOR: Record<Order['status'], string> = {
  pending: '#888888', in_progress: '#C9A96E', done: '#0a5d0a',
};

export function workOrderStatus(orders: Order[], lang: Lang) {
  if (orders.length === 0) {
    return { type: 'text', text: t('workorder.status.empty', lang) } as const;
  }
  return {
    type: 'flex',
    altText: t('workorder.status.title', lang),
    contents: {
      type: 'carousel',
      contents: orders.slice(0, 5).map(o => ({
        type: 'bubble', size: 'micro',
        body: { type:'box', layout:'vertical', spacing:'sm', contents: [
          { type:'text', text: `#${o.id}`, weight:'bold' },
          { type:'text', text: t(`facility.${o.facility}` as any, lang), size:'sm' },
          { type:'text', text: `${o.date} ${o.time}`, size:'xs', color:'#666666' },
          { type:'text', text: o.status, color: STATUS_COLOR[o.status], align:'end', size:'xs' },
        ] },
      })),
    },
  } as const;
}
