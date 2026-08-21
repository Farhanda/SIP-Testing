import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — /v1/dashboard/emotion-map
 *
 * Endpoint mengembalikan distribusi emotion (Anger, Neutral, Fear, Joy,
 * Sadness) dari post yang difilter oleh keyword, platform, dan period.
 *
 * Kontrak Swagger:
 *   GET /v1/dashboard/emotion-map?keyword=&platform=&period=
 *   Response: { data: { anger, neutral, fear, joy, sadness }, meta: { generated_at } }
 *
 * ⚠️ CATATAN: Di deployed BE, semua emotion bernilai 0 karena
 *    NLP pipeline belum memproses emotion untuk post di seed data.
 *    Struktur response sudah benar; data kosong adalah kondisi saat ini.
 */

test.describe('GET /v1/dashboard/emotion-map', () => {
  test('tanpa filter → 200, data punya 5 emotion fields', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    const d = body.data;
    expect(typeof d.anger).toBe('number');
    expect(typeof d.neutral).toBe('number');
    expect(typeof d.fear).toBe('number');
    expect(typeof d.joy).toBe('number');
    expect(typeof d.sadness).toBe('number');
  });

  test('semua emotion values non-negatif', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.anger).toBeGreaterThanOrEqual(0);
    expect(body.data.neutral).toBeGreaterThanOrEqual(0);
    expect(body.data.fear).toBeGreaterThanOrEqual(0);
    expect(body.data.joy).toBeGreaterThanOrEqual(0);
    expect(body.data.sadness).toBeGreaterThanOrEqual(0);
  });

  /**
   * ⚠️ CATATAN: Semua emotion = 0 di deployed BE.
   *    NLP pipeline belum memproses emotion untuk post di seed data.
   *    Ini bukan bug struktural — endpoint berfungsi benar, hanya data kosong.
   */
  test('generated_at berupa ISO timestamp yang valid', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const ts = new Date(body.meta.generated_at);
    expect(ts.getTime()).not.toBeNaN();
  });

  test('filter keyword → 200 & struktur tetap valid', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?keyword=RUU+Digital'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.joy).toBe('number');
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('filter platform → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.anger).toBe('number');
  });

  test('filter period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?period=7d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.joy).toBe('number');
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
    expect(typeof body.data.joy).toBe('number');
  });

  test('keyword tanpa data → 200 dengan semua angka 0 (bukan 404)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?keyword=keyword_tidak_ada_xyz'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.anger).toBe(0);
    expect(body.data.neutral).toBe(0);
    expect(body.data.fear).toBe(0);
    expect(body.data.joy).toBe(0);
    expect(body.data.sadness).toBe(0);
  });

  test('period tidak valid → 200 (fallback, bukan 400)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/emotion-map?period=XYZ'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.joy).toBe('number');
  });
});
