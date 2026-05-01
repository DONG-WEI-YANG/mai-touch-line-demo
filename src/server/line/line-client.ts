import { Client } from '@line/bot-sdk';

export type LineClientOpts = { channelAccessToken: string; channelSecret: string };

export class LineClient {
  private sdk: Client;
  constructor(opts: LineClientOpts) {
    // Call Client via Reflect.construct so it works both with the real SDK class
    // and with vi.fn() mocks that use arrow-function implementations (Vitest 4).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C = Client as any;
    try {
      this.sdk = Reflect.construct(C, [opts], C);
    } catch {
      // Vitest 4 vi.fn() + arrow mockImplementation: Reflect.construct still fails.
      // Fall back to plain call (works for vi.fn mocks, returns the mock object directly).
      this.sdk = C(opts);
    }
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
