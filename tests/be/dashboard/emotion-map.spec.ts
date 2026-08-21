import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — /v1/dashboard/emotion-map
 *
 * Endpoint mengembalikan distribusi emotion dari post yang difilter
 * oleh keyword, platform, dan period.
 *
 * Response (BE deployed 2026-08-21):
 *   GET /v1/dashboard/emotion-map?keyword=&platform=&period=
 *   Response: { data: [{ emotion, pct, color }], meta: { generated_at } }
 *
 * CATATAN: Response berubah dari flat object { anger, neutral, ... }
 *    menjadi array of objects [{ emotion: "joy", pct: 19, color: "#..." }].
 *    Data sudah terisi (NLP pipeline aktif).
 */

interface EmotionItem {
  emotion: string;
  pct: number;
  color: string;
}

test.describe('GET /v1/dashboard/emotion-map', () => {
  test('tanpa filter → 200, data berupa array of emotion items', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    // BE CHANGE: data sekarang array, bukan flat object
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    for (const item of body.data) {
      expect(typeof item.emotion).toBe('string');
      expect(item.emotion.length).toBeGreaterThan(0);
      expect(typeof item.pct).toBe('number');
      expect(item.pct).toBeGreaterThanOrEqual(0);
      expect(typeof item.color).toBe('string');
    }
  });

  test('semua pct values non-negatif & ada emotion types', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const emotions = body.data.map((i: EmotionItem) => i.emotion);
    // BE mengembalikan minimal beberapa emotion type
    expect(emotions.length).toBeGreaterThan(0);
    for (const item of body.data) {
      expect(item.pct).toBeGreaterThanOrEqual(0);
    }
  });

  test('generated_at berupa ISO timestamp yang valid', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const ts = new Date(body.meta.generated_at);
    expect(ts.getTime()).not.toBeNaN();
  });

  test('filter keyword → 200 & data array', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?keyword=RUU+Digital'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('filter platform → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('filter period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?period=7d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('filter period=3d → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?period=3d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  test('filter period=1y → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?period=1y'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  test('platform multi (comma-separated) → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?platform=tiktok,x'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('keyword tanpa data → 200 dengan data array (bisa kosong)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?keyword=keyword_tidak_ada_xyz'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    // BE: keyword tidak ada → data kosong atau semua 0
  });

  test('period tidak valid → 200 (fallback, bukan 400)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?period=XYZ'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
