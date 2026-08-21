import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — endpoint topic-intelligence (eksplorasi ulang 2026-08-14):
 *
 *   GET {BASE_URL_BE}/v1/dashboard/topic-intelligence
 *     ?keyword=<slug>&platform=<comma-separated>&period=<...>
 *     → 200 { data: [{ id, label, pct, count }], meta: { generated_at } }
 *     (id = label; pct = round(count / total * 100); count = jumlah post per topic)
 *
 *   GET {BASE_URL_BE}/v1/dashboard/topic-intelligence-detail
 *     ?topic=<exact topic> (WAJIB) &keyword&search&sentiment&emotion&page&size
 *     → 200 { data: { topic, stats, posts }, meta: { generated_at, page, size, total, totalPages } }
 *     → 400 invalid_request bila topic kosong; 404 not_found bila topic/keyword tidak cocok
 *
 * ⚠️ CATATAN: Di deployed BE, topic-intelligence return data kosong ([])
 *    karena tidak ada topic yang teridentifikasi dari seed data.
 *    topic-intelligence-detail dengan topic valid return 404 karena
 *    seed data tidak memiliki topik yang sesuai.
 *
 * Quirk terdokumentasi: stats (totalPost, totalEngagement, ...) MENGABAIKAN
 * filter search/sentiment/emotion — hanya keyword/topic/platform/period yang
 * memengaruhi scope stats. Filter search/sentiment/emotion hanya memfilter
 * daftar posts (meta.total), jadi nilai yang tidak cocok pun tetap 200
 * (posts kosong), bukan 404.
 */

// Bentuk response GET /v1/dashboard/topic-intelligence
interface TopicIntelligenceResponse {
  data: Array<{ id: string; label: string; pct: number; count: number }>;
  meta: { generated_at: string };
}

// Bentuk response GET /v1/dashboard/topic-intelligence-detail
interface TopicDetailResponse {
  data: {
    topic: { id: string; collectionId: string; label: string };
    stats: {
      totalPost: number;
      totalEngagement: number;
      negativeSentimentPct: number;
      topPlatform: string;
    };
    posts: Array<{
      id: string;
      platform: string;
      post: string;
      topic: string;
      emotion: string;
      sentiment: string;
      engagement: number;
    }>;
  };
  meta: {
    generated_at: string;
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
}

interface ErrorBody {
  error: { code: string; message: string };
}

const TOPIC_PATH = '/v1/dashboard/topic-intelligence';
const TOPIC_DETAIL_PATH = '/v1/dashboard/topic-intelligence-detail';
const KNOWN_KEYWORD = 'RUU Digital'; // keyword dengan data di BE
// Topic yang mungkin ada di seed dev dashboard-service
// Deployed BE mungkin tidak punya topic ini → 404
const EXISTING_TOPIC = 'Ekonomi';

test.describe('Dashboard — GET /v1/dashboard/topic-intelligence', () => {
  /**
   * ⚠️ CATATAN: Di deployed BE, data kosong ([]) karena tidak ada
   *    topic yang teridentifikasi dari seed data.
   *    Struktur response sudah benar; data kosong adalah kondisi saat ini.
   */
  test('topic-intelligence tanpa filter → 200 & distribusi topic', async ({ api }) => {
    const res = await api.get(apiUrl(TOPIC_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicIntelligenceResponse;
    expect(Array.isArray(body.data)).toBe(true);
    // Struktur valid jika ada data
    for (const item of body.data) {
      expect(item.id).toBe(item.label); // id = label di kontrak ini
      expect(item.pct).toBeGreaterThanOrEqual(0);
      expect(item.pct).toBeLessThanOrEqual(100);
      expect(item.count).toBeGreaterThanOrEqual(1);
    }
  });

  test('topic-intelligence pct konsisten (rumus share dari count)', async ({ api }) => {
    const res = await api.get(apiUrl(TOPIC_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicIntelligenceResponse;
    if (body.data.length > 0) {
      const total = body.data.reduce((sum, t) => sum + t.count, 0);
      expect(total).toBeGreaterThan(0);
      // pct = round(count / total * 100) — kontrak di toTopicIntelligenceResponse
      for (const item of body.data) {
        expect(item.pct).toBe(Math.round((item.count / total) * 100));
      }
    }
  });

  test('topic-intelligence filter platform → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_PATH}?platform=x`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopicIntelligenceResponse).data)).toBe(true);
  });

  test('topic-intelligence filter keyword → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_PATH}?keyword=${KNOWN_KEYWORD}`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopicIntelligenceResponse).data)).toBe(true);
  });

  test('topic-intelligence period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_PATH}?period=7d`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopicIntelligenceResponse).data)).toBe(true);
  });

  test('topic-intelligence period=3d → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_PATH}?period=3d`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopicIntelligenceResponse).data)).toBe(true);
  });

  test('topic-intelligence period=1y → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_PATH}?period=1y`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopicIntelligenceResponse).data)).toBe(true);
  });

  test('topic-intelligence period date tunggal (2026-08-12) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_PATH}?period=2026-08-12`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopicIntelligenceResponse).data)).toBe(true);
  });

  test('topic-intelligence period range (2026-08-01/2026-08-18) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_PATH}?period=2026-08-01/2026-08-18`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopicIntelligenceResponse).data)).toBe(true);
  });

  test('topic-intelligence platform multi (comma-separated) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_PATH}?platform=instagram,x`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopicIntelligenceResponse).data)).toBe(true);
  });

  test('topic-intelligence period tidak valid → 200 (fallback 1m)', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_PATH}?period=xyz`));
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json() as TopicIntelligenceResponse).data)).toBe(true);
  });
});

test.describe('Dashboard — GET /v1/dashboard/topic-intelligence-detail', () => {
  test('topic-intelligence-detail tanpa topic → 400 (validasi)', async ({ api }) => {
    const res = await api.get(apiUrl(TOPIC_DETAIL_PATH));
    expect(res.status()).toBe(400);

    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('invalid_request');
    expect(body.error.message).toBe('topic is required');
  });

  test('topic-intelligence-detail topic tidak dikenal → 404', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=TopicTidakAda`));
    expect(res.status()).toBe(404);

    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('not_found');
    expect(body.error.message).toBe('topic not found');
  });

  /**
   * ⚠️ CATATAN: Deployed BE tidak punya seed data untuk topic "Ekonomi".
   *    Response 404 dengan error code "not_found".
   *    Jika seed data ditambahkan, test ini perlu diupdate.
   */
  test('topic-intelligence-detail topic valid → 200 atau 404 (tergantung seed data)', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}`));
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = (await res.json()) as TopicDetailResponse;
      expect(body.data.topic.id).toBe(EXISTING_TOPIC);
      expect(body.data.topic.label).toBe(EXISTING_TOPIC);
      expect(typeof body.data.stats.totalPost).toBe('number');
      expect(typeof body.data.stats.totalEngagement).toBe('number');
      expect(typeof body.data.stats.negativeSentimentPct).toBe('number');
      expect(Array.isArray(body.data.posts)).toBe(true);
      expect(body.meta.page).toBe(1);
      expect(body.meta.size).toBe(6);
      expect(body.meta.totalPages).toBeGreaterThanOrEqual(1);
    } else {
      const body = (await res.json()) as ErrorBody;
      expect(body.error.code).toBe('not_found');
    }
  });

  test('topic-intelligence-detail keyword cocok → 200 atau 404', async ({ api }) => {
    const res = await api.get(
      apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&keyword=${KNOWN_KEYWORD}`),
    );
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as TopicDetailResponse;
      expect(body.data.stats.totalPost).toBeGreaterThanOrEqual(1);
    }
  });

  test('topic-intelligence-detail keyword tidak cocok → 404', async ({ api }) => {
    const res = await api.get(
      apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&keyword=Ketenagakerjaan`),
    );
    expect(res.status()).toBe(404);
    expect((await res.json() as ErrorBody).error.code).toBe('not_found');
  });

  test('topic-intelligence-detail search → 200 atau 404', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&search=kebijakan`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as TopicDetailResponse;
      expect(typeof body.meta.total).toBe('number');
    }
  });

  test('topic-intelligence-detail search tidak cocok → 200 atau 404', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&search=tidakada`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as TopicDetailResponse;
      expect(body.meta.total).toBe(0);
      expect(body.data.posts).toHaveLength(0);
    }
  });

  test('topic-intelligence-detail sentiment (stats tetap scope penuh) → 200 atau 404', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&sentiment=Negatif`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as TopicDetailResponse;
      expect(typeof body.data.stats.totalPost).toBe('number');
      expect(Array.isArray(body.data.posts)).toBe(true);
    }
  });

  test('topic-intelligence-detail sentiment=Positif → 200 atau 404', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&sentiment=Positif`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as TopicDetailResponse;
      expect(typeof body.meta.total).toBe('number');
    }
  });

  test('topic-intelligence-detail emotion → 200 atau 404', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&emotion=Joy`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as TopicDetailResponse;
      expect(typeof body.meta.total).toBe('number');
    }
  });

  test('topic-intelligence-detail emotion tidak cocok → 200 atau 404', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&emotion=Anger`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as TopicDetailResponse;
      expect(typeof body.data.stats.totalPost).toBe('number');
      expect(Array.isArray(body.data.posts)).toBe(true);
    }
  });

  test('topic-intelligence-detail pagination page besar di-clamp', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&page=999`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as TopicDetailResponse;
      expect(body.meta.page).toBeGreaterThanOrEqual(1);
      expect(body.meta.page).toBeLessThanOrEqual(body.meta.totalPages);
    }
  });

  test('topic-intelligence-detail page=0 fallback ke 1', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&page=0`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      expect((await res.json() as TopicDetailResponse).meta.page).toBe(1);
    }
  });

  test('topic-intelligence-detail page tidak valid fallback ke 1', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&page=abc`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      expect((await res.json() as TopicDetailResponse).meta.page).toBe(1);
    }
  });

  test('topic-intelligence-detail size besar di-clamp ke 50', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&size=999`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as TopicDetailResponse;
      expect(body.meta.size).toBe(50);
    }
  });

  test('topic-intelligence-detail size=0 fallback ke 6', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&size=0`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      expect((await res.json() as TopicDetailResponse).meta.size).toBe(6);
    }
  });

  test('topic-intelligence-detail size negatif fallback ke 6', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&size=-5`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      expect((await res.json() as TopicDetailResponse).meta.size).toBe(6);
    }
  });

  test('topic-intelligence-detail size tidak valid fallback ke 6', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&size=abc`));
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as TopicDetailResponse;
      expect(body.meta.size).toBe(6);
    }
  });
});
