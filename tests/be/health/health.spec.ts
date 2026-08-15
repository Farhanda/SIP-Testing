import { test, expect, apiUrl } from '../fixtures';

/**
 * Health check API — dari Swagger (`/swagger/`):
 *   GET /health/live  → 200 { status: "live" }  (liveness)
 *   GET /health/ready → 200 { status: "ready" } (readiness; 503 bila belum siap)
 */
test.describe('Health API', () => {
  test('GET /health/live → 200 dengan status live', async ({ api }) => {
    const res = await api.get(apiUrl('/health/live'));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('live');
  });

  test('GET /health/ready → 200 dengan status ready', async ({ api }) => {
    const res = await api.get(apiUrl('/health/ready'));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ready');
  });
});
