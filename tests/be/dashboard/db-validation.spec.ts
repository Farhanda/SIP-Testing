import { test, expect, apiUrl } from '../fixtures';
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
  getDbAiAnalyzedCount,
  closeDbPool,
} from '../../../src/helpers/db';

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
});
