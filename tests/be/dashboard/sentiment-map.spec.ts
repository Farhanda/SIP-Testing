import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — /v1/dashboard/sentiment-map
 *
 * Endpoint mengembalikan distribusi sentiment (Positive, Neutral, Negative)
 * dari post yang difilter oleh keyword, platform, dan period.
 *
 * Response (BE deployed 2026-08-21):
 *   GET /v1/dashboard/sentiment-map?keyword=&platform=&period=
 *   Response: { data: [{ sentiment, pct, color }], meta: { generated_at } }
 *
 * CATATAN: Response berubah dari flat object { positive, neutral, negative }
 *    menjadi array of objects [{ sentiment: "Others", pct: 100, color: "#..." }].
 */

interface SentimentItem {
  sentiment: string;
  pct: number;
  color: string;
}

test.describe('GET /v1/dashboard/sentiment-map', () => {
  test('tanpa filter → 200, data berupa array of sentiment items', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    // BE CHANGE: data sekarang array, bukan flat object
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    for (const item of body.data) {
      expect(typeof item.sentiment).toBe('string');
      expect(item.sentiment.length).toBeGreaterThan(0);
      expect(typeof item.pct).toBe('number');
      expect(item.pct).toBeGreaterThanOrEqual(0);
      expect(typeof item.color).toBe('string');
    }
  });

  test('semua pct values non-negatif', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.pct).toBeGreaterThanOrEqual(0);
    }
  });

  test('generated_at berupa ISO timestamp yang valid', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const ts = new Date(body.meta.generated_at);
    expect(ts.getTime()).not.toBeNaN();
  });

  test('filter keyword → 200 & data array', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?keyword=RUU+Digital'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('filter platform → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('filter period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?period=7d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
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
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('keyword tanpa data → 200 dengan data array', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?keyword=keyword_tidak_ada_xyz'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('period tidak valid → 200 (fallback, bukan 400)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map?period=XYZ'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
