import { Client } from '@line/bot-sdk';

export type LineClientOpts = {
  channelAccessToken: string;
  channelSecret: string;
  demoBanner?: boolean | (() => boolean);
  apiProxyUrl?: string;
};

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
  private demoBannerOpt: boolean | (() => boolean);

  constructor(private opts: LineClientOpts) {
    if (opts.apiProxyUrl && new URL(opts.apiProxyUrl).protocol !== 'https:') throw new Error('LINE relay must use HTTPS');
    this.sdk = new Client(opts);
    this.demoBannerOpt = opts.demoBanner ?? false;
  }

  private isBannerOn(): boolean {
    if (typeof this.demoBannerOpt === 'function') return this.demoBannerOpt();
    return this.demoBannerOpt;
  }

  async reply(token: string, msg: any | any[]): Promise<void> {
    if (this.opts.apiProxyUrl) return this.sendViaProxy('reply',{replyToken:token},msg);
    await this.sdk.replyMessage(token, applyBanner(msg, this.isBannerOn()));
  }
  async push(userId: string, msg: any | any[], retryKey?: string): Promise<void> {
    if (this.opts.apiProxyUrl || retryKey) return this.sendViaProxy('push',{to:userId},msg,retryKey);
    await this.sdk.pushMessage(userId, applyBanner(msg, this.isBannerOn()));
  }
  private async sendViaProxy(kind: 'reply' | 'push', recipient: object, msg: any | any[], retryKey?: string): Promise<void> {
    const messages=applyBanner(Array.isArray(msg)?msg:[msg],this.isBannerOn());
    const url=this.opts.apiProxyUrl ? new URL(`/_line/v2/bot/message/${kind}`,this.opts.apiProxyUrl).toString() : `https://api.line.me/v2/bot/message/${kind}`;
    const response=await fetch(url,{
      method:'POST',headers:{Authorization:`Bearer ${this.opts.channelAccessToken}`,'Content-Type':'application/json',...(retryKey?{'X-Line-Retry-Key':retryKey}:{})},
      body:JSON.stringify({...recipient,messages}),signal:AbortSignal.timeout(20000),redirect:'error',
    });
    if(!response.ok && !(retryKey && response.status===409 && response.headers.get('x-line-accepted-request-id'))) throw Object.assign(new Error(`LINE relay failed (HTTP ${response.status})`),{statusCode:response.status});
    await response.arrayBuffer();
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
