import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — /v1/dashboard/trending-topic
 *
 * Endpoint mengembalikan top trending topics berdasarkan volume post
 * dalam jendela waktu tertentu (24H atau 7D), lengkap dengan delta
 * perubahan peringkat (rank-change indicator).
 *
 * Kontrak Swagger:
 *   GET /v1/dashboard/trending-topic?period=24H|7D
 *   Response: { data: [{ id, topic, volume, delta }], meta: { period, total, generated_at } }
 *
 * ⚠️ CATATAN: Di deployed BE, data kosong ([]) karena tidak ada
 *    trending topics yang teridentifikasi dari seed data.
 *    Struktur response sudah benar; data kosong adalah kondisi saat ini.
 */

test.describe('GET /v1/dashboard/trending-topic', () => {
  test('tanpa period → 200 & fallback ke 24H', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.period).toBe('24H');
  });

  test('period=24H → 200, meta.period = 24H', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic?period=24H'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.period).toBe('24H');
    expect(typeof body.meta.total).toBe('number');
    expect(body.meta.total).toBe(body.data.length);
    expect(typeof body.meta.generated_at).toBe('string');
  });

  test('period=7D → 200, meta.period = 7D', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic?period=7D'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.period).toBe('7D');
    expect(typeof body.meta.total).toBe('number');
  });

  test('period=INVALID → 200 & fallback ke 24H (bukan 400)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic?period=XYZ'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.period).toBe('24H');
  });

  /**
   * ⚠️ CATATAN: Di deployed BE, data kosong ([]) karena tidak ada
   *    trending topics yang teridentifikasi. Struktur item valid jika ada data.
   */
  test('setiap item punya id, topic, volume, delta (jika ada data)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic?period=7D'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Data bisa kosong di deployed BE
    for (const item of body.data) {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.topic).toBe('string');
      expect(item.topic.length).toBeGreaterThan(0);
      expect(typeof item.volume).toBe('number');
      expect(item.volume).toBeGreaterThanOrEqual(0);
      // delta bisa "+N", "-N", "0", atau "new"
      expect(item.delta).toMatch(/^(\+\d+|-\d+|0|new)$/);
    }
  });

  test('meta.total konsisten dengan jumlah item data', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic?period=7D'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.total).toBe(body.data.length);
  });

  test('generated_at berupa ISO timestamp yang valid', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic?period=24H'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const ts = new Date(body.meta.generated_at);
    expect(ts.getTime()).not.toBeNaN();
  });

  test('keyword & platform diabaikan (endpoint ini global, tanpa filter)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic?period=7D&keyword=test&platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.period).toBe('7D');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('period=24h (lowercase) → 200 & diuppercase ke 24H', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic?period=24h'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.period).toBe('24H');
  });

  test('period=7d (lowercase) → 200 & diuppercase ke 7D', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic?period=7d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.period).toBe('7D');
  });
});
