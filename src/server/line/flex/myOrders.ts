import type { Lang } from '../ai/types';
import { t } from './i18n';

export type MyOrderItem = { ref: string; label: string; detail: string; status: string };

/** Renders a resident's work orders + facility bookings as a plain-text list.
 *  Text (not flex) so it degrades gracefully for long lists and odd characters. */
export function myOrders(items: MyOrderItem[], lang: Lang) {
  if (items.length === 0) {
    return { type: 'text' as const, text: t('myorders.empty', lang) };
  }
  const lines = items.slice(0, 12).map(i => `• ${i.ref} ${i.label} — ${i.detail} (${i.status})`);
  const more = items.length > 12 ? `\n…(${items.length - 12}+)` : '';
  return {
    type: 'text' as const,
    text: `${t('myorders.title', lang)} (${items.length})\n${lines.join('\n')}${more}`,
  };
}
