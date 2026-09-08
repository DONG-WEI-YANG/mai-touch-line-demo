import type { Lang } from '../ai/types';
import { t } from './i18n';

export function dateTimePicker(slot: 'date' | 'time', lang: Lang, now = new Date()) {
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = local.getUTCDay();
  const offsets = [0, 1, (6 - day + 7) % 7, (7 - day) % 7];
  const labels = lang === 'zh-TW' ? ['今天', '明天', '週六', '週日']
    : lang === 'ja' ? ['今日', '明日', '土曜日', '日曜日']
    : ['Today', 'Tomorrow', 'Saturday', 'Sunday'];
  const presets = slot === 'time'
    ? ['18:00','19:00','20:00','21:00'].map(value => ({ value, label: value }))
    : offsets.map((offset, i) => ({ value: new Date(local.getTime() + offset * 86400000).toISOString().slice(0, 10), label: labels[i] }));

  return {
    type: 'text',
    text: t(`ask.${slot}` as any, lang),
    quickReply: {
      items: [
        ...presets.map(p => ({
          type: 'action',
          action: { type: 'postback', label: p.label, data: `slot=${slot}&val=${p.value}`, displayText: p.label },
        })),
        { type: 'action',
          action: { type: 'datetimepicker',
                    label: lang === 'zh-TW' ? '其他' : 'Other',
                    data: `slot=${slot}&picker=1`,
                    mode: slot } },
      ],
    },
  } as const;
}
