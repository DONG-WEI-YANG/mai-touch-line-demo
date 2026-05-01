import type { Lang } from '../ai/types';
import { t } from './i18n';

export function dateTimePicker(slot: 'date' | 'time', lang: Lang) {
  const presets = slot === 'time'
    ? ['18:00','19:00','20:00','21:00']
    : ['today','tomorrow','this-saturday','this-sunday'];

  return {
    type: 'text',
    text: t(`ask.${slot}` as any, lang),
    quickReply: {
      items: [
        ...presets.map(p => ({
          type: 'action',
          action: { type: 'postback', label: p, data: `slot=${slot}&val=${p}`, displayText: p },
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
