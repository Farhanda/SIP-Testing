import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — GET /v1/dashboard/posts/{id}
 *
 * Endpoint mengembalikan SATU post secara lengkap (full detail) berdasarkan
 * id internal (UUID). Ditambahkan saat eksplorasi ulang dashboard-service
 * 2026-09-09 — sebelumnya NOL coverage (endpoint baru di swagger live).
 *
 * Kontrak aktual (diverifikasi live 2026-09-09, BASE_URL_BE :8091):
 *   GET /v1/dashboard/posts/{id}
 *   → 200 {
 *       data: {
 *         id, platform, provider, provider_record_id, name, account,
 *         post, title, description, text_other, source_url,
 *         topic, emotion, emotion_color, sentiment, sentiment_color,
 *         language, insight, summary, recommended_action,
 *         hashtags: string[], keywords: string[], published_at,
 *         metrics: { likes, comments, shares, saves, reposts,
 *                    engagement, engagement_label, views, views_label },
 *         twitterx: object|null, instagram: object|null
 *       },
 *       meta: { generated_at }
 *     }
 *   → 404 { error: { code: "not_found", message: "post not found" } }
 *
 * id TIDAK di-hardcode: diambil LIVE dari top-posts-list supaya test tetap
 * valid saat data DB berubah (pola konsistensi live, bukan angka terkunci).
 */

interface PostMetrics {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reposts: number;
  engagement: number;
  engagement_label: string;
  views: number;
  views_label: string;
}

interface PostDetail {
  id: string;
  platform: string;
  provider: string;
  provider_record_id: string;
  name: string;
  account: string;
  post: string;
  title: string;
  description: string;
  text_other: string;
  source_url: string;
  topic: string;
  emotion: string;
  emotion_color: string;
  sentiment: string;
  sentiment_color: string;
  language: string;
  insight: string;
  summary: string;
  recommended_action: string;
  hashtags: string[];
  keywords: string[];
  published_at: string;
  metrics: PostMetrics;
  twitterx: unknown | null;
  instagram: unknown | null;
}

interface PostDetailResponse {
  data: PostDetail;
  meta: { generated_at: string };
}

interface ErrorBody {
  error: { code: string; message: string };
}

const POSTS_PATH = '/v1/dashboard/posts';

/** Ambil satu post id nyata dari top-posts-list (live, bukan hardcoded). */
async function fetchSamplePostId(api: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await api.get(apiUrl('/v1/dashboard/top-posts-list?size=1'));
  expect(res.status()).toBe(200);
  const body = await res.json();
  const posts = body.data.posts;
  expect(posts.length, 'top-posts-list harus punya minimal 1 post untuk sampel').toBeGreaterThan(0);
  return posts[0].id as string;
}

test.describe('GET /v1/dashboard/posts/{id}', () => {
  test('id valid (dari top-posts-list) → 200 & struktur detail lengkap', async ({ api }) => {
    const id = await fetchSamplePostId(api);
    const res = await api.get(apiUrl(`${POSTS_PATH}/${encodeURIComponent(id)}`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as PostDetailResponse;
    const d = body.data;
    expect(d.id).toBe(id);
    expect(typeof d.platform).toBe('string');
    expect(typeof d.provider).toBe('string');
    expect(typeof d.post).toBe('string');
    expect(typeof d.source_url).toBe('string');
    expect(Array.isArray(d.hashtags)).toBe(true);
    expect(Array.isArray(d.keywords)).toBe(true);
    expect(typeof d.published_at).toBe('string');
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('metrics detail punya kontrak lengkap (likes/comments/shares/saves/reposts/engagement/views + label)', async ({ api }) => {
    const id = await fetchSamplePostId(api);
    const res = await api.get(apiUrl(`${POSTS_PATH}/${encodeURIComponent(id)}`));
    expect(res.status()).toBe(200);

    const m = (await res.json() as PostDetailResponse).data.metrics;
    for (const key of ['likes', 'comments', 'shares', 'saves', 'reposts', 'engagement', 'views'] as const) {
      expect(typeof m[key], `metrics.${key} harus number`).toBe('number');
      expect(m[key], `metrics.${key} harus >= 0`).toBeGreaterThanOrEqual(0);
    }
    expect(typeof m.engagement_label).toBe('string');
    expect(typeof m.views_label).toBe('string');
  });

  test('konsistensi (live): metrics detail == item top-posts-list untuk id yang sama', async ({ api }) => {
    // Ambil post pertama dari top-posts-list, lalu bandingkan dengan detail.
    const listRes = await api.get(apiUrl('/v1/dashboard/top-posts-list?size=1'));
    expect(listRes.status()).toBe(200);
    const listItem = (await listRes.json()).data.posts[0];

    const detailRes = await api.get(apiUrl(`${POSTS_PATH}/${encodeURIComponent(listItem.id)}`));
    expect(detailRes.status()).toBe(200);
    const detail = (await detailRes.json() as PostDetailResponse).data;

    expect(detail.id).toBe(listItem.id);
    expect(detail.metrics.engagement).toBe(listItem.engagement);
    expect(detail.metrics.views).toBe(listItem.views);
    expect(detail.platform).toBe(listItem.platform);
  });

  test('id tidak dikenal → 404 not_found (body error terstruktur)', async ({ api }) => {
    const res = await api.get(apiUrl(`${POSTS_PATH}/unknown-id-xyz`));
    expect(res.status()).toBe(404);

    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('not_found');
    expect(body.error.message).toBe('post not found');
  });

  test('id kosong / spasi → 404 (bukan 500 atau hang)', async ({ api }) => {
    for (const raw of ['', '%20']) {
      const res = await api.get(apiUrl(`${POSTS_PATH}/${raw}`));
      expect(res.status(), `posts/${raw || '(kosong)'} harus 404`).toBe(404);
    }
  });

  test('id berisi karakter injeksi SQL → 404 (bukan 500, tidak bocor error DB)', async ({ api }) => {
    const res = await api.get(apiUrl(`${POSTS_PATH}/${encodeURIComponent("1' OR 1=1")}`));
    expect(res.status()).toBe(404);

    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('not_found');
  });
});
