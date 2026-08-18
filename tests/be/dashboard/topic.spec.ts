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
 * Quirk terdokumentasi: stats (totalPost, totalEngagement, ...) MENGABAIKAN
 * filter search/sentiment/emotion — hanya keyword/topic/platform/period yang
 * memengaruhi scope stats. Filter search/sentiment/emotion hanya memfilter
 * daftar posts (meta.total), jadi nilai yang tidak cocok pun tetap 200
 * (posts kosong), bukan 404.
 *
 * Struktur & perilaku diverifikasi langsung ke BE lokal 2026-08-18.
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
const KNOWN_KEYWORD = 'kebijakan-ekonomi'; // keyword dengan data di BE
// Topic yang ADA di seed dev dashboard-service (scraped_contents.topic)
const EXISTING_TOPIC = 'Ekonomi';

test.describe('Dashboard — GET /v1/dashboard/topic-intelligence', () => {
  test('topic-intelligence tanpa filter → 200 & distribusi topic', async ({ api }) => {
    const res = await api.get(apiUrl(TOPIC_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicIntelligenceResponse;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
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
    const total = body.data.reduce((sum, t) => sum + t.count, 0);
    expect(total).toBeGreaterThan(0);
    // pct = round(count / total * 100) — kontrak di toTopicIntelligenceResponse
    for (const item of body.data) {
      expect(item.pct).toBe(Math.round((item.count / total) * 100));
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

  test('topic-intelligence-detail topic valid → 200 & struktur lengkap', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicDetailResponse;
    expect(body.data.topic.id).toBe(EXISTING_TOPIC);
    expect(body.data.topic.label).toBe(EXISTING_TOPIC);
    expect(body.data.stats.totalPost).toBeGreaterThanOrEqual(1);
    expect(typeof body.data.stats.totalEngagement).toBe('number');
    expect(typeof body.data.stats.negativeSentimentPct).toBe('number');
    expect(Array.isArray(body.data.posts)).toBe(true);
    // meta pagination default: page=1, size=6
    expect(body.meta.page).toBe(1);
    expect(body.meta.size).toBe(6);
    expect(body.meta.total).toBe(body.data.stats.totalPost);
    expect(body.meta.totalPages).toBeGreaterThanOrEqual(1);
  });

  test('topic-intelligence-detail keyword cocok → 200', async ({ api }) => {
    const res = await api.get(
      apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&keyword=${KNOWN_KEYWORD}`),
    );
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicDetailResponse;
    expect(body.data.stats.totalPost).toBeGreaterThanOrEqual(1);
  });

  test('topic-intelligence-detail keyword tidak cocok → 404', async ({ api }) => {
    // Topic valid tapi scope keyword/platform/period kosong → dianggap tidak ada
    const res = await api.get(
      apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&keyword=transformasi-layanan-publik`),
    );
    expect(res.status()).toBe(404);
    expect((await res.json() as ErrorBody).error.code).toBe('not_found');
  });

  test('topic-intelligence-detail search → 200', async ({ api }) => {
    // Post topic Ekonomi di seed berjudul "Diskusi kebijakan ekonomi terbaru"
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&search=kebijakan`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicDetailResponse;
    expect(body.meta.total).toBeGreaterThanOrEqual(1);
  });

  test('topic-intelligence-detail search tidak cocok → 200 (quirk: total 0, bukan 404)', async ({ api }) => {
    // search hanya memfilter daftar posts; stats scope penuh → tetap 200
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&search=tidakada`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicDetailResponse;
    expect(body.meta.total).toBe(0);
    expect(body.data.posts).toHaveLength(0);
    // stats tetap scope penuh (bukan hasil search)
    expect(body.data.stats.totalPost).toBeGreaterThanOrEqual(1);
  });

  test('topic-intelligence-detail sentiment (stats tetap scope penuh) → 200', async ({ api }) => {
    // Quirk terdokumentasi: stats.totalPost MENGABAIKAN filter search/sentiment/emotion
    // (hanya keyword/topic/platform/period). Jadi sentiment yang tidak cocok pun
    // tetap 200 dengan stats scope penuh — bukan 404.
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&sentiment=Negatif`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicDetailResponse;
    expect(body.data.stats.totalPost).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.data.posts)).toBe(true);
  });

  test('topic-intelligence-detail sentiment=Positif → 200 & total >= 1', async ({ api }) => {
    // Post topic Ekonomi di seed ber-sentiment "Positif"
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&sentiment=Positif`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicDetailResponse;
    expect(body.meta.total).toBeGreaterThanOrEqual(1);
  });

  test('topic-intelligence-detail emotion → 200', async ({ api }) => {
    // Post topic Ekonomi di seed punya emotion "Joy"
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&emotion=Joy`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicDetailResponse;
    expect(body.meta.total).toBeGreaterThanOrEqual(1);
  });

  test('topic-intelligence-detail emotion tidak cocok → 200 (quirk: posts kosong)', async ({ api }) => {
    // Emotion "Anger" tidak ada di seed → posts kosong, tapi stats scope penuh → 200
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&emotion=Anger`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicDetailResponse;
    expect(body.data.stats.totalPost).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.data.posts)).toBe(true);
  });

  test('topic-intelligence-detail pagination page besar di-clamp', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&page=999`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicDetailResponse;
    // page di-clamp ke [1, totalPages] dan dicerminkan di meta
    expect(body.meta.page).toBeGreaterThanOrEqual(1);
    expect(body.meta.page).toBeLessThanOrEqual(body.meta.totalPages);
  });

  test('topic-intelligence-detail page=0 fallback ke 1', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&page=0`));
    expect(res.status()).toBe(200);
    expect((await res.json() as TopicDetailResponse).meta.page).toBe(1);
  });

  test('topic-intelligence-detail page tidak valid fallback ke 1', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&page=abc`));
    expect(res.status()).toBe(200);
    expect((await res.json() as TopicDetailResponse).meta.page).toBe(1);
  });

  test('topic-intelligence-detail size besar di-clamp ke 50', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&size=999`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicDetailResponse;
    expect(body.meta.size).toBe(50);
  });

  test('topic-intelligence-detail size=0 fallback ke 6', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&size=0`));
    expect(res.status()).toBe(200);
    expect((await res.json() as TopicDetailResponse).meta.size).toBe(6);
  });

  test('topic-intelligence-detail size negatif fallback ke 6', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&size=-5`));
    expect(res.status()).toBe(200);
    expect((await res.json() as TopicDetailResponse).meta.size).toBe(6);
  });

  test('topic-intelligence-detail size tidak valid fallback ke 6', async ({ api }) => {
    const res = await api.get(apiUrl(`${TOPIC_DETAIL_PATH}?topic=${EXISTING_TOPIC}&size=abc`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TopicDetailResponse;
    expect(body.meta.size).toBe(6); // defaultPostsPageSize
  });
});
