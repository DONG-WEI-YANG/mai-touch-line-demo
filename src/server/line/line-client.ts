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
        if (err?.statusCode !== 400) throw err;
        // 400 on reply = invalid/expired token — fall through to push
      }
    }
    await this.push(userId, msg);
  }
}
