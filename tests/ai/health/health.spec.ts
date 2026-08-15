import { test, expect, aiApiUrl, aiHeaders } from '../fixtures';

/**
 * Health check AI Service — dari spec OpenAPI:
 *   GET /v1/health → 200 { status, provider_reachable, quota_remaining,
 *                          analysis_version, detail }
 *   - 401 bila token tidak valid / tidak dikirim
 *   - 503 bila provider AI tidak terjangkau (detail menjelaskan penyebab)
 *
 * Auth: header `X-Service-Token: dev-local-service-token` (dev lokal).
 */
test.describe('AI Service — Health', () => {
  test('GET /v1/health dengan token valid → 200, status ok & quota tersedia', async ({ api }) => {
    const res = await api.get(aiApiUrl('/v1/health'), { headers: aiHeaders() });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(['ok', 'degraded', 'down']).toContain(body.status);
    expect(body.status).toBe('ok');
    expect(typeof body.provider_reachable).toBe('boolean');
    // quota_remaining boleh null bila Redis tidak terjangkau (lihat 503),
    // tapi dalam kondisi normal harus ada object per kuota.
    if (body.quota_remaining) {
      expect(body.quota_remaining).toHaveProperty('production');
      expect(body.quota_remaining).toHaveProperty('qa');
    }
    expect(body.analysis_version).toEqual(expect.any(String));
  });

  test('GET /v1/health tanpa token → 401', async ({ api }) => {
    const res = await api.get(aiApiUrl('/v1/health'));
    expect(res.status()).toBe(401);
  });

  test('GET /v1/health dengan token salah → 401', async ({ api }) => {
    const res = await api.get(aiApiUrl('/v1/health'), { headers: { 'X-Service-Token': 'token-salah' } });
    expect(res.status()).toBe(401);
  });
});
