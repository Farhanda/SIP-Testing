import { test, expect, apiUrl } from '../fixtures';

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
    expect(body.data.length).toBe(body.meta.total);
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

  test('sort_by=view → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?sort_by=view'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
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

  test('emotion=Joy → 200, semua item emotion = Joy', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?emotion=Joy'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const p of body.data) {
      expect(p.emotion).toBe('Joy');
    }
  });

  test('platform filter → 200, semua item dari platform yang sama', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const p of body.data) {
      expect(p.platform).toBe('TikTok');
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
    // Page di-clamp ke halaman terakhir, bukan kosong
    expect(body.meta.page).toBe(body.meta.totalPages);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
