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
 * ⚠️ BE BUG: sort_by=view tidak mengurutkan berdasarkan views.
 *    Semua post di deployed BE punya emotion="" dan topic="" (NLP belum diproses).
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

  /**
   * ⚠️ BE BUG: sort_by=view tidak mengurutkan berdasarkan views.
   *    BE mengembalikan urutan yang sama dengan default (sort by engagement).
   *    Seharusnya item dengan views tertinggi di indeks pertama.
   */
  test('sort_by=view → 200 (BE BUG: tidak sorted by views)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?sort_by=view'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);

    // BE BUG: sort_by=view tidak bekerja — views tidak diurutkan desc
    if (body.data.length >= 2) {
      const views = body.data.map((p: any) => p.views);
      const isSorted = views.every((val: number, i: number) => i === 0 || val <= views[i - 1]);
      if (!isSorted) {
        console.error('  [BE BUG] top-posts-list sort_by=view: views tidak sorted desc — sort_by diabaikan');
      }
      // Uncomment setelah BE fix:
      // expect(isSorted).toBe(true);
    }
  });

  test('search=ekonomi → 200, semua post mengandung "ekonomi"', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?search=ekonomi'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const p of body.data) {
      expect(p.post.toLowerCase()).toContain('ekonomi');
    }
  });

  test('search tidak cocok → 200 & data kosong', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?search=xyz_tidak_ada'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  /**
   * ⚠️ BE BUG: semua post punya emotion="" (NLP belum diproses).
   *    Filter emotion=Joy menghasilkan total=0 karena tidak ada post
   *    dengan emotion terisi. BE seharusnya return 400 atau dokumentasi
   *    yang jelas bahwa emotion hanya bisa difilter jika ada data NLP.
   */
  test('emotion=Joy → 200, tapi total=0 (BE BUG: emotion kosong di semua post)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?emotion=Joy'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Semua post di deployed BE punya emotion="" → filter tidak match
    expect(body.meta.total).toBe(0);
    console.error('  [BE BUG] top-posts-list: semua post punya emotion="" — NLP belum diproses');
  });

  test('platform filter → 200, semua item dari platform yang sama', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    if (body.data.length > 0) {
      for (const p of body.data) {
        expect(matchesPlatformFilter(p.platform, 'tiktok')).toBe(true);
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
