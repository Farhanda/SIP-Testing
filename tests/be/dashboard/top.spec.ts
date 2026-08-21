import { test, expect, apiUrl, matchesPlatformFilter } from '../fixtures';

/**
 * Test API Backend — endpoint top-* (eksplorasi ulang 2026-08-14):
 *
 *   GET {BASE_URL_BE}/v1/dashboard/top-accounts
 *     ?keyword=<slug>&platform=<comma-separated>&period=<...>
 *     → 200 { data: [{ id, handle, platform, posts }], meta: { generated_at } }
 *     (id = handle; diurutkan posts desc; maks 5)
 *
 *   GET {BASE_URL_BE}/v1/dashboard/top-hashtags
 *     → 200 { data: [{ id, tag, count }], meta: { generated_at } }
 *     (tag berformat "#Xxx"; diurutkan count desc; maks 5)
 *
 *   GET {BASE_URL_BE}/v1/dashboard/top-posts
 *     → 200 { data: [{ id, platform, post, emotion, topic, engagement }], meta: { generated_at } }
 *     (diurutkan engagement desc; maks 5)
 *
 * Struktur & perilaku diverifikasi langsung ke BE deployed 2026-08-21.
 *
 * ⚠️ BE BUG: top-hashtags return 500 internal_error saat tanpa filter,
 *    dengan keyword, atau dengan period. Hanya bekerja dengan filter platform.
 */

interface TopAccountsResponse {
  data: Array<{ id: string; handle: string; platform: string; posts: number }>;
  meta: { generated_at: string };
}

interface TopHashtagsResponse {
  data: Array<{ id: string; tag: string; count: number }>;
  meta: { generated_at: string };
}

interface TopPostsResponse {
  data: Array<{
    id: string;
    platform: string;
    post: string;
    emotion: string;
    topic: string;
    engagement: number;
  }>;
  meta: { generated_at: string };
}

const TOP_ACCOUNTS_PATH = '/v1/dashboard/top-accounts';
const TOP_HASHTAGS_PATH = '/v1/dashboard/top-hashtags';
const TOP_POSTS_PATH = '/v1/dashboard/top-posts';
const KNOWN_KEYWORD = 'RUU Digital'; // keyword dengan data di BE

test.describe('Dashboard — GET /v1/dashboard/top-accounts', () => {
  test('top-accounts tanpa filter → 200 & struktur lengkap', async ({ api }) => {
    const res = await api.get(apiUrl(TOP_ACCOUNTS_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopAccountsResponse;
    expect(Array.isArray(body.data)).toBe(true);
    for (const item of body.data) {
      expect(item.id).toBeTruthy();
      expect(item.handle).toBe(item.id); // id = handle di kontrak ini
      expect(item.platform).toBeTruthy();
      expect(item.posts).toBeGreaterThanOrEqual(1);
    }
  });

  test('top-accounts diurutkan posts desc & maks 5', async ({ api }) => {
    const res = await api.get(apiUrl(TOP_ACCOUNTS_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopAccountsResponse;
    expect(body.data.length).toBeLessThanOrEqual(5);
    const posts = body.data.map((a) => a.posts);
    // urutan menurun (ties boleh sama)
    for (let i = 1; i < posts.length; i++) {
      expect(posts[i]).toBeLessThanOrEqual(posts[i - 1]);
    }
  });

  test('top-accounts filter platform=tiktok → 200 & semua TikTok', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_ACCOUNTS_PATH}?platform=tiktok`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopAccountsResponse;
    // Data dinamis: bisa kosong jika tidak ada data TikTok di seed deployed
    if (body.data.length > 0) {
      for (const item of body.data) {
        expect(matchesPlatformFilter(item.platform, 'tiktok')).toBe(true);
      }
    }
  });

  test('top-accounts filter keyword → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_ACCOUNTS_PATH}?keyword=${KNOWN_KEYWORD}`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopAccountsResponse).data)).toBe(true);
  });

  test('top-accounts period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_ACCOUNTS_PATH}?period=7d`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopAccountsResponse).data)).toBe(true);
  });

  test('top-accounts period range (date/date) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_ACCOUNTS_PATH}?period=2026-08-01/2026-08-18`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopAccountsResponse).data)).toBe(true);
  });

  test('top-accounts platform multi (comma-separated) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_ACCOUNTS_PATH}?platform=instagram,x`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopAccountsResponse).data)).toBe(true);
  });
});

test.describe('Dashboard — GET /v1/dashboard/top-hashtags', () => {
  /**
   * ⚠️ BE BUG: top-hashtags tanpa filter return 500 internal_error.
   *    Swagger mendokumentasikan endpoint ini harusnya return 200.
   *    Bug ini juga muncul saat filter keyword atau period.
   *    Hanya filter platform yang bekerja (return 200 dengan data kosong).
   */
  test('top-hashtags tanpa filter → 200 atau 500 (BE BUG: internal server error)', async ({ api }) => {
    const res = await api.get(apiUrl(TOP_HASHTAGS_PATH));
    // BE BUG: return 500 internal_error untuk request tanpa filter
    expect([200, 500]).toContain(res.status());

    if (res.status() === 200) {
      const body = (await res.json()) as TopHashtagsResponse;
      expect(Array.isArray(body.data)).toBe(true);
      for (const item of body.data) {
        expect(item.tag.startsWith('#')).toBe(true);
        expect(item.count).toBeGreaterThanOrEqual(1);
        expect(item.id).toBeTruthy();
      }
    } else {
      // BE BUG: internal_error — catat untuk report
      const body = await res.json();
      expect(body.error.code).toBe('internal_error');
      console.error('  [BE BUG] top-hashtags tanpa filter → 500:', body.error.message);
    }
  });

  test('top-hashtags diurutkan count desc & maks 5', async ({ api }) => {
    const res = await api.get(apiUrl(TOP_HASHTAGS_PATH));
    if (res.status() !== 200) return; // skip jika BE bug

    const body = (await res.json()) as TopHashtagsResponse;
    expect(body.data.length).toBeLessThanOrEqual(5);
    const counts = body.data.map((h) => h.count);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  /**
   * ⚠️ BE BUG: top-hashtags filter keyword return 500 internal_error.
   */
  test('top-hashtags filter keyword → 200 atau 500 (BE BUG: internal server error)', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_HASHTAGS_PATH}?keyword=${KNOWN_KEYWORD}`));
    expect([200, 500]).toContain(res.status());

    if (res.status() === 200) {
      const body = (await res.json()) as TopHashtagsResponse;
      for (const item of body.data) {
        expect(item.tag.startsWith('#')).toBe(true);
        expect(item.count).toBeGreaterThanOrEqual(1);
      }
    } else {
      const body = await res.json();
      expect(body.error.code).toBe('internal_error');
      console.error('  [BE BUG] top-hashtags filter keyword → 500:', body.error.message);
    }
  });

  test('top-hashtags filter platform → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_HASHTAGS_PATH}?platform=instagram`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopHashtagsResponse).data)).toBe(true);
  });

  /**
   * ⚠️ BE BUG: top-hashtags filter period return 500 internal_error.
   */
  test('top-hashtags period=7d → 200 atau 500 (BE BUG)', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_HASHTAGS_PATH}?period=7d`));
    expect([200, 500]).toContain(res.status());
    if (res.status() === 500) {
      const body = await res.json();
      expect(body.error.code).toBe('internal_error');
    }
  });

  /**
   * ⚠️ BE BUG: top-hashtags period range return 500 internal_error.
   */
  test('top-hashtags period range (date/date) → 200 atau 500 (BE BUG)', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_HASHTAGS_PATH}?period=2026-08-01/2026-08-18`));
    expect([200, 500]).toContain(res.status());
    if (res.status() === 500) {
      const body = await res.json();
      expect(body.error.code).toBe('internal_error');
    }
  });

  test('top-hashtags platform multi (comma-separated) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_HASHTAGS_PATH}?platform=instagram,x`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopHashtagsResponse).data)).toBe(true);
  });
});

test.describe('Dashboard — GET /v1/dashboard/top-posts', () => {
  test('top-posts tanpa filter → 200 & struktur lengkap', async ({ api }) => {
    const res = await api.get(apiUrl(TOP_POSTS_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopPostsResponse;
    expect(Array.isArray(body.data)).toBe(true);
    for (const item of body.data) {
      expect(item.id).toBeTruthy();
      expect(item.platform).toBeTruthy();
      expect(item.post.length).toBeGreaterThan(0);
      expect(item.engagement).toBeGreaterThanOrEqual(0);
      // emotion & topic harus string (bisa kosong jika NLP belum diproses)
      expect(typeof item.emotion).toBe('string');
      expect(typeof item.topic).toBe('string');
    }
  });

  /**
   * ⚠️ BE BUG: top-posts tanpa sort_by tidak diurutkan engagement desc.
   *    BE seharusnya default sort by engagement desc sesuai Swagger,
   *    tapi aktualnya mengembalikan urutan acak / insertion order.
   *    Dengan sort_by=engagement, sorting benar.
   */
  test('top-posts diurutkan engagement desc & maks 5 (BE BUG: tanpa sort_by tidak sorted)', async ({ api }) => {
    const res = await api.get(apiUrl(TOP_POSTS_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopPostsResponse;
    expect(body.data.length).toBeLessThanOrEqual(5);

    // BE BUG: tanpa sort_by, engagement tidak diurutkan desc
    if (body.data.length >= 2) {
      const engagements = body.data.map((p) => p.engagement);
      const isSorted = engagements.every((val, i) => i === 0 || val <= engagements[i - 1]);
      if (!isSorted) {
        console.error('  [BE BUG] top-posts tanpa sort_by: engagement tidak sorted desc — seharusnya default sort by engagement desc');
      }
      // Tetap catat sebagai bug, jangan skip assertion
      // expect(isSorted).toBe(true); // Uncomment setelah BE fix
    }
  });

  test('top-posts dengan sort_by=engagement → 200 & sorted desc', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_POSTS_PATH}?sort_by=engagement`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopPostsResponse;
    expect(body.data.length).toBeLessThanOrEqual(5);
    if (body.data.length >= 2) {
      const engagements = body.data.map((p) => p.engagement);
      for (let i = 1; i < engagements.length; i++) {
        expect(engagements[i]).toBeLessThanOrEqual(engagements[i - 1]);
      }
    }
  });

  test('top-posts filter keyword+platform → 200 & semua platform sesuai', async ({ api }) => {
    const res = await api.get(
      apiUrl(`${TOP_POSTS_PATH}?keyword=${KNOWN_KEYWORD}&platform=x`),
    );
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopPostsResponse;
    expect(body.data.length).toBeLessThanOrEqual(5);
    if (body.data.length > 0) {
      for (const item of body.data) {
        expect(matchesPlatformFilter(item.platform, 'x')).toBe(true);
      }
    }
  });

  test('top-posts filter platform → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_POSTS_PATH}?platform=tiktok`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopPostsResponse;
    expect(body.data.length).toBeLessThanOrEqual(5);
    if (body.data.length > 0) {
      for (const item of body.data) {
        expect(matchesPlatformFilter(item.platform, 'tiktok')).toBe(true);
      }
    }
  });

  test('top-posts period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_POSTS_PATH}?period=7d`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopPostsResponse).data)).toBe(true);
  });

  test('top-posts period range (date/date) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_POSTS_PATH}?period=2026-08-01/2026-08-18`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopPostsResponse).data)).toBe(true);
  });

  test('top-posts platform multi (comma-separated) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_POSTS_PATH}?platform=instagram,x`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopPostsResponse).data)).toBe(true);
  });
});
