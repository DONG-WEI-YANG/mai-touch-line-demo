import type { Express, Request, Response } from 'express';
import express from 'express';
import { verifySignature } from './signature';

export type Dispatcher = { dispatch: (events: any[]) => Promise<void> };

export function mountWebhook(app: Express, deps: Dispatcher): void {
  app.post('/line/webhook',
    express.raw({ type: 'application/json' }),
    (req: Request, res: Response) => {
      const secret = process.env.LINE_CHANNEL_SECRET ?? '';
      const sig = (req.header('X-Line-Signature') ?? '').toString();
      const raw = (req.body as Buffer).toString('utf8');

      if (!verifySignature(raw, sig, secret)) {
        console.warn('[LINE] signature verification failed', { ip: req.ip });
        res.status(401).send('invalid signature');
        return;
      }

      let events: any[] = [];
      try { events = JSON.parse(raw).events ?? []; }
      catch { res.status(400).send('bad json'); return; }

      res.status(200).send('ok');
      setImmediate(() => {
        deps.dispatch(events).catch(err => console.error('[LINE] dispatch error', err));
      });
    }
  );
}
