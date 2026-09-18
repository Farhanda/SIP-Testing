import { test, expect, apiUrl } from '../fixtures';

/**
 * Test GET /v2/dashboard/summary — ringkasan metrik volume dashboard v2:
 * - total_conversation: jumlah seluruh post percakapan
 * - engagement: total interaksi (likes, comments, shares, retweets)
 * - views: total tayangan
 *
 * Kontrak Swagger:
 *   200: { data: { total_conversation: { value, label }, engagement: { value, label }, views: { value, label } }, meta: { generated_at } }
 */
test.describe('GET /v2/dashboard/summary (v2)', () => {
  test('TC-V2-SUM-01: request default mengembalikan HTTP 200 dengan struktur metrik lengkap', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/summary'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    // Validasi meta
    expect(typeof body.meta.generated_at).toBe('string');
    expect(new Date(body.meta.generated_at).toString()).not.toBe('Invalid Date');

    // Validasi 3 metrik utama
    const { total_conversation, engagement, views } = body.data;
    for (const metric of [total_conversation, engagement, views]) {
      expect(metric).toBeDefined();
      expect(typeof metric.value).toBe('number');
      expect(metric.value).toBeGreaterThanOrEqual(0);
      expect(typeof metric.label).toBe('string');
      expect(metric.label.length).toBeGreaterThan(0);
    }
  });

  test('TC-V2-SUM-02: filter platform (instagram, tiktok, x) mengembalikan metrik per platform', async ({ api }) => {
    const platforms = ['instagram', 'tiktok', 'x'];

    for (const plat of platforms) {
      const res = await api.get(apiUrl('/v2/dashboard/summary'), {
        params: { platform: plat },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.total_conversation.value).toBeGreaterThanOrEqual(0);
      expect(body.data.engagement.value).toBeGreaterThanOrEqual(0);
      expect(body.data.views.value).toBeGreaterThanOrEqual(0);
    }
  });

  test('TC-V2-SUM-03: invariant cross-platform — total percakapan per platform konsisten dengan total keseluruhan', async ({ api }) => {
    // Ambil total keseluruhan tanpa filter platform
    const allRes = await api.get(apiUrl('/v2/dashboard/summary'));
    const allBody = await allRes.json();
    const overallTotal = allBody.data.total_conversation.value;

    // Ambil metrik per masing-masing platform
    let sumPlatforms = 0;
    for (const plat of ['instagram', 'tiktok', 'x']) {
      const res = await api.get(apiUrl('/v2/dashboard/summary'), {
        params: { platform: plat },
      });
      const body = await res.json();
      sumPlatforms += body.data.total_conversation.value;
    }

    // Total keseluruhan harus sama persis atau sangat mendekati penjumlahan per platform
    expect(sumPlatforms).toBe(overallTotal);
  });

  test('TC-V2-SUM-04: filter periode relatif (24h, 7d, 1m) dan custom range', async ({ api }) => {
    const periods = ['24h', '7d', '1m', '2026-09-01/2026-09-07'];

    for (const p of periods) {
      const res = await api.get(apiUrl('/v2/dashboard/summary'), {
        params: { period: p },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.total_conversation.value).toBeGreaterThanOrEqual(0);
      expect(body.data.engagement.value).toBeGreaterThanOrEqual(0);
    }
  });

  test('TC-V2-SUM-05: platform tidak dikenal mengembalikan HTTP 200 dengan nilai metrik 0 (graceful fallback)', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/summary'), {
      params: { platform: 'unknown_nonexistent_platform' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.total_conversation.value).toBe(0);
    expect(body.data.total_conversation.label).toBe('0');
    expect(body.data.engagement.value).toBe(0);
    expect(body.data.views.value).toBe(0);
  });
});

