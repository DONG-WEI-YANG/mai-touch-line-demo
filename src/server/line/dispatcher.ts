import { LineClient } from './line-client';

export type DispatchDeps = {
  lineClient: { reply: (token: string, msg: any) => Promise<void>; push: (userId: string, msg: any) => Promise<void> };
};

export async function dispatch(events: any[], deps: DispatchDeps): Promise<void> {
  for (const ev of events) {
    if (ev.type !== 'message' || ev.message?.type !== 'text') continue;
    const text = ev.message.text as string;
    await deps.lineClient.reply(ev.replyToken, { type: 'text', text: `echo: ${text}` });
  }
}

let defaultDeps: DispatchDeps | null = null;
export function getDefaultDispatchDeps(): DispatchDeps {
  if (defaultDeps) return defaultDeps;
  defaultDeps = {
    lineClient: new LineClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
      channelSecret:      process.env.LINE_CHANNEL_SECRET ?? '',
    }),
  };
  return defaultDeps;
}
