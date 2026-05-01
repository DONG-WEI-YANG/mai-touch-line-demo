import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { mountWebhook } from '../../src/server/line/webhook';

const SECRET = 'test-secret';
process.env.LINE_CHANNEL_SECRET = SECRET;

const sign = (body: string) => crypto.createHmac('sha256', SECRET).update(body).digest('base64');
const makeBody = (events: any[]) => JSON.stringify({ events });

describe('POST /line/webhook', () => {
  let app: express.Express;
  let dispatchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatchSpy = vi.fn().mockResolvedValue(undefined);
    app = express();
    mountWebhook(app, { dispatch: dispatchSpy });
  });

  it('returns 200 for valid signature', async () => {
    const body = makeBody([{ type: 'message', message: { type:'text', text:'hi' } }]);
    const res = await request(app).post('/line/webhook')
      .set('X-Line-Signature', sign(body)).set('Content-Type','application/json').send(body);
    expect(res.status).toBe(200);
  });

  it('returns 401 for invalid signature', async () => {
    const body = makeBody([]);
    const res = await request(app).post('/line/webhook')
      .set('X-Line-Signature', 'wrong').set('Content-Type','application/json').send(body);
    expect(res.status).toBe(401);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('calls dispatch with parsed events', async () => {
    const events = [{ type:'message', message:{type:'text',text:'hi'} }];
    const body = makeBody(events);
    await request(app).post('/line/webhook')
      .set('X-Line-Signature', sign(body)).set('Content-Type','application/json').send(body);
    await new Promise(r => setImmediate(r));
    expect(dispatchSpy).toHaveBeenCalledWith(events);
  });
});
