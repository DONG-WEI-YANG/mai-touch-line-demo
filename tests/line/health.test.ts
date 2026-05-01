import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app';
import { resetProfileCache } from '../../src/server/_core/profile';

describe('GET /health', () => {
  beforeEach(() => resetProfileCache());

  it('returns 200 with profile and uptime', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.profile).toMatch(/^(demo|prod)$/);
    expect(typeof res.body.uptime_s).toBe('number');
    expect(res.body.db).toBe('ok');
    expect(res.body.ai_provider).toMatch(/^(openai|nlp-service)$/);
  });
});
