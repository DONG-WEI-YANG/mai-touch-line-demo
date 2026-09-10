import { afterEach, expect, it, vi } from 'vitest';
import { offlineClient, offlineOwner } from '../src/lib/trpc';

afterEach(() => vi.unstubAllGlobals());
it('keeps the original Authorization credential when the account switches before batch dispatch', async () => {
  let token = 'account-A';
  vi.stubGlobal('localStorage', { getItem: () => token });
  const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: { data: { json: { ok: true } } } }]), { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  const owner = await offlineOwner();
  expect(owner).not.toBeNull();
  const client = await offlineClient(owner!);
  const request = client.bookings.cancel.mutate({ id: 1 });
  token = 'account-B';
  await request;
  const options = (fetchMock.mock.calls[0] as unknown as [unknown, RequestInit])[1];
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer account-A');
  expect(options.credentials).toBe('omit');
  await expect(offlineClient(owner!)).rejects.toThrow('原帳戶');
});
