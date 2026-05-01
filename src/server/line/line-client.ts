import { Client } from '@line/bot-sdk';

export type LineClientOpts = { channelAccessToken: string; channelSecret: string };

export class LineClient {
  private sdk: Client;
  constructor(opts: LineClientOpts) {
    this.sdk = new Client(opts);
  }

  async reply(token: string, msg: any | any[]): Promise<void> {
    await this.sdk.replyMessage(token, msg);
  }
  async push(userId: string, msg: any | any[]): Promise<void> {
    await this.sdk.pushMessage(userId, msg);
  }
  async replyOrPush(replyToken: string | undefined, userId: string, msg: any | any[]): Promise<void> {
    if (replyToken) {
      try { await this.reply(replyToken, msg); return; }
      catch (err: any) {
        const expired = err?.statusCode === 400 && /reply token/i.test(err?.message ?? '');
        if (!expired) throw err;
      }
    }
    await this.push(userId, msg);
  }
}
