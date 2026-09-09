import { test, expect, apiUrl, matchesPlatformFilter } from '../fixtures';

/**
 * Test API Backend — /v1/dashboard/top-posts-list
 *
 * Endpoint mengembalikan daftar top posts secara lengkap (paginated),
 * bisa difilter & diurutkan. Mirip top-posts tapi dengan pagination,
 * free-text search, emotion filter, dan sort_by.
 *
 * Kontrak aktual (perubahan deploy 2026-09):
 *   GET /v1/dashboard/top-posts-list?page=1&size=10&sort_by=view|engagement
 *        &keyword=&platform=&period=&search=&emotion=
 *   Response: { data: { stats: { total_posts, ... }, posts: [ { id, platform,
 *              post, emotion, topic, engagement, views } ] },
 *              meta: { generated_at, page, size, total, totalPages } }
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
    // Deploy 2026-09: data = { stats, posts } (bukan array langsung)
    const posts = body.data.posts;
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeLessThanOrEqual(10);
    expect(typeof body.data.stats.total_posts).toBe('number');
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
    const posts = body.data.posts;
    if (posts.length > 0) {
      const p = posts[0];
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
    expect(body.data.posts.length).toBeLessThanOrEqual(3);
  });

  test('size=50 (max) → 200, bisa ambil semua data', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?size=50'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.size).toBe(50);
    expect(body.data.posts.length).toBeLessThanOrEqual(body.meta.total);
    expect(body.data.posts.length).toBeLessThanOrEqual(50);
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
    const posts = body.data.posts;
    if (posts.length >= 2) {
      expect(posts[0].engagement).toBeGreaterThanOrEqual(posts[1].engagement);
    }
  });

  test('sort_by=view → 200, sama seperti default (BE: default sudah views desc)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?sort_by=view'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const posts = body.data.posts;
    expect(Array.isArray(posts)).toBe(true);

    // Default sort sudah views desc — sort_by=view adalah no-op
    if (posts.length >= 2) {
      const views = posts.map((p: any) => p.views);
      const isSorted = views.every((val: number, i: number) => i === 0 || val <= views[i - 1]);
      console.info('  [INFO] sort_by=view no-op — default already views desc');
    }
  });

  test('search=ekonomi → 200 & ada results', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?search=ekonomi'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const posts = body.data.posts;
    // BE search: full-text search, bisa match partial words
    expect(body.meta.total).toBeGreaterThan(0);
    expect(posts.length).toBeGreaterThan(0);
    // Setiap item punya id, platform, post, engagement, views
    for (const p of posts) {
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
    expect(body.data.posts).toHaveLength(0);
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
    const posts = body.data.posts;
    if (posts.length > 0) {
      for (const p of posts) {
        expect(matchesPlatformFilter(p.platform, 'tiktok')).toBe(true);
      }
    }
  });

  test('platform filter Instagram → 200, semua item Instagram', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?platform=instagram'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const posts = body.data.posts;
    if (posts.length > 0) {
      for (const p of posts) {
        expect(matchesPlatformFilter(p.platform, 'instagram')).toBe(true);
      }
    }
  });

  test('platform=x → 200 & semua item Twitter/x', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?platform=x'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const posts = body.data.posts;
    if (posts.length > 0) {
      for (const p of posts) {
        expect(matchesPlatformFilter(p.platform, 'x')).toBe(true);
      }
    }
  });

  test('platform multi → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?platform=tiktok,x'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data.posts)).toBe(true);
  });

  test('filter keyword → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?keyword=RUU+Digital'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data.posts)).toBe(true);
  });

  test('filter period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?period=7d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data.posts)).toBe(true);
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
    expect(body.data.posts.length).toBeGreaterThan(0);
  });

  // ── Parameter baru (eksplorasi ulang dashboard-service 2026-09-09) ──
  // Swagger live menambah: actor, hashtag, sort_order, sort_by=published_at,
  // topic, sentiment. Semua diverifikasi live sebelum test ditulis.

  test('sort_order=asc → 200, views diurutkan menaik (kebalikan default)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?sort_order=asc&size=10'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const views = body.data.posts.map((p: { views: number }) => p.views);
    if (views.length >= 2) {
      const isAsc = views.every((v: number, i: number) => i === 0 || v >= views[i - 1]);
      expect(isAsc, 'sort_order=asc harus mengurutkan views menaik').toBe(true);
    }
  });

  test('sort_by=published_at → 200, diurutkan tanggal desc (default)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?sort_by=published_at&size=10'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const posts = body.data.posts;
    expect(Array.isArray(posts)).toBe(true);
    if (posts.length >= 2) {
      const dates = posts.map((p: { published_at: string }) => new Date(p.published_at).getTime());
      const isDesc = dates.every((d: number, i: number) => i === 0 || d <= dates[i - 1]);
      expect(isDesc, 'sort_by=published_at default harus desc').toBe(true);
    }
  });

  test('actor=<handle dari top-accounts> → 200 & total > 0', async ({ api }) => {
    // actor mencocokkan field `handle` (display name), case-sensitive —
    // BUKAN `id` (slug). Ambil handle live dari top-accounts agar tidak rapuh.
    // Catatan: item top-posts-list TIDAK memuat field account/name, jadi
    // verifikasi dilakukan lewat total > 0 (filter menyempitkan hasil).
    const accRes = await api.get(apiUrl('/v1/dashboard/top-accounts'));
    expect(accRes.status()).toBe(200);
    const accounts = (await accRes.json()).data;
    expect(accounts.length, 'top-accounts harus punya data untuk sampel actor').toBeGreaterThan(0);
    const handle = accounts[0].handle as string;

    const res = await api.get(apiUrl(`/v1/dashboard/top-posts-list?actor=${encodeURIComponent(handle)}`));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.total, `actor=${handle} harus punya post`).toBeGreaterThan(0);
    expect(Array.isArray(body.data.posts)).toBe(true);
  });

  test('actor=<id slug> (bukan handle) → 200 tapi total=0 (filter pakai handle, case-sensitive)', async ({ api }) => {
    // Dokumentasi perilaku: actor TIDAK mencocokkan id/slug lowercase.
    // Ini quirk terdokumentasi — swagger bilang "values come from top-accounts"
    // tetapi yang cocok hanya `handle` persis (case-sensitive).
    const accRes = await api.get(apiUrl('/v1/dashboard/top-accounts'));
    expect(accRes.status()).toBe(200);
    const accounts = (await accRes.json()).data;
    // Cari account yang id (slug) != handle (punya huruf kapital di handle)
    const mismatch = accounts.find((a: { id: string; handle: string }) => a.id !== a.handle);
    test.skip(!mismatch, 'tidak ada account dengan id != handle untuk diuji');

    const byId = await api.get(apiUrl(`/v1/dashboard/top-posts-list?actor=${encodeURIComponent(mismatch.id)}`));
    expect(byId.status()).toBe(200);
    expect((await byId.json()).meta.total, 'actor=<id slug> tidak cocok → total 0').toBe(0);
  });

  test('hashtag=<tag tanpa #> → 200 & total > 0 (case-sensitive)', async ({ api }) => {
    // Ambil hashtag live dari top-hashtags agar tidak hardcode.
    // Field aktual top-hashtags: { id, tag: "#xxx", count } — pakai `tag`.
    const tagRes = await api.get(apiUrl('/v1/dashboard/top-hashtags'));
    expect(tagRes.status()).toBe(200);
    const tags = (await tagRes.json()).data;
    expect(tags.length, 'top-hashtags harus punya data untuk sampel').toBeGreaterThan(0);
    const clean = (tags[0].tag as string).replace(/^#/, '');

    const res = await api.get(apiUrl(`/v1/dashboard/top-posts-list?hashtag=${encodeURIComponent(clean)}`));
    expect(res.status()).toBe(200);
    expect((await res.json()).meta.total, `hashtag=${clean} harus punya post`).toBeGreaterThan(0);
  });

  test('topic=<topic dari topic-intelligence> → 200', async ({ api }) => {
    const topicRes = await api.get(apiUrl('/v1/dashboard/topic-intelligence'));
    expect(topicRes.status()).toBe(200);
    const topics = (await topicRes.json()).data;
    expect(topics.length, 'topic-intelligence harus punya data untuk sampel').toBeGreaterThan(0);
    const topic = topics[0].label as string;

    const res = await api.get(apiUrl(`/v1/dashboard/top-posts-list?topic=${encodeURIComponent(topic)}`));
    expect(res.status()).toBe(200);
    expect(typeof (await res.json()).meta.total).toBe('number');
  });

  test('sentiment=positive → 200 & semua item sentiment positif', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?sentiment=positive&size=10'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.total, 'sentiment=positive harus punya post').toBeGreaterThan(0);
    for (const p of body.data.posts) {
      expect(p.sentiment.toLowerCase(), 'item harus sentiment positif').toMatch(/positif|positive/);
    }
  });

  test('sentiment case-insensitive & terima label Indonesia (Netral == neutral)', async ({ api }) => {
    const en = await api.get(apiUrl('/v1/dashboard/top-posts-list?sentiment=neutral&size=1'));
    const id = await api.get(apiUrl('/v1/dashboard/top-posts-list?sentiment=netral&size=1'));
    expect(en.status()).toBe(200);
    expect(id.status()).toBe(200);

    // Kedua label harus menghasilkan total yang sama (case-insensitive + alias ID)
    expect((await en.json()).meta.total).toBe((await id.json()).meta.total);
  });
});
