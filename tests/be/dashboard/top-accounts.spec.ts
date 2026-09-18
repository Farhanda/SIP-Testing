import { test, expect, apiUrl } from '../fixtures';

/**
 * Test GET /v2/dashboard/top-accounts — peringkat akun teratas v2.
 *
 * Query Parameters:
 * - limit: jumlah akun yang dikembalikan (default 10)
 * - sort_by: kolom pengurutan ("posts" | "engagement" | "views", default "posts")
 * - platform: filter platform (e.g. "x", "tiktok", "instagram")
 * - period: filter periode
 *
 * Kontrak Swagger:
 *   200: {
 *     data: [{ rank, account, platform, platform_label, posts, engagement, engagement_label, views, views_label }],
 *     meta: { generated_at: string, limit: number, sort_by: string }
 *   }
 */
test.describe('GET /v2/dashboard/top-accounts (v2)', () => {
  test('TC-V2-ACC-01: request default mengembalikan daftar akun dengan limit=10 dan urutan posts', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-accounts'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    expect(body.meta.limit).toBe(10);
    expect(body.meta.sort_by).toBe('posts');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(10);

    // Rank berurutan 1, 2, 3...
    body.data.forEach((item: { rank: number }, idx: number) => {
      expect(item.rank).toBe(idx + 1);
    });

    // Default terurut menurun berdasarkan posts
    for (let i = 0; i < body.data.length - 1; i++) {
      expect(body.data[i].posts).toBeGreaterThanOrEqual(body.data[i + 1].posts);
    }
  });

  test('TC-V2-ACC-02: validasi format field pada setiap akun', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-accounts'));
    const body = await res.json();

    for (const item of body.data) {
      expect(typeof item.account).toBe('string');
      // Sesuai spesifikasi backend: handle tidak diawali '@'
      expect(item.account.startsWith('@')).toBe(false);

      expect(['x', 'tiktok', 'instagram']).toContain(item.platform);
      expect(typeof item.platform_label).toBe('string');

      expect(typeof item.posts).toBe('number');
      expect(item.posts).toBeGreaterThanOrEqual(0);

      expect(typeof item.engagement).toBe('number');
      expect(typeof item.engagement_label).toBe('string');

      expect(typeof item.views).toBe('number');
      expect(typeof item.views_label).toBe('string');
    }
  });

  test('TC-V2-ACC-03: pengurutan sort_by=views mengurutkan data menurun berdasarkan views', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-accounts'), {
      params: { sort_by: 'views', limit: 10 },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.sort_by).toBe('views');

    for (let i = 0; i < body.data.length - 1; i++) {
      expect(body.data[i].views).toBeGreaterThanOrEqual(body.data[i + 1].views);
    }
  });

  test('TC-V2-ACC-04: pengurutan sort_by=engagement mengurutkan data menurun berdasarkan engagement', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-accounts'), {
      params: { sort_by: 'engagement', limit: 10 },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.sort_by).toBe('engagement');

    for (let i = 0; i < body.data.length - 1; i++) {
      expect(body.data[i].engagement).toBeGreaterThanOrEqual(body.data[i + 1].engagement);
    }
  });

  test('TC-V2-ACC-05: parameter limit kustom (limit=3, limit=5)', async ({ api }) => {
    for (const lim of [3, 5]) {
      const res = await api.get(apiUrl('/v2/dashboard/top-accounts'), {
        params: { limit: lim },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.meta.limit).toBe(lim);
      expect(body.data.length).toBeLessThanOrEqual(lim);
    }
  });

  test('TC-V2-ACC-06: filter platform mengembalikan akun yang sesuai platform tersebut', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-accounts'), {
      params: { platform: 'tiktok' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.platform).toBe('tiktok');
      expect(item.platform_label).toBe('TikTok');
    }
  });

  test('TC-V2-ACC-07: nilai sort_by tidak dikenal jatuh ke fallback "posts"', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-accounts'), {
      params: { sort_by: 'invalid_column_name' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.sort_by).toBe('posts');
  });
});

