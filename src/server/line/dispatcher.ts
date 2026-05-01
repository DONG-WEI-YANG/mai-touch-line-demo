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
