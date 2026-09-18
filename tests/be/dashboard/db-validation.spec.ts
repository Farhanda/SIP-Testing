import { test, expect, apiUrl } from '../fixtures';
import ExcelJS from 'exceljs';
import {
  isDbConfigured,
  getDbSummaryMetrics,
  getDbPlatformMetrics,
  getDbDailyTrend,
  getDbPlatformDailyTrend,
  getDbTopAccounts,
  getDbSearchPosts,
  getDbTopPostsByPlatform,
  getDbTopPostsByEngagement,
  getDbTopPostsByViews,
  getDbPostById,
  getDbTopPostsPagination,
  getDbTopTikTokAccount,
  getDbPostRawById,
  getDbRegisteredKeywords,
  getDbKeywordsCount,
  getDbKeywordDetail,
  getDbPlatformPostCounts,
  getDbPostDetailById,
  getDbAiAnalyzedCount,
  query,
  closeDbPool,
} from '../../../src/helpers/db';

/**
 * Normalisasi `provider` DB ke kode platform API, mengikuti pola
 * `matchesPlatformFilter` di tests/be/fixtures.ts (mis. `tiktok_live` → `tiktok`).
 */
function normalizePlatform(provider: string): string {
  const n = provider.toLowerCase().replace(/_(live|dead)$/i, '');
  return n === 'twitterx' || n === 'twitter' ? 'x' : n;
}

/**
 * Test Suite: Comprehensive Direct Database Validation (API vs PostgreSQL Database)
 *
 * Menguji dan memvalidasi keakuratan data secara mendalam antara
 * endpoint Backend Dashboard Service v2 dan tabel database asli (PostgreSQL sip_db).
 *
 * Cakupan Pengujian:
 * 1. Total percakapan, total engagement, dan total views (exact match).
 * 2. Titik data tren harian tanggal demi tanggal (day-by-day exact match).
 * 3. Breakdown metrik per-platform (Instagram, TikTok, Twitter/X).
 * 4. Urutan ranking dan kalkulasi engagement/views pada Top Posts.
 * 5. Detail record baris post secara 100% presisi.
 * 6. Verifikasi jumlah data yang dianalisis oleh pipeline AI.
 */
test.describe('Direct DB Validation — API vs PostgreSQL Database', () => {
  const period = '2026-09-01/2026-09-07';
  const startUtc = '2026-09-01 00:00:00+00';
  const endUtc = '2026-09-07 23:59:59+00';

  test.beforeEach(() => {
    test.skip(
      !isDbConfigured(),
      'Kredensial database (DB_USER, DB_PASSWORD) belum diisi di .env'
    );
  });

  test.afterAll(async () => {
    await closeDbPool();
  });

  test('TC-DB-01: validasi Total Percakapan (Total Conversation) — exact match API vs database', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/summary'), { params: { period } });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbMetrics = await getDbSummaryMetrics(startUtc, endUtc);

    // Total percakapan API harus cocok 100% dengan COUNT(*) di database
    expect(apiBody.data.total_conversation.value).toBe(dbMetrics.total_posts);
  });

  test('TC-DB-02: validasi Total Engagement — exact match rumus likes+comments+shares+saves+reposts', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/summary'), { params: { period } });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbMetrics = await getDbSummaryMetrics(startUtc, endUtc);

    // Engagement API harus cocok 100% dengan kalkulasi SQL di database
    expect(apiBody.data.engagement.value).toBe(dbMetrics.total_engagement);
  });

  test('TC-DB-03: validasi Total Views — exact match sum(view_count) API vs database', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/summary'), { params: { period } });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbMetrics = await getDbSummaryMetrics(startUtc, endUtc);

    // Views API harus cocok 100% dengan SUM(view_count) di database
    expect(apiBody.data.views.value).toBe(dbMetrics.total_views);
  });

  test('TC-DB-04: validasi titik tren harian (Day-by-Day Exact Match) — 7 hari berturut-turut', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/conversation-trend'), { params: { period } });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbTrend = await getDbDailyTrend(startUtc, endUtc);

    expect(apiBody.data.length).toBe(7);

    // Verifikasi setiap tanggal dalam array tren cocok persis dengan COUNT(*) harian di database
    for (const point of apiBody.data) {
      const expectedDbCount = dbTrend[point.date] ?? 0;
      expect(point.count).toBe(expectedDbCount);
    }
  });

  test('TC-DB-05: validasi metrik platform Instagram — posts, engagement, dan views cocok 100% dengan DB', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/summary'), {
      params: { platform: 'instagram', period },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbMetrics = await getDbPlatformMetrics('%instagram%', startUtc, endUtc);

    expect(apiBody.data.total_conversation.value).toBe(dbMetrics.total_posts);
    expect(apiBody.data.engagement.value).toBe(dbMetrics.total_engagement);
    expect(apiBody.data.views.value).toBe(dbMetrics.total_views);
  });

  test('TC-DB-06: validasi metrik platform TikTok — posts, engagement, dan views cocok 100% dengan DB', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/summary'), {
      params: { platform: 'tiktok', period },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbMetrics = await getDbPlatformMetrics('%tiktok%', startUtc, endUtc);

    expect(apiBody.data.total_conversation.value).toBe(dbMetrics.total_posts);
    expect(apiBody.data.engagement.value).toBe(dbMetrics.total_engagement);
    expect(apiBody.data.views.value).toBe(dbMetrics.total_views);
  });

  test('TC-DB-07: validasi metrik platform Twitter/X — posts, engagement, dan views cocok 100% dengan DB', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/summary'), {
      params: { platform: 'x', period },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbMetrics = await getDbPlatformMetrics('%twitter%', startUtc, endUtc);

    expect(apiBody.data.total_conversation.value).toBe(dbMetrics.total_posts);
    expect(apiBody.data.engagement.value).toBe(dbMetrics.total_engagement);
    expect(apiBody.data.views.value).toBe(dbMetrics.total_views);
  });

  test('TC-DB-08: validasi ranking Top Posts berdasarkan Engagement — urutan, ID, dan nilai exact match', async ({ api }) => {
    const limit = 3;
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { limit, sort_by: 'engagement', period },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbTopPosts = await getDbTopPostsByEngagement(limit, startUtc, endUtc);

    expect(apiBody.data.length).toBe(limit);
    expect(dbTopPosts.length).toBe(limit);

    // Cocokkan ID dan kalkulasi engagement untuk tiap ranking
    for (let i = 0; i < limit; i++) {
      expect(apiBody.data[i].id).toBe(dbTopPosts[i].id);
      expect(apiBody.data[i].engagement).toBe(dbTopPosts[i].engagement);
    }
  });

  test('TC-DB-09: validasi ranking Top Posts berdasarkan Views — urutan, ID, dan nilai view exact match', async ({ api }) => {
    const limit = 3;
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { limit, sort_by: 'views', period },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbTopPosts = await getDbTopPostsByViews(limit, startUtc, endUtc);

    expect(apiBody.data.length).toBe(limit);
    expect(dbTopPosts.length).toBe(limit);

    // Cocokkan ID dan views untuk tiap ranking
    for (let i = 0; i < limit; i++) {
      expect(apiBody.data[i].id).toBe(dbTopPosts[i].id);
      expect(apiBody.data[i].views).toBe(dbTopPosts[i].views);
    }
  });

  test('TC-DB-10: verifikasi integritas 100% presisi record post teratas API top-posts vs baris tabel database', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { limit: 1 },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const topPost = apiBody.data[0];

    const dbPost = await getDbPostById(topPost.id);
    expect(dbPost).not.toBeNull();

    // Verifikasi kesesuaian nilai kolom-kolom utama
    expect(topPost.id).toBe(dbPost!.id);
    expect(topPost.views).toBe(dbPost!.views);
    expect(topPost.engagement).toBe(dbPost!.engagement);
  });

  test('TC-DB-11: mencocokkan classified_total di API sentiment dengan jumlah record teranalisis di DB', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/sentiment'));
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const apiClassifiedTotal = apiBody.data.classified_total;

    const dbAnalyzedCount = await getDbAiAnalyzedCount();

    expect(dbAnalyzedCount).toBeGreaterThan(0);
    expect(apiClassifiedTotal).toBeGreaterThan(0);
    // Selisih antara API (1 bulan) dan database dalam batas normal
    expect(Math.abs(dbAnalyzedCount - apiClassifiedTotal)).toBeLessThan(100);
  });

  test('TC-DB-12: validasi akumulasi platform database konsisten dengan total percakapan API', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/summary'), { params: { period } });
    const apiBody = await apiRes.json();
    const apiTotal = apiBody.data.total_conversation.value;

    const [ig, tiktok, x] = await Promise.all([
      getDbPlatformMetrics('%instagram%', startUtc, endUtc),
      getDbPlatformMetrics('%tiktok%', startUtc, endUtc),
      getDbPlatformMetrics('%twitter%', startUtc, endUtc),
    ]);

    const sumDbPlatforms = ig.total_posts + tiktok.total_posts + x.total_posts;

    // Penjumlahan total post seluruh platform di DB harus sama persis dengan total percakapan API
    expect(sumDbPlatforms).toBe(apiTotal);
  });

  test('TC-DB-13: validasi tren harian per-platform TikTok — 7 hari berturut-turut exact match API vs DB', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/conversation-trend'), {
      params: { platform: 'tiktok', period },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbTrend = await getDbPlatformDailyTrend('%tiktok%', startUtc, endUtc);

    expect(apiBody.data.length).toBe(7);
    for (const point of apiBody.data) {
      const expectedDbCount = dbTrend[point.date] ?? 0;
      expect(point.count).toBe(expectedDbCount);
    }
  });

  test('TC-DB-14: validasi tren harian per-platform Twitter/X — 7 hari berturut-turut exact match API vs DB', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/conversation-trend'), {
      params: { platform: 'x', period },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbTrend = await getDbPlatformDailyTrend('%twitter%', startUtc, endUtc);

    expect(apiBody.data.length).toBe(7);
    for (const point of apiBody.data) {
      const expectedDbCount = dbTrend[point.date] ?? 0;
      expect(point.count).toBe(expectedDbCount);
    }
  });

  test('TC-DB-15: validasi tren harian per-platform Instagram — 7 hari berturut-turut exact match API vs DB', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/conversation-trend'), {
      params: { platform: 'instagram', period },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbTrend = await getDbPlatformDailyTrend('%instagram%', startUtc, endUtc);

    expect(apiBody.data.length).toBe(7);
    for (const point of apiBody.data) {
      const expectedDbCount = dbTrend[point.date] ?? 0;
      expect(point.count).toBe(expectedDbCount);
    }
  });

  test('TC-DB-16: validasi konsistensi akumulasi harian platform: sum(TikTok + X + IG) = Overall Daily Trend', async ({ api }) => {
    const [overallRes, tiktokRes, xRes, igRes] = await Promise.all([
      api.get(apiUrl('/v2/dashboard/conversation-trend'), { params: { period } }),
      api.get(apiUrl('/v2/dashboard/conversation-trend'), { params: { platform: 'tiktok', period } }),
      api.get(apiUrl('/v2/dashboard/conversation-trend'), { params: { platform: 'x', period } }),
      api.get(apiUrl('/v2/dashboard/conversation-trend'), { params: { platform: 'instagram', period } }),
    ]);

    const overallBody = await overallRes.json();
    const tiktokBody = await tiktokRes.json();
    const xBody = await xRes.json();
    const igBody = await igRes.json();

    expect(overallBody.data.length).toBe(7);
    for (let i = 0; i < 7; i++) {
      const sumDaily = tiktokBody.data[i].count + xBody.data[i].count + igBody.data[i].count;
      expect(overallBody.data[i].count).toBe(sumDaily);
    }
  });

  test('TC-DB-17: validasi Top Accounts Twitter/X urutan posts — post count, engagement, dan views exact match DB', async ({ api }) => {
    const limit = 3;
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-accounts'), {
      params: { platform: 'x', period, limit, sort_by: 'posts' },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbAccounts = await getDbTopAccounts('%twitter%', 'posts', limit, startUtc, endUtc);

    expect(apiBody.data.length).toBe(limit);
    for (let i = 0; i < limit; i++) {
      expect(apiBody.data[i].account).toBe(dbAccounts[i].account);
      expect(apiBody.data[i].posts).toBe(dbAccounts[i].posts);
      expect(apiBody.data[i].engagement).toBe(dbAccounts[i].engagement);
      expect(apiBody.data[i].views).toBe(dbAccounts[i].views);
    }
  });

  test('TC-DB-18: validasi Top Accounts Twitter/X urutan engagement — ranking teratas API cocok dengan DB ORDER BY engagement', async ({ api }) => {
    const limit = 3;
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-accounts'), {
      params: { platform: 'x', period, limit, sort_by: 'engagement' },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbAccounts = await getDbTopAccounts('%twitter%', 'engagement', limit, startUtc, endUtc);

    expect(apiBody.data.length).toBe(limit);
    for (let i = 0; i < limit; i++) {
      expect(apiBody.data[i].account).toBe(dbAccounts[i].account);
      expect(apiBody.data[i].engagement).toBe(dbAccounts[i].engagement);
    }
  });

  test('TC-DB-19: validasi Top Accounts Twitter/X urutan views — ranking teratas API cocok dengan DB ORDER BY views', async ({ api }) => {
    const limit = 3;
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-accounts'), {
      params: { platform: 'x', period, limit, sort_by: 'views' },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbAccounts = await getDbTopAccounts('%twitter%', 'views', limit, startUtc, endUtc);

    expect(apiBody.data.length).toBe(limit);
    for (let i = 0; i < limit; i++) {
      expect(apiBody.data[i].account).toBe(dbAccounts[i].account);
      expect(apiBody.data[i].views).toBe(dbAccounts[i].views);
    }
  });

  test('TC-DB-20: validasi Top Accounts Instagram — ID akun, jumlah post, dan engagement cocok 100% dengan DB', async ({ api }) => {
    const limit = 2;
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-accounts'), {
      params: { platform: 'instagram', period, limit },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbAccounts = await getDbTopAccounts('%instagram%', 'posts', limit, startUtc, endUtc);

    expect(apiBody.data.length).toBe(limit);
    for (let i = 0; i < limit; i++) {
      expect(apiBody.data[i].account).toBe(dbAccounts[i].account);
      expect(apiBody.data[i].posts).toBe(dbAccounts[i].posts);
      expect(apiBody.data[i].engagement).toBe(dbAccounts[i].engagement);
    }
  });

  test('TC-DB-21: validasi presisi boundary tanggal tunggal (single-day UTC window) — total_conversation, engagement, views exact match', async ({ api }) => {
    const singlePeriod = '2026-09-04/2026-09-04';
    const dayStart = '2026-09-04 00:00:00+00';
    const dayEnd = '2026-09-04 23:59:59+00';

    const apiRes = await api.get(apiUrl('/v2/dashboard/summary'), { params: { period: singlePeriod } });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbMetrics = await getDbSummaryMetrics(dayStart, dayEnd);

    expect(apiBody.data.total_conversation.value).toBe(dbMetrics.total_posts);
    expect(apiBody.data.engagement.value).toBe(dbMetrics.total_engagement);
    expect(apiBody.data.views.value).toBe(dbMetrics.total_views);
  });

  test('TC-DB-22: validasi pencarian teks top-posts (search=gempa) — hasil API cocok dengan query ILIKE di DB', async ({ api }) => {
    const searchKeyword = 'gempa';
    const limit = 5;
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { search: searchKeyword, period, limit },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbPosts = await getDbSearchPosts(searchKeyword, limit, startUtc, endUtc);

    expect(apiBody.data.length).toBe(dbPosts.length);
    if (apiBody.data.length > 0) {
      expect(apiBody.data[0].id).toBe(dbPosts[0].id);
      expect(apiBody.data[0].views).toBe(dbPosts[0].views);
    }
  });

  test('TC-DB-23: validasi filter platform pada Top Posts (platform=instagram) — id dan engagement teratas cocok dengan DB', async ({ api }) => {
    const limit = 3;
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { platform: 'instagram', period, limit },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbPosts = await getDbTopPostsByPlatform('%instagram%', limit, startUtc, endUtc);

    expect(apiBody.data.length).toBe(dbPosts.length);
    for (let i = 0; i < dbPosts.length; i++) {
      expect(apiBody.data[i].id).toBe(dbPosts[i].id);
      expect(apiBody.data[i].engagement).toBe(dbPosts[i].engagement);
      expect(apiBody.data[i].platform).toBe('instagram');
    }
  });

  test('TC-DB-24: validasi total volume pada API sentiment untuk custom period cocok 100% dengan COUNT(*) tabel scraped_contents', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/sentiment'), {
      params: { period },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbMetrics = await getDbSummaryMetrics(startUtc, endUtc);

    // Total post pada endpoint sentiment harus sama persis dengan COUNT(*) di database untuk rentang waktu tersebut
    expect(apiBody.data.total).toBe(dbMetrics.total_posts);
  });

  test('TC-DB-25: validasi paginasi Top Posts (page=2, limit=3) — ID post cocok 100% dengan SQL LIMIT 3 OFFSET 3', async ({ api }) => {
    const limit = 3;
    const page = 2;
    const offset = (page - 1) * limit;

    const apiRes = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { period, limit, page },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbPostIds = await getDbTopPostsPagination(limit, offset, startUtc, endUtc);

    expect(apiBody.data.length).toBe(limit);
    expect(dbPostIds.length).toBe(limit);

    for (let i = 0; i < limit; i++) {
      expect(apiBody.data[i].id).toBe(dbPostIds[i]);
    }
  });

  test('TC-DB-26: validasi Top Accounts TikTok via relasi tabel scraped_tiktok_contents — author_unique_id exact match', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-accounts'), {
      params: { platform: 'tiktok', period, limit: 1 },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const topApiAccount = apiBody.data[0];

    const dbAccount = await getDbTopTikTokAccount(startUtc, endUtc);
    expect(dbAccount).not.toBeNull();

    // Akun TikTok API ('metro_tv') harus cocok dengan JOIN tabel scraped_tiktok_contents
    expect(topApiAccount.account).toBe(dbAccount!.account);
    expect(topApiAccount.posts).toBe(dbAccount!.posts);
    expect(topApiAccount.engagement).toBe(dbAccount!.engagement);
    expect(topApiAccount.views).toBe(dbAccount!.views);
  });

  test('TC-DB-27: validasi presisi format timestamp published_at ISO UTC antara post teratas API dan database', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { period, limit: 1 },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const topPost = apiBody.data[0];

    const dbRow = await getDbPostRawById(topPost.id);
    expect(dbRow).not.toBeNull();

    // Timestamp published_at di API harus cocok persis dengan timestamp baris database
    const dbPublishedIso = new Date(dbRow.published_at).toISOString();
    expect(topPost.published_at).toBe(dbPublishedIso);
  });

  test('TC-DB-28: validasi volume sentimen per-platform (TikTok & Twitter/X) cocok dengan COUNT(*) database', async ({ api }) => {
    const [tiktokRes, xRes] = await Promise.all([
      api.get(apiUrl('/v2/dashboard/sentiment'), { params: { platform: 'tiktok', period } }),
      api.get(apiUrl('/v2/dashboard/sentiment'), { params: { platform: 'x', period } }),
    ]);

    const tiktokBody = await tiktokRes.json();
    const xBody = await xRes.json();

    const [dbTiktok, dbX] = await Promise.all([
      getDbPlatformMetrics('%tiktok%', startUtc, endUtc),
      getDbPlatformMetrics('%twitter%', startUtc, endUtc),
    ]);

    expect(tiktokBody.data.total).toBe(dbTiktok.total_posts);
    expect(xBody.data.total).toBe(dbX.total_posts);
  });

  test('TC-DB-29: validasi konsistensi zero-state pada periode tanpa data — API dan database sama-sama 0', async ({ api }) => {
    const emptyPeriod = '1999-01-01/1999-01-07';
    const emptyStart = '1999-01-01 00:00:00+00';
    const emptyEnd = '1999-01-07 23:59:59+00';

    const apiRes = await api.get(apiUrl('/v2/dashboard/summary'), {
      params: { period: emptyPeriod },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbMetrics = await getDbSummaryMetrics(emptyStart, emptyEnd);

    // Keduanya harus 0
    expect(dbMetrics.total_posts).toBe(0);
    expect(dbMetrics.total_engagement).toBe(0);
    expect(dbMetrics.total_views).toBe(0);

    expect(apiBody.data.total_conversation.value).toBe(0);
    expect(apiBody.data.engagement.value).toBe(0);
    expect(apiBody.data.views.value).toBe(0);
  });

  test('TC-DB-30: validasi data keyword latest-keywords langsung terhadap tabel scrape_keywords di database', async ({ api }) => {
    const limit = 5;
    const apiRes = await api.get(apiUrl('/v2/dashboard/latest-keywords'), {
      params: { limit },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbKeywords = await getDbRegisteredKeywords(limit);

    expect(apiBody.data.length).toBe(dbKeywords.length);
    for (let i = 0; i < dbKeywords.length; i++) {
      expect(apiBody.data[i].id).toBe(dbKeywords[i].id);
      expect(apiBody.data[i].keyword).toBe(dbKeywords[i].keyword);
      expect(apiBody.data[i].status).toBe(dbKeywords[i].status);
    }
  });

  test('TC-DB-31: validasi total baris data file Excel posts-export sama persis dengan COUNT(*) tabel scraped_contents', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/posts-export'), {
      params: { period },
    });
    expect(apiRes.status()).toBe(200);

    const bodyBuffer = await apiRes.body();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bodyBuffer as any);
    const sheet = workbook.getWorksheet('Data Post');
    expect(sheet).toBeDefined();

    // Jumlah baris data post (rowCount - 1 baris header)
    const exportDataCount = sheet!.rowCount - 1;

    const dbMetrics = await getDbSummaryMetrics(startUtc, endUtc);

    // Total post dalam file Excel harus persis sama dengan COUNT(*) di database
    expect(exportDataCount).toBe(dbMetrics.total_posts);
  });

  test('TC-DB-32: validasi total baris data file Excel posts-export per-platform (TikTok) sama persis dengan DB TikTok count', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/posts-export'), {
      params: { platform: 'tiktok', period },
    });
    expect(apiRes.status()).toBe(200);

    const bodyBuffer = await apiRes.body();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bodyBuffer as any);
    const sheet = workbook.getWorksheet('Data Post');
    expect(sheet).toBeDefined();

    const exportDataCount = sheet!.rowCount - 1;

    const dbMetrics = await getDbPlatformMetrics('%tiktok%', startUtc, endUtc);

    // Total post TikTok dalam file Excel harus persis sama dengan COUNT(*) TikTok di database
    expect(exportDataCount).toBe(dbMetrics.total_posts);
  });

  test('TC-DB-33: validasi total keywords dan status ACTIVE/INACTIVE pada GET /v2/dashboard/keywords — exact match API vs scrape_keywords', async ({ api }) => {
    // 1. Total all keywords
    const resAll = await api.get(apiUrl('/v2/dashboard/keywords'));
    expect(resAll.status()).toBe(200);
    const bodyAll = await resAll.json();
    const dbTotal = await getDbKeywordsCount();
    expect(bodyAll.meta.total).toBe(dbTotal);

    // 2. Status ACTIVE
    const resActive = await api.get(apiUrl('/v2/dashboard/keywords'), { params: { status: 'ACTIVE' } });
    expect(resActive.status()).toBe(200);
    const bodyActive = await resActive.json();
    const dbActive = await getDbKeywordsCount({ status: 'ACTIVE' });
    expect(bodyActive.meta.total).toBe(dbActive);

    // 3. Status INACTIVE
    const resInactive = await api.get(apiUrl('/v2/dashboard/keywords'), { params: { status: 'INACTIVE' } });
    expect(resInactive.status()).toBe(200);
    const bodyInactive = await resInactive.json();
    const dbInactive = await getDbKeywordsCount({ status: 'INACTIVE' });
    expect(bodyInactive.meta.total).toBe(dbInactive);

    // Konsistensi matematis: ACTIVE + INACTIVE = TOTAL
    expect(bodyActive.meta.total + bodyInactive.meta.total).toBe(bodyAll.meta.total);
  });

  test('TC-DB-34: validasi filtering platform (tiktok, x, instagram) pada GET /v2/dashboard/keywords — exact match API vs scrape_keywords', async ({ api }) => {
    for (const plat of ['tiktok', 'x', 'instagram']) {
      const res = await api.get(apiUrl('/v2/dashboard/keywords'), { params: { platform: plat } });
      expect(res.status()).toBe(200);
      const body = await res.json();

      const dbCount = await getDbKeywordsCount({ platform: plat });
      expect(body.meta.total).toBe(dbCount);
    }
  });

  test('TC-DB-35: validasi pencarian search keyword pada GET /v2/dashboard/keywords — exact match API vs scrape_keywords', async ({ api }) => {
    for (const kw of ['APBN', 'bandung']) {
      const res = await api.get(apiUrl('/v2/dashboard/keywords'), { params: { search: kw } });
      expect(res.status()).toBe(200);
      const body = await res.json();

      const dbCount = await getDbKeywordsCount({ search: kw });
      expect(body.meta.total).toBe(dbCount);
    }
  });

  test('TC-DB-36: validasi konfigurasi schedule dan metadata keyword spesifik (APBN) terhadap tabel scrape_keywords', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/keywords'), { params: { search: 'APBN' } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);

    const apiItem = body.data[0];
    const dbItem = await getDbKeywordDetail('APBN');

    expect(dbItem).not.toBeNull();
    expect(apiItem.id).toBe(dbItem!.id);
    expect(apiItem.keyword).toBe(dbItem!.keyword);
    expect(apiItem.status).toBe(dbItem!.status);
    expect(apiItem.schedule.enabled).toBe(dbItem!.schedule_enabled);
    expect(apiItem.schedule.value).toBe(dbItem!.schedule_frequency_value);
    expect(apiItem.schedule.unit?.toLowerCase()).toBe(dbItem!.schedule_frequency_unit?.toLowerCase());
    if (dbItem!.schedule_next_run_at) {
      expect(apiItem.schedule.next_run_at).toBe(dbItem!.schedule_next_run_at);
    }
  });

  test('TC-DB-37: validasi total posture protokol (overall.total & per platform) pada GET /v2/dashboard/protocol-status — exact match COUNT(*) provider di DB', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/protocol-status'), { params: { period } });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbCounts = await getDbPlatformPostCounts(startUtc, endUtc);
    const dbTotal = dbCounts.instagram + dbCounts.tiktok + dbCounts.x;

    // Total post posture harus sama persis dengan COUNT(*) seluruh platform di DB
    expect(apiBody.data.overall.total).toBe(dbTotal);

    const apiPlatformTotals: Record<string, number> = {};
    for (const p of apiBody.data.platforms) {
      apiPlatformTotals[p.platform] = p.total;
    }

    for (const key of ['instagram', 'tiktok', 'x'] as const) {
      expect(apiPlatformTotals[key]).toBe(dbCounts[key]);
    }
  });

  test('TC-DB-38: validasi formula share_pct posture protokol — round(total platform / total keseluruhan dari DB × 100)', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/protocol-status'), { params: { period } });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbCounts = await getDbPlatformPostCounts(startUtc, endUtc);
    const dbTotal = dbCounts.instagram + dbCounts.tiktok + dbCounts.x;
    expect(dbTotal).toBeGreaterThan(0);

    for (const p of apiBody.data.platforms) {
      const expectedShare = Math.round((dbCounts[p.platform as keyof typeof dbCounts] / dbTotal) * 100);
      expect(p.share_pct).toBe(expectedShare);
    }

    // Akumulasi share seluruh platform = 100% (toleransi pembulatan integer ±1%)
    const sumShare = apiBody.data.platforms.reduce((acc: number, p: { share_pct: number }) => acc + p.share_pct, 0);
    expect(sumShare).toBeGreaterThanOrEqual(99);
    expect(sumShare).toBeLessThanOrEqual(101);
  });

  test('TC-DB-39: validasi total percakapan sentimen per-platform pada GET /v2/dashboard/sentiment — exact match COUNT(*) platform di DB', async ({ api }) => {
    const dbCounts = await getDbPlatformPostCounts(startUtc, endUtc);

    for (const plat of ['x', 'tiktok', 'instagram'] as const) {
      const apiRes = await api.get(apiUrl('/v2/dashboard/sentiment'), {
        params: { period, platform: plat },
      });
      expect(apiRes.status()).toBe(200);
      const apiBody = await apiRes.json();

      expect(apiBody.data.total).toBe(dbCounts[plat]);
    }
  });

  test('TC-DB-40: validasi zero-state posture protokol pada periode tanpa data — API dan database sama-sama 0', async ({ api }) => {
    const emptyPeriod = '1999-01-01/1999-01-07';
    const emptyStart = '1999-01-01 00:00:00+00';
    const emptyEnd = '1999-01-07 23:59:59+00';

    const apiRes = await api.get(apiUrl('/v2/dashboard/protocol-status'), { params: { period: emptyPeriod } });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbCounts = await getDbPlatformPostCounts(emptyStart, emptyEnd);
    expect(dbCounts.instagram + dbCounts.tiktok + dbCounts.x).toBe(0);
    expect(apiBody.data.overall.total).toBe(0);

    for (const p of apiBody.data.platforms) {
      expect(dbCounts[p.platform as keyof typeof dbCounts]).toBe(0);
      expect(p.total).toBe(0);
      expect(p.share_pct).toBe(0);
    }
  });

  test('TC-DB-41: validasi pemetaan field post teratas (teks, akun handle, platform, source_url) API top-posts vs baris tabel scraped_contents', async ({ api }) => {
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-posts'), { params: { period, limit: 1 } });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const topPost = apiBody.data[0];

    const dbPost = await getDbPostDetailById(topPost.id);
    expect(dbPost).not.toBeNull();

    // Teks post API = kolom description (bukan title)
    expect(topPost.post).toBe(dbPost!.description);
    expect(topPost.source_url).toBe(dbPost!.source_url);
    expect(topPost.platform).toBe(normalizePlatform(dbPost!.provider));
    expect(topPost.published_at).toBe(dbPost!.published_at);
    expect(topPost.views).toBe(dbPost!.views);
    expect(topPost.engagement).toBe(dbPost!.engagement);

    // `account` API = handle (author_unique_id/author_username/owner_username), bukan ID numerik DB
    expect(topPost.account).toBe(dbPost!.account);
  });

  test('TC-DB-42: validasi created_at dan urutan latest-keywords — exact match kolom scrape_keywords.created_at (DESC)', async ({ api }) => {
    const limit = 3;
    const apiRes = await api.get(apiUrl('/v2/dashboard/latest-keywords'), { params: { limit } });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbKeywords = await getDbRegisteredKeywords(limit);

    expect(apiBody.data.length).toBe(dbKeywords.length);
    for (let i = 0; i < dbKeywords.length; i++) {
      expect(apiBody.data[i].id).toBe(dbKeywords[i].id);
      expect(apiBody.data[i].created_at).toBe(dbKeywords[i].created_at);
    }

    // Urutan API mengikuti ORDER BY created_at DESC di database
    for (let i = 0; i < dbKeywords.length - 1; i++) {
      expect(new Date(dbKeywords[i].created_at).getTime()).toBeGreaterThanOrEqual(
        new Date(dbKeywords[i + 1].created_at).getTime()
      );
    }
  });

  test('TC-DB-43: validasi detail post GET /v2/dashboard/posts/{id} cocok 100% dengan row tabel scraped_contents', async ({ api }) => {
    // Ambil 1 sample post teratas dari Top Posts API
    const listRes = await api.get(apiUrl('/v2/dashboard/top-posts'), { params: { period } });
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.length).toBeGreaterThan(0);

    const samplePostId = listBody.data[0].id;

    // Panggil endpoint baru GET /v2/dashboard/posts/{id}
    const detailRes = await api.get(apiUrl(`/v2/dashboard/posts/${samplePostId}`));
    expect(detailRes.status()).toBe(200);
    const detailBody = await detailRes.json();
    const postData = detailBody.data;

    // Ambil raw record langsung dari database
    const dbRaw = await getDbPostRawById(samplePostId);
    expect(dbRaw).not.toBeNull();

    // Verifikasi ID dan metrik terperinci
    expect(postData.id).toBe(dbRaw.id);
    expect(postData.metrics.views).toBe(parseInt(dbRaw.view_count || '0', 10));
    expect(postData.metrics.likes).toBe(parseInt(dbRaw.like_count || '0', 10));
    expect(postData.metrics.comments).toBe(parseInt(dbRaw.comment_count || '0', 10));
    expect(postData.metrics.shares).toBe(parseInt(dbRaw.share_count || '0', 10));
    expect(postData.metrics.saves).toBe(parseInt(dbRaw.save_count || '0', 10));
    expect(postData.metrics.reposts).toBe(parseInt(dbRaw.repost_count || '0', 10));

    // Verifikasi formula agregasi engagement: likes + comments + shares + saves + reposts
    const expectedEngagement =
      postData.metrics.likes +
      postData.metrics.comments +
      postData.metrics.shares +
      postData.metrics.saves +
      postData.metrics.reposts;
    expect(postData.metrics.engagement).toBe(expectedEngagement);
  });

  test('TC-DB-44: validasi filter account pada GET /v2/dashboard/top-posts cocok 100% dengan COUNT(*) akun di database', async ({ api }) => {
    const targetAccount = 'infoBMKG';
    const apiRes = await api.get(apiUrl('/v2/dashboard/top-posts'), {
      params: { period, account: targetAccount },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();

    const dbRows = await query<{ count: string }>(
      `SELECT COUNT(*) FROM scraped_contents 
       WHERE account = $1 AND published_at >= $2 AND published_at <= $3`,
      [targetAccount, startUtc, endUtc]
    );
    const dbCount = parseInt(dbRows[0]?.count ?? '0', 10);

    expect(apiBody.meta.total).toBe(dbCount);
  });
});

