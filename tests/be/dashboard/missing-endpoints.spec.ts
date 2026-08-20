import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — endpoint yang sebelumnya GAP (404) kini SUDAH
 * diimplementasikan di dashboard-service (Go, port 8080).
 *
 * Audit integrasi FE↔BE 2026-08-18: 5 endpoint dipanggil FE tapi tidak
 * ada di router Go → semua 404. Pada 2026-08-20, keenamnya sudah aktif.
 * Test ini diupdate menjadi regression guard (ekspektasi 200 + struktur).
 *
 *   Endpoint                                  Status lama → baru
 *   ----------------------------------------------------------------
 *   /v1/dashboard/trending-topic              404 → 200 ✅
 *   /v1/dashboard/emotion-map                 404 → 200 ✅
 *   /v1/dashboard/sentiment-map               404 → 200 ✅
 *   /v1/dashboard/sentiment-trend             404 → 200 ✅
 *   /v1/dashboard/sentiment-trend-hourly      404 → 200 ✅
 */

test.describe('Dashboard — ex-GAP endpoints (sudah diimplementasikan di Go)', () => {
  test('GET /v1/dashboard/trending-topic?period=7D → 200, struktur valid', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic?period=7D'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.period).toBe('7D');
    expect(typeof body.meta.total).toBe('number');
    expect(typeof body.meta.generated_at).toBe('string');

    // Validasi shape item jika ada data
    for (const item of body.data) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.topic).toBe('string');
      expect(typeof item.volume).toBe('number');
      expect(typeof item.delta).toBe('string');
    }
  });

  test('GET /v1/dashboard/emotion-map → 200, data punya 5 emotion fields', async ({ api }) => {
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
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('GET /v1/dashboard/sentiment-map → 200, data punya 3 sentiment fields', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-map'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    const d = body.data;
    expect(typeof d.positive).toBe('number');
    expect(typeof d.neutral).toBe('number');
    expect(typeof d.negative).toBe('number');
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('GET /v1/dashboard/sentiment-trend → 200, data berupa array of points', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.generated_at).toBeTruthy();

    // Minimal ada 1 point jika ada data di DB
    if (body.data.length > 0) {
      const p = body.data[0];
      expect(typeof p.date).toBe('string');
      expect(typeof p.label).toBe('string');
      expect(typeof p.positive).toBe('number');
      expect(typeof p.negative).toBe('number');
    }
  });

  test('GET /v1/dashboard/sentiment-trend-hourly?date=2026-08-20 → 200, 24 points', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend-hourly?date=2026-08-20'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(24);
    expect(body.meta.date).toBe('2026-08-20');
    expect(body.meta.generated_at).toBeTruthy();

    // Tiap point punya hour, label, positive, negative
    for (const p of body.data) {
      expect(typeof p.hour).toBe('string');
      expect(typeof p.label).toBe('string');
      expect(typeof p.positive).toBe('number');
      expect(typeof p.negative).toBe('number');
    }
  });

  test('semua ex-GAP endpoints konsisten: 200 tanpa hang (respons cepat)', async ({ api }) => {
    const endpoints = [
      '/v1/dashboard/trending-topic?period=24H',
      '/v1/dashboard/emotion-map',
      '/v1/dashboard/sentiment-map',
      '/v1/dashboard/sentiment-trend',
      '/v1/dashboard/sentiment-trend-hourly?date=2026-08-20',
    ];
    for (const ep of endpoints) {
      const started = Date.now();
      const res = await api.get(apiUrl(ep));
      expect(res.status(), `${ep} harus 200`).toBe(200);
      expect(Date.now() - started, `${ep} harus merespons cepat`).toBeLessThan(5000);
    }
  });

  test('trending-topic tanpa param period → 200 & fallback ke 24H', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.period).toBe('24H');
  });
});
