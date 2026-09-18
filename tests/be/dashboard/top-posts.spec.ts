import { test, expect, apiUrl } from '../fixtures';

/**
 * Test GET /v2/dashboard/top-posts — konten/post teratas v2.
 *
 * Query Parameters:
 * - keyword: filter keyword
 * - platform: filter platform (e.g. instagram, tiktok, x)
 * - period: filter periode
 * - search: pencarian substring teks konten
 * - topic: filter AI topic
 * - sentiment: filter sentimen (positive, neutral, negative)
 * - page: nomor halaman (1-based)
 * - limit: jumlah post per halaman (default 5)
 * - sort_by: urutan ("engagement" | "views", default "engagement")
 *
 * Kontrak Swagger:
 *   200: {
 *     data: [{ id, rank, post, account, platform, topic, sentiment, published_at, published_label, engagement, views, source_url, thumbnail_url }],
 *     meta: { generated_at: string, total: number, page: number, limit: number, total_pages: number, sort_by: string }
 *   }
 */
test.describe('GET /v2/dashboard/top-posts (v2)', () => {
  test('TC-V2-PST-01: request default mengembalikan daftar post teratas dengan meta paginasi', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-posts'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    const { total, page, limit, total_pages, sort_by } = body.meta;
    expect(page).toBe(1);
    expect(limit).toBe(5);
    expect(sort_by).toBe('engagement');
    expect(total).toBeGreaterThan(0);
    expect(total_pages).toBe(Math.ceil(total / limit));

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(5);

    // Ranks awal berurutan 1..N
    body.data.forEach((p: { rank: number }, i: number) => {
      expect(p.rank).toBe(i + 1);
    });
  });

  test('TC-V2-PST-02: validasi skema field pada item post', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-posts'));
    const body = await res.json();

    for (const post of body.data) {
      expect(typeof post.id).toBe('string');
      expect(post.id).toMatch(/^[0-9a-fA-F-]{36}$/); // Format UUID

      expect(typeof post.post).toBe('string');
      expect(typeof post.account).toBe('string');
      expect(['x', 'tiktok', 'instagram']).toContain(post.platform);

      expect(typeof post.published_at).toBe('string');
      expect(new Date(post.published_at).toString()).not.toBe('Invalid Date');

      expect(typeof post.published_label).toBe('string');
      expect(typeof post.engagement).toBe('number');
      expect(typeof post.engagement_label).toBe('string');
      expect(typeof post.views).toBe('number');
      expect(typeof post.views_label).toBe('string');
      expect(typeof post.source_url).toBe('string');
    }
  });

  test('TC-V2-PST-03: paginasi berlanjut — rank di halaman 2 berlanjut dari halaman 1', async ({ api }) => {
    const limit = 5;
    const resPage1 = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { page: 1, limit },
    });
    const body1 = await resPage1.json();

    const resPage2 = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { page: 2, limit },
    });
    const body2 = await resPage2.json();

    expect(body2.meta.page).toBe(2);
    expect(body2.data[0].rank).toBe(limit + 1); // Halaman 2 mulai dari rank 6
    expect(body2.data[body2.data.length - 1].rank).toBe(limit + body2.data.length);

    // Post halaman 1 dan halaman 2 tidak saling tumpang tindih
    const ids1 = new Set(body1.data.map((p: { id: string }) => p.id));
    for (const p of body2.data) {
      expect(ids1.has(p.id)).toBe(false);
    }
  });

  test('TC-V2-PST-04: pengurutan sort_by=views mengurutkan menurun berdasarkan views', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { sort_by: 'views', limit: 5 },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.sort_by).toBe('views');

    for (let i = 0; i < body.data.length - 1; i++) {
      expect(body.data[i].views).toBeGreaterThanOrEqual(body.data[i + 1].views);
    }
  });

  test('TC-V2-PST-05: filter sentimen (negative, positive, neutral)', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { sentiment: 'negative' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const post of body.data) {
      expect(post.sentiment).toBe('negative');
    }
  });

  test('TC-V2-PST-06: filter topik (Ekonomi Bisnis)', async ({ api }) => {
    const topic = 'Ekonomi Bisnis';
    const res = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { topic },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const post of body.data) {
      expect(post.topic).toBe(topic);
    }
  });

  test('TC-V2-PST-07: pencarian teks search memfilter isi post secara case-insensitive', async ({ api }) => {
    const searchTerm = 'prabowo';
    const res = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { search: searchTerm },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const post of body.data) {
      expect(post.post.toLowerCase()).toContain(searchTerm.toLowerCase());
    }
  });

  test('TC-V2-PST-08: filter platform mengembalikan post spesifik platform', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { platform: 'tiktok' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const post of body.data) {
      expect(post.platform).toBe('tiktok');
    }
  });

  test('TC-V2-PST-09: filter sentimen tidak valid mengembalikan array kosong secara aman', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { sentiment: 'invalid_sentiment_value' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  test('TC-V2-PST-10: filter account menyaring post berdasarkan handle akun tertentu (misal infoBMKG)', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { account: 'infoBMKG' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.total).toBeGreaterThan(0);
    expect(Array.isArray(body.data)).toBe(true);
    for (const post of body.data) {
      expect(post.account).toBe('infoBMKG');
    }
  });
});

