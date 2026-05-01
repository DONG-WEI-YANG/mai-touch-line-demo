import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app';

describe('GET /health', () => {
  it('returns 200 with profile and uptime', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.profile).toMatch(/^(demo|prod)$/);
    expect(typeof res.body.uptime_s).toBe('number');
  });
});
