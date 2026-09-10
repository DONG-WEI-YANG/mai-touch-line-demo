import type { LineClient } from '../line-client';
import type { Lang } from '../ai/types';
import { parsePostback } from '../postback';
import { t } from '../flex/i18n';
import { serviceActions } from '../flex/serviceHome';

export type HousekeeperDeps = {
  client: LineClient;
  updateOrder: (orderId: string, patch: {
    status: 'open'|'in_progress'|'resolved'|'closed';
    acceptedBy?: string;
    rejectedBy?: string;
  }) => Promise<void>;
  lineUser: { lineUserId: string; role: 'resident'|'housekeeper'|'admin'; language: Lang };
};

export async function handleHousekeeper(ev: any, deps: HousekeeperDeps): Promise<void> {
  if (ev.type !== 'postback') return;
  const p = parsePostback(ev.postback?.data ?? '');
  if (!p.wo) return;

  const lang = deps.lineUser.language;
  const userId = deps.lineUser.lineUserId;
  const reply = (text: string) => deps.client.replyOrPush(ev.replyToken, userId, { type: 'text', text });

  try {
    switch (p.act) {
      case 'accept':
        await deps.updateOrder(p.wo, { status: 'in_progress', acceptedBy: userId });
        await reply(`✅ ${p.wo} ${t('workorder.new.btn.accept', lang)}`);
        break;
      case 'reject':
        await deps.updateOrder(p.wo, { status: 'closed', rejectedBy: userId });
        await reply(`❌ ${p.wo} ${t('workorder.new.btn.reject', lang)}`);
        break;
      case 'reassign':
        await deps.client.replyOrPush(ev.replyToken, userId, serviceActions(
          '工單指派',
          `${p.wo} 尚未變更指派。請開啟管理後台，在工單管理選擇處理人員。`,
          [{ type: 'postback', label: '管理後台', data: 'nav=portal' }],
          'services',
        ));
        break;
      default:
        // unknown action — ignore
        break;
    }
  } catch (err) {
    console.error('[LINE] housekeeper handler error', { userId, wo: p.wo, act: p.act, err });
    await reply(t('msg.busy', lang));
  }
}
