import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — /v1/dashboard/sentiment-map
 *
 * Endpoint mengembalikan distribusi sentiment (Positive, Neutral, Negative)
 * dari post yang difilter oleh keyword, platform, dan period.
 *
 * Kontrak Swagger:
 *   GET /v1/dashboard/sentiment-map?keyword=&platform=&period=
 *   Response: { data: { positive, neutral, negative }, meta: { generated_at } }
 */

test.describe('GET /v1/dashboard/sentiment-map', () => {
  test('tanpa filter → 200, data punya 3 sentiment fields', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    const d = body.data;
    expect(typeof d.positive).toBe('number');
    expect(typeof d.neutral).toBe('number');
    expect(typeof d.negative).toBe('number');
  });

  test('semua sentiment values non-negatif', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.positive).toBeGreaterThanOrEqual(0);
    expect(body.data.neutral).toBeGreaterThanOrEqual(0);
    expect(body.data.negative).toBeGreaterThanOrEqual(0);
  });

  test('generated_at berupa ISO timestamp yang valid', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const ts = new Date(body.meta.generated_at);
    expect(ts.getTime()).not.toBeNaN();
  });

  test('filter keyword → 200 & struktur tetap valid', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?keyword=RUU+Digital'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.positive).toBe('number');
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('filter platform → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.positive).toBe('number');
  });

  test('filter period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?period=7d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.positive).toBe('number');
  });

  test('filter period=3d → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?period=3d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  test('platform multi (comma-separated) → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?platform=tiktok,x'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.positive).toBe('number');
  });

  test('keyword tanpa data → 200 dengan semua angka 0', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?keyword=keyword_tidak_ada_xyz'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.positive).toBe(0);
    expect(body.data.neutral).toBe(0);
    expect(body.data.negative).toBe(0);
  });

  test('period tidak valid → 200 (fallback, bukan 400)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?period=XYZ'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.positive).toBe('number');
  });
});
