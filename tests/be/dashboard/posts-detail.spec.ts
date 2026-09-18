import { test, expect, apiUrl } from '../fixtures';

/**
 * Test GET /v2/dashboard/posts/{id} — detail satu post untuk panel konten (v2).
 *
 * Path Parameters:
 * - id: UUID unik konten (scraped_content_id)
 *
 * Kontrak Swagger:
 *   200: {
 *     data: {
 *       id: string,
 *       platform: string,
 *       platform_label: string,
 *       name: string,
 *       account: string,
 *       post: string,
 *       source_url: string,
 *       thumbnail_url: string,
 *       published_at: string,
 *       published_label: string,
 *       updated_at: string,
 *       sentiment: string,
 *       topic: string,
 *       emotion: string,
 *       metrics: {
 *         views: number,
 *         views_label: string,
 *         engagement: number,
 *         engagement_label: string,
 *         likes: number,
 *         comments: number,
 *         shares: number,
 *         saves: number,
 *         reposts: number
 *       },
 *       hashtags: string[]
 *     },
 *     meta: { generated_at: string }
 *   }
 *   404: { error: { code: 'not_found', message: 'post not found' } }
 */
test.describe('GET /v2/dashboard/posts/{id} (v2)', () => {
  let samplePostId: string;

  test.beforeAll(async ({ request }) => {
    // Ambil sample ID post yang valid dari Top Posts
    const listRes = await request.get(apiUrl('/v2/dashboard/top-posts'));
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.length).toBeGreaterThan(0);
    samplePostId = listBody.data[0].id;
  });

  test('TC-V2-PDT-01: valid post ID mengembalikan HTTP 200 dengan struktur konten detail lengkap', async ({ api }) => {
    const res = await api.get(apiUrl(`/v2/dashboard/posts/${samplePostId}`));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    const post = body.data;
    expect(post.id).toBe(samplePostId);
    expect(typeof post.platform).toBe('string');
    expect(['tiktok', 'x', 'instagram']).toContain(post.platform);
    expect(typeof post.platform_label).toBe('string');
    expect(typeof post.account).toBe('string');
    expect(typeof post.post).toBe('string');
    expect(typeof post.source_url).toBe('string');
    expect(typeof post.published_at).toBe('string');
    expect(typeof post.published_label).toBe('string');
    expect(typeof post.updated_at).toBe('string');
  });

  test('TC-V2-PDT-02: validasi skema metrik dan formula engagement = likes + comments + shares + saves + reposts', async ({ api }) => {
    const res = await api.get(apiUrl(`/v2/dashboard/posts/${samplePostId}`));
    expect(res.status()).toBe(200);

    const { data: post } = await res.json();
    expect(post).toHaveProperty('metrics');
    const m = post.metrics;

    expect(typeof m.views).toBe('number');
    expect(typeof m.views_label).toBe('string');
    expect(typeof m.engagement).toBe('number');
    expect(typeof m.engagement_label).toBe('string');
    expect(typeof m.likes).toBe('number');
    expect(typeof m.comments).toBe('number');
    expect(typeof m.shares).toBe('number');
    expect(typeof m.saves).toBe('number');
    expect(typeof m.reposts).toBe('number');

    // Konsistensi matematis engagement 5 komponen
    const expectedEngagement = m.likes + m.comments + m.shares + m.saves + m.reposts;
    expect(m.engagement).toBe(expectedEngagement);
  });

  test('TC-V2-PDT-03: hashtags selalu berupa array string (tidak pernah null)', async ({ api }) => {
    const res = await api.get(apiUrl(`/v2/dashboard/posts/${samplePostId}`));
    expect(res.status()).toBe(200);

    const { data: post } = await res.json();
    expect(Array.isArray(post.hashtags)).toBe(true);
    for (const tag of post.hashtags) {
      expect(typeof tag).toBe('string');
    }
  });

  test('TC-V2-PDT-04: ID post tidak dikenal mengembalikan HTTP 404 Not Found dengan struktur error standar', async ({ api }) => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api.get(apiUrl(`/v2/dashboard/posts/${nonExistentId}`));
    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error.code).toBe('not_found');
    expect(body.error.message).toContain('not found');
  });

  test('TC-V2-PDT-05: ID malformed / bukan UUID mengembalikan HTTP 404', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/posts/invalid-id-xyz'));
    expect(res.status()).toBe(404);
  });

  test('TC-V2-PDT-06: method selain GET (POST/DELETE) ditolak dengan status 404/405', async ({ api }) => {
    const resPost = await api.post(apiUrl(`/v2/dashboard/posts/${samplePostId}`));
    expect([404, 405]).toContain(resPost.status());

    const resDelete = await api.delete(apiUrl(`/v2/dashboard/posts/${samplePostId}`));
    expect([404, 405]).toContain(resDelete.status());
  });
});

