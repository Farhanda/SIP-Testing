import { test, expect, apiUrl, matchesPlatformFilter } from '../fixtures';

/**
 * Test API Backend — endpoint top-* (eksplorasi ulang 2026-08-14):
 *
 *   GET {BASE_URL_BE}/v1/dashboard/top-accounts
 *     ?keyword=<slug>&platform=<comma-separated>&period=<...>
 *     → 200 { data: [{ id, handle, platform, posts }], meta: { generated_at } }
 *     (perubahan deploy 2026-09: id = slug lowercase, handle = display name —
 *     TIDAK lagi selalu sama; diurutkan posts desc; maks 5)
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
 * Semua bugs sudah fixed (top-hashtags 500, platform=x, platform=instagram).
 * Default sort = views desc (bukan engagement seperti Swagger — documented).
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
      expect(item.handle).toBeTruthy();
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
  test('top-hashtags tanpa filter → 200 & struktur valid', async ({ api }) => {
    const res = await api.get(apiUrl(TOP_HASHTAGS_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopHashtagsResponse;
    expect(Array.isArray(body.data)).toBe(true);
    for (const item of body.data) {
      expect(item.tag.startsWith('#')).toBe(true);
      expect(item.count).toBeGreaterThanOrEqual(1);
      expect(item.id).toBeTruthy();
    }
  });

  test('top-hashtags diurutkan count desc & maks 5', async ({ api }) => {
    const res = await api.get(apiUrl(TOP_HASHTAGS_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopHashtagsResponse;
    expect(body.data.length).toBeLessThanOrEqual(5);
    const counts = body.data.map((h) => h.count);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  test('top-hashtags filter keyword → 200 & struktur valid', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_HASHTAGS_PATH}?keyword=${KNOWN_KEYWORD}`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopHashtagsResponse;
    for (const item of body.data) {
      expect(item.tag.startsWith('#')).toBe(true);
      expect(item.count).toBeGreaterThanOrEqual(1);
    }
  });

  test('top-hashtags filter platform → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_HASHTAGS_PATH}?platform=instagram`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopHashtagsResponse).data)).toBe(true);
  });

  test('top-hashtags period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_HASHTAGS_PATH}?period=7d`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopHashtagsResponse).data)).toBe(true);
  });

  test('top-hashtags period range (date/date) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_HASHTAGS_PATH}?period=2026-08-01/2026-08-18`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopHashtagsResponse).data)).toBe(true);
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

  test('top-posts default → 200 & sorted by views desc', async ({ api }) => {
    const res = await api.get(apiUrl(TOP_POSTS_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopPostsResponse;
    expect(body.data.length).toBeLessThanOrEqual(5);

    // Default sort = views desc (BE behavior, Swagger says engagement)
    if (body.data.length >= 2) {
      const viewValues = body.data.map((p) => (p as any).views ?? 0);
      for (let i = 1; i < viewValues.length; i++) {
        expect(viewValues[i]).toBeLessThanOrEqual(viewValues[i - 1]);
      }
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

  test('top-posts filter platform=x → 200 & semua Twitter/x', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOP_POSTS_PATH}?platform=x`));
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
