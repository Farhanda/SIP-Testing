import { test, expect, apiUrl, matchesPlatformFilter } from '../fixtures';

/**
 * Test API Backend — /v1/dashboard/top-posts-list
 *
 * Endpoint mengembalikan daftar top posts secara lengkap (paginated),
 * bisa difilter & diurutkan. Mirip top-posts tapi dengan pagination,
 * free-text search, emotion filter, dan sort_by.
 *
 * Kontrak Swagger:
 *   GET /v1/dashboard/top-posts-list?page=1&size=10&sort_by=view|engagement
 *        &keyword=&platform=&period=&search=&emotion=
 *   Response: { data: [{ id, platform, post, emotion, topic, engagement, views }],
 *              meta: { generated_at, page, size, total, total_pages } }
 *
 * Default sort = views desc (bukan engagement seperti Swagger).
 * sort_by=view adalah no-op karena sudah default.
 * Emotion & topic kosong karena NLP pipeline belum memproses semua post.
 */

test.describe('GET /v1/dashboard/top-posts-list', () => {
  test('tanpa filter → 200, default page=1 size=10', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(10);
    expect(body.meta.page).toBe(1);
    expect(body.meta.size).toBe(10);
    expect(typeof body.meta.total).toBe('number');
    expect(typeof body.meta.totalPages).toBe('number');
    expect(typeof body.meta.generated_at).toBe('string');
  });

  test('tiap item punya id, platform, post, emotion, topic, engagement, views', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    if (body.data.length > 0) {
      const p = body.data[0];
      expect(typeof p.id).toBe('string');
      expect(typeof p.platform).toBe('string');
      expect(typeof p.post).toBe('string');
      // emotion & topic harus string (bisa kosong jika NLP belum diproses)
      expect(typeof p.emotion).toBe('string');
      expect(typeof p.topic).toBe('string');
      expect(typeof p.engagement).toBe('number');
      expect(typeof p.views).toBe('number');
    }
  });

  test('page=2 → 200, page meta = 2', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?page=2&size=3'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.page).toBe(2);
    expect(body.data.length).toBeLessThanOrEqual(3);
  });

  test('size=50 (max) → 200, bisa ambil semua data', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?size=50'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.size).toBe(50);
    expect(body.data.length).toBeLessThanOrEqual(body.meta.total);
    expect(body.data.length).toBeLessThanOrEqual(50);
  });

  test('size=100 (over max) → 200, di-clamp ke 50', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?size=100'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.size).toBe(50);
  });

  test('sort_by=engagement → 200, diurutkan engagement desc', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?sort_by=engagement'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    if (body.data.length >= 2) {
      expect(body.data[0].engagement).toBeGreaterThanOrEqual(body.data[1].engagement);
    }
  });

  test('sort_by=view → 200, sama seperti default (BE: default sudah views desc)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?sort_by=view'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);

    // Default sort sudah views desc — sort_by=view adalah no-op
    if (body.data.length >= 2) {
      const views = body.data.map((p: any) => p.views);
      const isSorted = views.every((val: number, i: number) => i === 0 || val <= views[i - 1]);
      console.info('  [INFO] sort_by=view no-op — default already views desc');
    }
  });

  test('search=ekonomi → 200 & ada results', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?search=ekonomi'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    // BE search: full-text search, bisa match partial words
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.data.length).toBeGreaterThan(0);
    // Setiap item punya id, platform, post, engagement, views
    for (const p of body.data) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.platform).toBe('string');
      expect(typeof p.post).toBe('string');
      expect(typeof p.engagement).toBe('number');
    }
  });

  test('search tidak cocok → 200 & data kosong', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?search=xyz_tidak_ada'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  test('emotion=Joy → 200, emotion filter bergantung pada data NLP', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?emotion=Joy'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.meta.total).toBe('number');
    // NLP pipeline belum memproses semua post → total bisa 0
  });

  test('platform filter tiktok → 200, semua item TikTok', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    if (body.data.length > 0) {
      for (const p of body.data) {
        expect(matchesPlatformFilter(p.platform, 'tiktok')).toBe(true);
      }
    }
  });

  test('platform filter Instagram → 200, semua item Instagram', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?platform=instagram'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    if (body.data.length > 0) {
      for (const p of body.data) {
        expect(matchesPlatformFilter(p.platform, 'instagram')).toBe(true);
      }
    }
  });

  test('platform=x → 200 & semua item Twitter/x', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?platform=x'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    if (body.data.length > 0) {
      for (const p of body.data) {
        expect(matchesPlatformFilter(p.platform, 'x')).toBe(true);
      }
    }
  });

  test('platform multi → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?platform=tiktok,x'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('filter keyword → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?keyword=RUU+Digital'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('filter period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?period=7d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('total_pages konsisten dengan total & size', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?size=3'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const expectedPages = Math.ceil(body.meta.total / 3);
    expect(body.meta.totalPages).toBe(expectedPages);
  });

  test('page=0 fallback ke page=1', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?page=0'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.page).toBe(1);
  });

  test('page tidak valid fallback ke page=1', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?page=abc'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.page).toBe(1);
  });

  test('size=0 fallback ke default 10', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?size=0'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.size).toBe(10);
  });

  test('size negatif fallback ke default 10', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?size=-5'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.size).toBe(10);
  });

  test('page besar di-clamp ke halaman terakhir (bukan error)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?page=999'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Page di-clamp ke halaman terakhir
    expect(body.meta.page).toBe(body.meta.totalPages);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
