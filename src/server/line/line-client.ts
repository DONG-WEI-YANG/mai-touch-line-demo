import { Client } from '@line/bot-sdk';

export type LineClientOpts = { channelAccessToken: string; channelSecret: string; demoBanner?: boolean };

const BANNER = '🧪 [DEMO] ';

function applyBanner(msg: any, on?: boolean): any {
  if (!on || !msg) return msg;
  if (Array.isArray(msg)) return msg.map(m => applyBanner(m, on));
  if (msg.type === 'text' && typeof msg.text === 'string' && !msg.text.startsWith(BANNER)) {
    return { ...msg, text: BANNER + msg.text };
  }
  if (msg.type === 'flex' && typeof msg.altText === 'string' && !msg.altText.startsWith(BANNER)) {
    return { ...msg, altText: BANNER + msg.altText };
  }
  return msg;
}

export class LineClient {
  private sdk: Client;
  private demoBanner: boolean;
  constructor(opts: LineClientOpts) {
    this.sdk = new Client(opts);
    this.demoBanner = opts.demoBanner ?? false;
  }

  async reply(token: string, msg: any | any[]): Promise<void> {
    await this.sdk.replyMessage(token, applyBanner(msg, this.demoBanner));
  }
  async push(userId: string, msg: any | any[]): Promise<void> {
    await this.sdk.pushMessage(userId, applyBanner(msg, this.demoBanner));
  }
  async replyOrPush(replyToken: string | undefined, userId: string, msg: any | any[]): Promise<void> {
    if (replyToken) {
      try { await this.reply(replyToken, msg); return; }
      catch (err: any) {
        if (err?.statusCode !== 400) throw err;
        // 400 on reply = invalid/expired token — fall through to push
      }
    }
    await this.push(userId, msg);
  }
}
