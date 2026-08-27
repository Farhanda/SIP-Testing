import type { Page } from '@playwright/test';

/**
 * Mock API simulasi SIP Insight.
 *
 * Aplikasi target (localhost:3000) mengonsumsi endpoint API route Next.js
 * (`/api/dashboard/*`, `/api/admin/*`) yang sengaja mensimulasikan latensi
 * dan kegagalan acak (failRate 5–15%). Untuk test fungsional yang
 * deterministik, endpoint tersebut di-mock di sini dengan data fixture yang
 * bentuknya SAMA dengan respons asli — sehingga perilaku UI tetap diuji
 * (render, filter, validasi, integrasi UI→API) tanpa flakiness dari
 * kegagalan acak.
 *
 * Test yang memang ingin memvalidasi integrasi dengan API asli ada di
 * `tests/fe/smoke/*` (assert terhadap elemen yang stabil).
 */

// ---------------------------------------------------------------------------
// Fixture data (bentuk: mengikuti src/pages/api/dashboard/* di aplikasi)
// ---------------------------------------------------------------------------

const TRENDING_24H = [
  { id: 'trend-24h-01', topic: 'Transformasi layanan publik', volume: 3204, delta: '+2' },
  { id: 'trend-24h-02', topic: '#KebijakanBaru', volume: 2876, delta: 'new' },
  { id: 'trend-24h-03', topic: 'Diskusi RUU Digital', volume: 2140, delta: '+5' },
  { id: 'trend-24h-04', topic: 'Partisipasi warga kota', volume: 1890, delta: '-1' },
  { id: 'trend-24h-05', topic: 'Edukasi digital nasional', volume: 1502, delta: '0' },
];

const TRENDING_7D = [
  { id: 'trend-7d-01', topic: '#SIPIndonesia', volume: 18420, delta: '0' },
  { id: 'trend-7d-02', topic: 'Layanan publik digital', volume: 14210, delta: '+1' },
  { id: 'trend-7d-03', topic: 'Kebijakan ekonomi digital', volume: 11760, delta: '-1' },
  { id: 'trend-7d-04', topic: '#TransformasiDigital', volume: 9840, delta: '+3' },
];

const META = () => ({ generated_at: new Date().toISOString() });

/** Shared response builder for top-keywords endpoint. */
function topKeywordsResponse(keywords: string[], limit: number) {
  return {
    data: keywords.slice(0, Math.max(0, limit)).map((k, i) => ({
      id: k.toLowerCase(),
      keyword: k,
      count: 100 - i * 10,
    })),
    meta: META(),
  };
}

/** Shared pagination meta for list endpoints (scrape service / dashboard-service). */
function paginatedMeta(page: number, size: number, total: number) {
  return {
    page,
    size,
    total,
    total_pages: Math.max(1, Math.ceil(total / size)),
    generated_at: new Date().toISOString(),
  };
}

/** Standard error response shape for scrape service endpoints. */
function scrapeErrorResponse(message = 'internal server error') {
  return { error: { code: 'internal_error', message } };
}

const TREND_SERIES = () =>
  [
    { date: '2026-08-01', label: '01 Agu', volume: 320, engagement: 190 },
    { date: '2026-08-02', label: '02', volume: 340, engagement: 250 },
    { date: '2026-08-03', label: '03', volume: 300, engagement: 220 },
    { date: '2026-08-04', label: '04', volume: 460, engagement: 340 },
  ];

const SENTIMENT_SERIES = () =>
  [
    { date: '2026-08-01', label: '01 Agu', positive: 42, negative: 35 },
    { date: '2026-08-02', label: '02', positive: 44, negative: 33 },
    { date: '2026-08-03', label: '03', positive: 41, negative: 36 },
    { date: '2026-08-04', label: '04', positive: 46, negative: 30 },
  ];

const HOURLY_SERIES = (positive: boolean) =>
  Array.from({ length: 24 }, (_, hour) => ({
    hour: String(hour).padStart(2, '0'),
    label: `${String(hour).padStart(2, '0')}:00`,
    ...(positive ? { positive: 45 + (hour % 10), negative: 30 - (hour % 5) } : { volume: 40 + (hour % 15), engagement: 20 + (hour % 10) }),
  }));

const TOP_POSTS = [
  { id: 'post-1', platform: 'TikTok', post: 'Transformasi layanan publik perlu dimulai dari data...', source_url: 'https://www.tiktok.com/@user1/video/123', emotion: 'anger', emotion_color: '#B44235', topic: 'Layanan publik', engagement: 8432, engagement_label: '8,432', views: 201606, views_label: '201.61K' },
  { id: 'post-2', platform: 'TikTok', post: 'Antusiasme warga dalam diskusi digital hari ini...', source_url: 'https://www.tiktok.com/@user2/video/456', emotion: 'joy', emotion_color: '#2F7D52', topic: 'Partisipasi', engagement: 6208, engagement_label: '6,208', views: 147001, views_label: '147K' },
];

const TOPICS = [
  { id: 'topic-1', label: 'Layanan publik', pct: 72, count: 640 },
  { id: 'topic-2', label: 'Edukasi digital', pct: 47, count: 459 },
];

const TOP_ACCOUNTS = [
  { id: 'acc-1', handle: 'sip_indonesia', platform: 'X', posts: 120 },
  { id: 'acc-2', handle: 'beritakota_id', platform: 'TikTok', posts: 84 },
];

const TOP_HASHTAGS = [
  { id: 'hash-1', tag: '#SIPIndonesia', count: 1420 },
  { id: 'hash-2', tag: '#SuaraWarga', count: 954 },
];

const KPI_SUMMARY = {
  totalPost: { value: 2846, label: '2,846', deltaPct: 18.4, deltaDirection: 'up' },
  totalEngagement: { value: 48200, label: '48.2K', deltaPct: 12.1, deltaDirection: 'up' },
  views: { value: 1240000, label: '1.24M', deltaPct: 24.8, deltaDirection: 'up' },
  engagementRate: { value: 3.89, label: '3.89%', deltaPct: 0.4, deltaDirection: 'down' },
  activePlatforms: { active: 3, total: 3 },
};

// Shape snake_case sesuai kontrak Go dashboard-service — app mengonversi ke
// KPI_SUMMARY (camelCase) via transformResponse di src/services/dashboard.ts.
const KPI_SUMMARY_API = {
  total_post: { value: 2846, label: '2,846', delta_pct: 18.4, delta_direction: 'up' },
  total_engagement: { value: 48200, label: '48.2K', delta_pct: 12.1, delta_direction: 'up' },
  views: { value: 1240000, label: '1.24M', delta_pct: 24.8, delta_direction: 'up' },
  engagement_rate: { value: 3.89, label: '3.89%', delta_pct: 0.4, delta_direction: 'down' },
  active_platforms: { active: 3, total: 3 },
};

// ---------------------------------------------------------------------------
// Handler per endpoint dashboard
// ---------------------------------------------------------------------------

/**
 * Response per endpoint. Path dicocokkan terhadap DUA lapisan:
 * - `/v1/dashboard/<ep>` — arsitektur baru: app memanggil Go dashboard-service
 *   LANGSUNG via `env.dashboardApiUrl` (absolute URL, lihat src/services/dashboard.ts
 *   — semua endpoint kecuali collection-summary memakai `${env.dashboardApiUrl}/...`).
 * - `/api/dashboard/<ep>` — rute Next.js lama; masih dipakai collection-summary
 *   (relative URL, baseUrl '/api/dashboard').
 */
function dashboardResponse(path: string, url: URL, keyword: string): unknown {
  // Normalisasi: ambil segmen terakhir (nama endpoint) — sama untuk
  // '/v1/dashboard/summary' maupun '/api/dashboard/kpi-summary'.
  const segments = path.split('/').filter(Boolean);
  const ep = segments[segments.length - 1];

  switch (ep) {
    case 'trending-topic': {
      // UI mengirim period dengan huruf besar ('24H', '7D') — bandingkan
      // case-insensitive supaya 7 Days benar-benar menampilkan data 7d.
      const period = (url.searchParams.get('period') ?? '').toLowerCase();
      return {
        data: period === '7d' ? TRENDING_7D : TRENDING_24H,
        meta: META(),
      };
    }
    case 'trending-topic-multi-period': {
      // Dipakai display wall Conversation Overview (versi /v1/dashboard/*).
      // Shape = kontrak BE asli: array topik dgn deltas per periode.
      const kw = url.searchParams.get('keyword') ?? '';
      return {
        data: [
          { id: 'topic-1', label: 'Public services', value: '1,833 posts', pct: 90, deltas: [
            { label: '24h', value: '↑10%', up: true },
            { label: '7d', value: '↓14%', up: false, primary: true },
            { label: '1mo', value: '↓28%', up: false },
          ] },
          { id: 'topic-2', label: 'Tariff policy', value: '1,977 posts', pct: 72, deltas: [
            { label: '24h', value: '↑3%', up: true },
            { label: '7d', value: '↑28%', up: true, primary: true },
            { label: '1mo', value: '↓13%', up: false },
          ] },
        ],
        meta: { keyword: kw, generated_at: new Date().toISOString() },
      };
    }
    case 'collection-summary':
      return {
        data: {
          // collectionId sengaja "menggema" keyword dari query param →
          // test bisa membuktikan UI mengirim filter ke API & merender responsnya.
          collectionId: `SIP-${keyword}`,
          platformsProcessed: 3,
          postsAnalyzed: 2846,
          status: 'completed',
        },
        meta: META(),
      };
    case 'kpi-summary':
    case 'summary':
      // ⚠️ KPI memakai shape snake_case (kontrak Go dashboard-service) — app
      // mengonversi via transformResponse di src/services/dashboard.ts.
      return { data: KPI_SUMMARY_API, meta: META() };
    case 'protocol-status':
      return {
        data: {
          level: 'green',
          label: 'Green',
          description: 'Negative emotions are only 5% of conversations — sentiment under control.',
          negative_pct: 5,
          positive_pct: 52,
          period: '24h',
          emotion: { anger: 5, neutral: 30, fear: 2, joy: 55, sadness: 8 },
          sentiment: { positive: 52, neutral: 30, negative: 18 },
          total_post: 2846,
          total_engagement: 48200,
          affected_platforms: [],
          trigger_topics: [],
          influential_accounts: [],
          top_negative_quotes: [],
          positive_highlight: null,
          recent_trend: [],
          active_since: null,
          active_duration_label: '',
        },
        meta: META(),
      };
    case 'emotion-map':
      // Bentuk baru: array of { emotion, pct, color } (bukan objek)
      return {
        data: [
          { emotion: 'joy', pct: 55, color: '#2F7D52' },
          { emotion: 'neutral', pct: 30, color: '#b7b7ba' },
          { emotion: 'sadness', pct: 3, color: '#D6B5B4' },
          { emotion: 'others', pct: 12, color: '#CBD5E1' },
        ],
        meta: META(),
      };
    case 'sentiment-map':
      // Bentuk baru: array of { sentiment, pct, color } (bukan objek)
      return {
        data: [
          { sentiment: 'positive', pct: 52, color: '#2F7D52' },
          { sentiment: 'neutral', pct: 30, color: '#b7b7ba' },
          { sentiment: 'negative', pct: 18, color: '#B44235' },
        ],
        meta: META(),
      };
    case 'sentiment-trend':
      return { data: SENTIMENT_SERIES(), meta: META() };
    case 'sentiment-trend-hourly':
      return { data: HOURLY_SERIES(true), meta: META() };
    case 'conversation-trend':
      return { data: TREND_SERIES(), meta: META() };
    case 'conversation-trend-hourly':
      return { data: HOURLY_SERIES(false), meta: META() };
    case 'top-posts':
      // Bentuk baru: include source_url, views, views_label, emotion_color;
      // emotion pakai lowercase.
      return { data: TOP_POSTS, meta: META() };
    case 'top-posts-list': {
      // Paginated version used by /monitoring/dashboard/posts page.
      const sortBy = url.searchParams.get('sort_by') ?? 'view';
      const topicFilter = url.searchParams.get('topic') ?? '';
      const searchFilter = (url.searchParams.get('search') ?? '').toLowerCase();
      const emotionFilter = url.searchParams.get('emotion') ?? '';
      const pageNum = Number(url.searchParams.get('page') ?? 1);
      const size = Number(url.searchParams.get('size') ?? 10);
      let posts = [...TOP_POSTS];
      if (topicFilter) posts = posts.filter((p) => p.topic.toLowerCase() === topicFilter.toLowerCase());
      if (emotionFilter && emotionFilter !== 'all') posts = posts.filter((p) => p.emotion === emotionFilter.toLowerCase());
      if (searchFilter) posts = posts.filter((p) => p.post.toLowerCase().includes(searchFilter));
      if (sortBy === 'engagement') posts.sort((a, b) => b.engagement - a.engagement);
      else posts.sort((a, b) => b.views - a.views);
      const start = (pageNum - 1) * size;
      const pagePosts = posts.slice(start, start + size);
      return {
        data: pagePosts,
        meta: {
          generated_at: new Date().toISOString(),
          page: pageNum,
          size,
          total: posts.length,
          totalPages: Math.max(1, Math.ceil(posts.length / size)),
        },
      };
    }
    case 'topic-intelligence-detail': {
      // Used by /monitoring/dashboard/topic/:topic page.
      // ⚠️ UI baru (2026-08) MEMILIH TOPIKNYA SENDIRI (abaikan URL) dan
      // memanggil endpoint TANPA param keyword — jadi mock ini AGNOSTIK
      // terhadap slug: selalu kirim 2 post deterministik agar assertion
      // stabil, kecuali user memfilter via emotion/search di halaman.
      const topicSlug = url.searchParams.get('topic') ?? 'unknown';
      const searchFilter = (url.searchParams.get('search') ?? '').toLowerCase();
      const emotionFilter = url.searchParams.get('emotion') ?? '';
      const pageNum2 = Number(url.searchParams.get('page') ?? 1);
      const size2 = Number(url.searchParams.get('size') ?? 10);
      const filteredPosts = TOP_POSTS.filter(
        (p) =>
          (!emotionFilter || emotionFilter === 'all' || p.emotion === emotionFilter.toLowerCase()) &&
          (!searchFilter || p.post.toLowerCase().includes(searchFilter)),
      );
      const start2 = (pageNum2 - 1) * size2;
      const pageTopicPosts = filteredPosts.slice(start2, start2 + size2);
      return {
        data: {
          topic: { id: topicSlug, collectionId: '', label: topicSlug },
          stats: {
            totalPost: filteredPosts.length,
            totalEngagement: filteredPosts.reduce((sum, p) => sum + p.engagement, 0),
            negativeSentimentPct: 0,
            topPlatform: 'TikTok',
          },
          posts: pageTopicPosts.map((p) => ({
            id: p.id,
            platform: p.platform,
            post: p.post,
            topic: topicSlug,
            emotion: p.emotion,
            sentiment: 'others',
            engagement: p.engagement,
          })),
        },
        meta: {
          generated_at: new Date().toISOString(),
          page: pageNum2,
          size: size2,
          total: filteredPosts.length,
          totalPages: Math.max(1, Math.ceil(filteredPosts.length / size2)),
        },
      };
    }
    case 'topic-intelligence': {
      // Label sengaja "menggema" keyword dari query param → test data-driven
      // bisa membuktikan filter terkirim & respons ter-render (kartu
      // CollectionSummary yang dulu meng-echo sudah tidak dirender lagi).
      return { data: TOPICS.map((t) => ({ ...t, label: `${keyword} — ${t.label}` })), meta: META() };
    }
    case 'top-keywords': {
      // Display wall (Conversation Overview / Top Engagement) memakai
      // endpoint ini sebagai sumber rotasi keyword (?limit=5).
      const limit = Number(url.searchParams.get('limit') ?? 5);
      const kws = ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan'];
      return topKeywordsResponse(kws, limit);
    }
    case 'top-accounts':
      // Bentuk baru: handle tanpa @ prefix
      return { data: TOP_ACCOUNTS, meta: META() };
    case 'top-hashtags':
      return { data: TOP_HASHTAGS, meta: META() };
    default:
      return { data: {}, meta: META() };
  }
}

/**
 * Mock daftar platform option (dropdown dashboard).
 * Bentuk: /v1/scrape/platform → { data: [{ platform, platform_name }] }
 */
export function mockScrapePlatform(
  page: Page,
  platforms: { platform: string; platform_name: string }[] = [
    { platform: 'instagram', platform_name: 'Instagram' },
    { platform: 'tiktok', platform_name: 'TikTok' },
    { platform: 'twitter_x', platform_name: 'Twitter/X' },
  ],
) {
  return page.route(/\/v1\/scrape\/platform/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: platforms, meta: null }),
    });
  });
}

/**
 * Mock GET /v1/dashboard/top-keywords — SUMBER KEYWORD display wall
 * (Conversation Overview & Top Engagement berotasi atas daftar ini).
 *
 * Dipakai BERSAMA endpoint chart lain yang TIDAK di-mock: wall butuh
 * shape respons baru, jadi chart endpoints dibiarkan ke BE asli sementara
 * daftar keyword dikendalikan di sini agar deterministik.
 */
export function mockTopKeywords(page: Page, keywords: string[] = ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan']) {
  return page.route(/\/v1\/dashboard\/top-keywords/, async (route) => {
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get('limit') ?? keywords.length);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(topKeywordsResponse(keywords, limit)),
    });
  });
}

/**
 * Mock seluruh endpoint dashboard dengan data deterministik.
 *
 * Mengintersep DUA pola URL:
 * - Pola v1 (Go dashboard-service, absolute URL dari env.dashboardApiUrl).
 * - Pola api/dashboard (rute Next.js lama — masih dipakai collection-summary).
 */
export function mockDashboardApis(page: Page) {
  return page.route(/\/v1\/dashboard\/[^?#]+|\/api\/dashboard\/[^?#]+/, async (route) => {
    const url = new URL(route.request().url());
    const keyword = url.searchParams.get('keyword') ?? 'mock-keyword';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dashboardResponse(url.pathname, url, keyword)),
    });
  });
}

/**
 * Mock daftar keyword option (dropdown dashboard). Kosong → tanpa auto-select.
 *
 * Bentuk baru (2026-08-22): app memanggil `/v1/scrape/keyword` langsung ke BE.
 * Respons: { data: string[], meta: { latest: string } }
 * `latest` menentukan keyword pertama yang auto-select.
 *
 * ⚠️ Backward-compat: route lama `/api/admin/keyword/as-option-list` juga
 * di-intercept (aplikasi lama masih pakai route ini).
 */
export function mockKeywordOptions(page: Page, keywords: string[] = ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan']) {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Route baru: /v1/scrape/keyword (format string array).
  // ⚠️ Regex di-ANCHOR ke akhir path (\?|$) supaya TIDAK ikut menangkap
  //    /v1/scrape/keyword-management (endpoint halaman Keyword) — kalau lolos,
  //    respons string-array membuat UI crash "Cannot read properties of undefined".
  const routeNew = page.route(/\/v1\/scrape\/keyword(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: keywords,
        meta: { latest: keywords[0] ?? null },
      }),
    });
  });
  // Route lama: /api/admin/keyword/as-option-list (format {id, code, name} array)
  const routeOld = page.route('**/api/admin/keyword/as-option-list', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: keywords.map((name, i) => ({ id: `k-${i + 1}`, code: slug(name), name })),
      }),
    });
  });
  // Return tuple supaya caller bisa cleanup (Promise.all) — tapi backward-compat
  // karena banyak test yang assign ke single variable. Gabungkan ke Promise.all
  // wrapper sederhana:
  return Promise.all([routeNew, routeOld]) as unknown as ReturnType<typeof page.route>;
}

// ---------------------------------------------------------------------------
// Scheduler keyword (halaman Monitoring Keyword — tab Scheduled)
// ---------------------------------------------------------------------------

export type MockSchedulerItem = {
  id: string;
  keyword: string;
  platforms: string[];
  meta: string;
  cron: string;
  state: 'active' | 'hold';
};

export const MOCK_SCHEDULER_ITEMS: MockSchedulerItem[] = [
  // Platform pakai LABEL (X/Instagram/TikTok) — UI menampilkan label ini.
  // Filter di bawah membandingkan case-insensitive karena UI mengirim slug
  // lowercase (x/instagram/tiktok) sebagai query param (dicek 2026-08-14).
  { id: 'sch-1', keyword: 'RUU Digital', platforms: ['Twitter/X', 'Instagram', 'TikTok'], meta: 'Last: Today, 09:00 · Next: 10:00', cron: 'Every 1 hour', state: 'active' },
  { id: 'sch-2', keyword: 'BPJS Kesehatan', platforms: ['Twitter/X', 'TikTok'], meta: 'Last: Today, 08:30 · Next: 12:30', cron: 'Every 4 hours', state: 'active' },
  { id: 'sch-3', keyword: 'Ketenagakerjaan', platforms: ['Instagram', 'TikTok'], meta: 'Held by manual job', cron: 'Every 2 hours', state: 'hold' },
  { id: 'sch-4', keyword: 'Edukasi Digital', platforms: ['Twitter/X', 'Instagram'], meta: 'Last: Yesterday, 20:00 · Next: Today, 20:00', cron: 'Every day', state: 'active' },
  { id: 'sch-5', keyword: 'BPJS Kesehatan', platforms: ['Twitter/X'], meta: 'Last: Aug 01, 09:00 · Next: paused', cron: 'Every 6 hours', state: 'hold' },
];

// Kontrak BARU (2026-08): halaman Keyword memanggil BE langsung
// GET /v1/scrape/keyword-management?schedule_enabled=true|false — shape
// snake_case dengan platform slug & status uppercase.
const PLATFORM_TO_SLUG: Record<string, string> = {
  'Twitter/X': 'twitter_x',
  Instagram: 'instagram',
  TikTok: 'tiktok',
};

function schedulerToManagementItem(item: MockSchedulerItem) {
  // Schedule berisi timestamp nyata (bukan null) — form Edit scheduled
  // memvalidasi tanggal & menolak save bila kosong.
  const now = Date.now();
  return {
    id: item.id,
    keyword: item.keyword,
    platforms: item.platforms.map((p) => PLATFORM_TO_SLUG[p] ?? p.toLowerCase()),
    period: 'ALL',
    status: item.state === 'hold' ? 'INACTIVE' : 'ACTIVE',
    source: 'MANUAL',
    schedule_enabled: true,
    schedule: {
      start_at: new Date(now - 3600_000).toISOString(),
      end_at: new Date(now + 86_400_000).toISOString(),
      frequency: { value: 30, unit: 'MINUTE' },
      next_run_at: new Date(now + 1800_000).toISOString(),
      last_run_at: item.meta.includes('Never') ? null : new Date(now - 7200_000).toISOString(),
    },
    last_execution_status: null,
    last_run_at: null,
    last_success_at: null,
    last_failure_at: null,
    created_at: new Date(now - 172_800_000).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function unscheduledToManagementItem(item: MockUnscheduledItem) {
  return {
    id: item.id,
    keyword: item.keyword,
    platforms: item.platforms.map((p) => PLATFORM_TO_SLUG[p] ?? p.toLowerCase()),
    period: 'ALL',
    status: item.status === 'completed' || item.status === 'processing' ? 'ACTIVE' : 'INACTIVE',
    source: 'MANUAL',
    schedule_enabled: false,
    schedule: null,
    last_execution_status: item.status.toUpperCase(),
    last_run_at: item.createdAt,
    last_success_at: item.status === 'completed' ? item.createdAt : null,
    last_failure_at: item.status === 'failed' ? item.createdAt : null,
    created_at: item.createdAt,
    updated_at: item.createdAt,
  };
}

/**
 * Mock daftar scheduled keyword dengan filter query param.
 * Mengintersep DUA arsitektur:
 * - BARU: `/v1/scrape/keyword-management` dengan `schedule_enabled=true`
 *   (param filter: search/platform/status ACTIVE|INACTIVE).
 * - LAMA: `/api/admin/keyword/scheduler**` (param filter: keyword/status/platform).
 */
export function mockSchedulerList(page: Page, items: MockSchedulerItem[] = MOCK_SCHEDULER_ITEMS) {
  return page.route(/\/v1\/scrape\/keyword-management|\/api\/admin\/keyword\/scheduler/, async (route) => {
    // Mock hanya daftar (GET); aksi lain diteruskan ke API asli / mock lain
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    const isNew = url.pathname.includes('/v1/scrape/keyword-management');
    // Endpoint statistik /summary (baru) bukan daftar — biarkan lewat.
    if (isNew && url.pathname.endsWith('/summary')) {
      await route.fallback();
      return;
    }
    // Handler ini KHUSUS daftar scheduled: pada endpoint baru, On Demand
    // memakai schedule_enabled=false — biarkan handler mockUnscheduledList
    // (yang didaftarkan setelahnya) yang menangani.
    if (isNew && url.searchParams.get('schedule_enabled') === 'false') {
      await route.fallback();
      return;
    }
    const keyword = url.searchParams.get(isNew ? 'search' : 'keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const platform = url.searchParams.get('platform') ?? '';
    const pageNum = Number(url.searchParams.get('page') ?? 1);
    const size = Number(url.searchParams.get('size') ?? 5);

    const filtered = items.filter(
      (item) =>
        (!keyword || item.keyword.toLowerCase().includes(keyword.toLowerCase())) &&
        (!status ||
          status === 'all' ||
          status.toLowerCase() === item.state ||
          (isNew && status.toUpperCase() === (item.state === 'hold' ? 'INACTIVE' : 'ACTIVE'))) &&
        (!platform || platform === 'all' || item.platforms.some((p) => p.toLowerCase() === platform.toLowerCase())),
    );
    const start = (pageNum - 1) * size;
    const data = filtered.slice(start, start + size);

    if (isNew) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: data.map(schedulerToManagementItem),
          meta: paginatedMeta(pageNum, size, filtered.length),
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data,
        meta: {
          page: pageNum,
          size,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / size)),
        },
      }),
    });
  });
}

/**
 * Mock POST create keyword — dipakai modal Add scheduled MAUPUN Add On Demand:
 * keduanya kini POST ke /v1/scrape/keyword-management (beda body
 * schedule_enabled). Legacy: POST /api/admin/keyword/scheduler.
 * Daftarkan SETELAH mock list supaya menang untuk method POST.
 */
export function mockCreateScheduler(
  page: Page,
  { succeed = true }: { succeed?: boolean } = {},
) {
  return page.route(/\/v1\/scrape\/keyword-management$|\/api\/admin\/keyword\/scheduler$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    if (!succeed) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Failed to load data.' }),
      });
      return;
    }
    // Respons harus berbentuk item keyword-management lengkap DAN meng-echo
    // payload yang dikirim (keyword bisa array dari combobox).
    const reqBody = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    const rawKw = reqBody.keyword;
    const keywordEcho = Array.isArray(rawKw) ? String(rawKw[0] ?? '') : String(rawKw ?? '');
    const platforms = Array.isArray(reqBody.platform)
      ? (reqBody.platform as string[])
      : Array.isArray(reqBody.platforms)
        ? (reqBody.platforms as string[])
        : ['instagram'];
    const nowIso = new Date().toISOString();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          keyword: keywordEcho,
          platforms,
          period: String(reqBody.period ?? 'ALL'),
          status: 'ACTIVE',
          source: 'MANUAL',
          schedule_enabled: Boolean(reqBody.schedule_enabled ?? false),
          schedule: null,
          last_execution_status: null,
          last_run_at: null,
          last_success_at: null,
          last_failure_at: null,
          created_at: nowIso,
          updated_at: nowIso,
        },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Unscheduled keyword (tab On Demand)
// ---------------------------------------------------------------------------

export type MockUnscheduledItem = {
  id: string;
  keyword: string;
  platforms: string[];
  periodLabel: string;
  createdAt: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  runCount: number;
  progressPct: number;
};

export const MOCK_UNSCHEDULED_ITEMS: MockUnscheduledItem[] = [
  { id: 'un-1', keyword: 'RUU Digital', platforms: ['Twitter/X'], periodLabel: 'Last 24 hours', createdAt: new Date().toISOString(), status: 'completed', runCount: 2, progressPct: 100 },
  { id: 'un-2', keyword: 'Ketenagakerjaan', platforms: ['Instagram', 'TikTok'], periodLabel: 'Last 7 days', createdAt: new Date().toISOString(), status: 'queued', runCount: 1, progressPct: 0 },
  { id: 'un-3', keyword: 'BPJS Kesehatan', platforms: ['Twitter/X', 'TikTok'], periodLabel: 'Last 24 hours', createdAt: new Date().toISOString(), status: 'failed', runCount: 1, progressPct: 0 },
];

/**
 * Mock POST /api/admin/keyword/unscheduled atau /v1/scrape (buat keyword on-demand).
 * Aplikasi sekarang memanggil POST /v1/scrape langsung ke BE.
 * Daftarkan SETELAH `mockUnscheduledList` supaya menang untuk method POST
 * (Playwright memberi prioritas ke route yang terakhir didaftarkan).
 */
export function mockCreateUnscheduled(
  page: Page,
  { succeed = true }: { succeed?: boolean } = {},
) {
  return page.route(/\/v1\/scrape$|\/api\/admin\/keyword\/unscheduled$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    if (!succeed) {
      // Format error asli scrape service (tanpa ini UI mengira sukses)
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify(scrapeErrorResponse()),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { id: 'un-new', keyword: 'created', platforms: [], status: 'queued' },
      }),
    });
  });
}

/**
 * Mock PUT/PATCH /v1/scrape/keyword-management/:id (edit scheduled keyword).
 * Legacy: PATCH /api/admin/keyword/scheduler/:id.
 * Daftarkan SETELAH mock list supaya menang untuk method mutasi.
 */
export function mockUpdateScheduler(
  page: Page,
  { succeed = true }: { succeed?: boolean } = {},
) {
  return page.route(/\/v1\/scrape\/keyword-management\/[^/?]+$|\/api\/admin\/keyword\/scheduler\/[^/?]+$/, async (route) => {
    const method = route.request().method();
    if (method !== 'PUT' && method !== 'PATCH') {
      await route.fallback();
      return;
    }
    if (!succeed) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Failed to load data.' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'sch-1', keyword: 'updated', state: 'active' } }),
    });
  });
}

export function mockUnscheduledList(page: Page, items: MockUnscheduledItem[] = MOCK_UNSCHEDULED_ITEMS) {
  return page.route(/\/v1\/scrape\/keyword-management|\/api\/admin\/keyword\/unscheduled/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    const isNew = url.pathname.includes('/v1/scrape/keyword-management');
    // Endpoint statistik /summary (baru) bukan daftar — biarkan lewat.
    if (isNew && url.pathname.endsWith('/summary')) {
      await route.fallback();
      return;
    }
    if (isNew && url.searchParams.get('schedule_enabled') !== 'false') {
      // Bukan tab On Demand — serahkan ke mockSchedulerList
      await route.fallback();
      return;
    }
    if (url.searchParams.get('history') === 'true') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
      return;
    }
    const keyword = url.searchParams.get(isNew ? 'search' : 'keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const pageNum = Number(url.searchParams.get('page') ?? 1);
    const size = Number(url.searchParams.get('size') ?? 5);

    const filtered = items.filter(
      (item) =>
        (!keyword || item.keyword.toLowerCase().includes(keyword.toLowerCase())) &&
        (!status || status === 'all' || item.status === status),
    );
    const start = (pageNum - 1) * size;
    const data = filtered.slice(start, start + size);

    if (isNew) {
      // Tab On Demand BARU: kolom Keyword/Platform/Created/Last Run/Status —
      // kartu ringkasan statistik sudah TIDAK ada di UI.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: data.map(unscheduledToManagementItem),
          meta: paginatedMeta(pageNum, size, filtered.length),
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data,
        meta: {
          page: pageNum,
          size,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / size)),
          // Ringkasan statistik kartu tab On Demand (Total/Processing/Completed/Failed)
          totalCount: items.length,
          processingCount: items.filter((i) => i.status === 'queued' || i.status === 'processing').length,
          completedCount: items.filter((i) => i.status === 'completed').length,
          failedCount: items.filter((i) => i.status === 'failed' || i.status === 'cancelled').length,
        },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Aksi On Demand: run history, detail, cancel, retry
// ⚠️ Daftarkan SETELAH mockUnscheduledList supaya menang — Playwright memberi
//    prioritas ke route yang paling terakhir didaftarkan.
// ---------------------------------------------------------------------------

export const MOCK_HISTORY_RUNS: MockUnscheduledItem[] = [
  { id: 'run-2', keyword: 'RUU Digital', platforms: ['Twitter/X'], periodLabel: 'Last 24 hours', createdAt: '2026-08-11T09:00:00.000Z', status: 'completed', runCount: 2, progressPct: 100 },
  { id: 'run-1', keyword: 'RUU Digital', platforms: ['Twitter/X'], periodLabel: 'Last 7 days', createdAt: '2026-08-04T09:00:00.000Z', status: 'failed', runCount: 2, progressPct: 0 },
];

/** Mock GET /unscheduled?keyword=...&history=true — daftar run untuk modal Run history. */
export function mockUnscheduledHistory(page: Page, runs: MockUnscheduledItem[] = MOCK_HISTORY_RUNS) {
  return page.route(/unscheduled.*history=true/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: runs }),
    });
  });
}

/**
 * Mock GET detail keyword on-demand — halaman
 * /monitoring/keyword/unscheduled/:id.
 * Endpoint BARU (2026-08): /v1/scrape/keyword-management/unscheduled/:id;
 * UI menerima payload item unscheduled (shape lama) dibungkus { data }.
 * Opsi `failFirst` membuat N request pertama gagal 500 lalu sukses
 * (dipakai test error state + tombol Retry).
 */
export function mockUnscheduledDetail(
  page: Page,
  item: MockUnscheduledItem,
  { failFirst = 0 }: { failFirst?: number } = {},
) {
  let calls = 0;
  return page.route(
    /\/v1\/scrape\/keyword-management\/unscheduled\/[^/?]+$/,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      calls += 1;
      if (calls <= failFirst) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Failed to load data.' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: item }),
      });
    },
  );
}

/** Mock POST /unscheduled/:id/cancel — aksi Cancel baris queued/processing. */
export function mockCancelUnscheduled(
  page: Page,
  { succeed = true }: { succeed?: boolean } = {},
) {
  return page.route(/\/api\/admin\/keyword\/unscheduled\/[^/?]+\/cancel$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    if (!succeed) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Failed to load data.' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'un-2', keyword: 'cancelled', platforms: [], status: 'cancelled' } }),
    });
  });
}

/** Mock POST /unscheduled/:id/retry — aksi Retry baris failed. */
export function mockRetryUnscheduled(
  page: Page,
  { succeed = true }: { succeed?: boolean } = {},
) {
  return page.route(/\/api\/admin\/keyword\/unscheduled\/[^/?]+\/retry$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    if (!succeed) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Failed to load data.' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'un-3', keyword: 'reprocessed', platforms: [], status: 'queued' } }),
    });
  });
}

// ---------------------------------------------------------------------------
// Control endpoints (display wall pages)
// ---------------------------------------------------------------------------

/**
 * Mock GET /api/control/selected-keywords — daftar keyword yang dipilih
 * untuk display wall. Default: ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan'].
 */
export function mockSelectedKeywords(
  page: Page,
  keywords: string[] = ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan'],
) {
  return page.route('**/api/control/selected-keywords', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: keywords }),
    });
  });
}

/**
 * Mock GET /api/control/trending-topic-multi-period — trending topic
 * dengan delta per periode (24h, 7d, 1mo).
 */
export function mockTrendingTopicMultiPeriod(
  page: Page,
  topics: { id: string; label: string; value: string; pct: number; deltas: { label: string; value: string; up: boolean; primary?: boolean }[] }[] = [
    { id: 'topic-1', label: 'Public services', value: '1,833 posts', pct: 90, deltas: [
      { label: '24h', value: '↑10%', up: true },
      { label: '7d', value: '↓14%', up: false, primary: true },
      { label: '1mo', value: '↓28%', up: false },
    ]},
    { id: 'topic-2', label: 'Tariff policy', value: '1,977 posts', pct: 72, deltas: [
      { label: '24h', value: '↑3%', up: true },
      { label: '7d', value: '↑28%', up: true, primary: true },
      { label: '1mo', value: '↓13%', up: false },
    ]},
  ],
) {
  return page.route('**/api/control/trending-topic-multi-period*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: topics,
        meta: { keyword: 'mock-keyword', generated_at: new Date().toISOString() },
      }),
    });
  });
}

/**
 * Mock POST /api/auth/login — kredensial valid → token (dipakai test regresi
 * login A1). Catatan: aplikasi saat ini belum memanggil endpoint ini; mock
 * adalah jaring pengaman supaya fix login nanti (redirect ke dashboard)
 * tidak bergantung pada API auth asli. Kontrak: redirect HARUS ke
 * /monitoring/dashboard (lihat test REGRESI A1).
 */
export function mockAuthLogin(page: Page, { succeed = true }: { succeed?: boolean } = {}) {
  return page.route('**/api/auth/login', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    if (!succeed) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid credentials' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'mock-jwt-token', user: { username: 'admin', role: 'Super Admin' } }),
    });
  });
}

/** Mock POST /api/profile/change-password — dipakai test form Change password (deterministik). */
export function mockChangePassword(page: Page, { succeed = true }: { succeed?: boolean } = {}) {
  return page.route('**/api/profile/change-password', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    if (!succeed) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Failed to change password.' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Password changed successfully.' }),
    });
  });
}

// ---------------------------------------------------------------------------
// Admin user (halaman User Management)
// ---------------------------------------------------------------------------

export type MockUserItem = {
  id: string;
  username: string;
  name: string;
  role: 'Super Admin' | 'Manager' | 'Operator';
  status: 'Active' | 'Inactive';
};

export const MOCK_USER_ITEMS: MockUserItem[] = [
  { id: 'usr-001', username: 'admin', name: 'Super Admin', role: 'Super Admin', status: 'Active' },
  { id: 'usr-002', username: 'siti.rahma', name: 'Siti Rahma', role: 'Operator', status: 'Active' },
  { id: 'usr-003', username: 'budi.santoso', name: 'Budi Santoso', role: 'Manager', status: 'Active' },
  { id: 'usr-004', username: 'dewi.lestari', name: 'Dewi Lestari', role: 'Operator', status: 'Inactive' },
  { id: 'usr-005', username: 'agus.wijaya', name: 'Agus Wijaya', role: 'Manager', status: 'Active' },
];

/** Mock daftar user dengan filter query param (keyword/role/status). */
export function mockUserList(page: Page, items: MockUserItem[] = MOCK_USER_ITEMS) {
  return page.route('**/api/admin/user**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const keyword = url.searchParams.get('keyword') ?? '';
    const role = url.searchParams.get('role') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const pageNum = Number(url.searchParams.get('page') ?? 1);
    const size = Number(url.searchParams.get('size') ?? 10);

    const filtered = items.filter(
      (item) =>
        (!keyword ||
          item.username.toLowerCase().includes(keyword.toLowerCase()) ||
          item.name.toLowerCase().includes(keyword.toLowerCase())) &&
        (!role || role === 'all' || item.role === role) &&
        (!status || status === 'all' || item.status === status),
    );
    const start = (pageNum - 1) * size;
    const data = filtered.slice(start, start + size);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data,
        meta: { page: pageNum, size, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / size)) },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Scrape credential provider (halaman Provider Management)
// Konsumsi BE LANGSUNG: GET /v1/scrape/credential?page=&size=&keyword=&
// platform=&enabled= — shape snake_case sesuai kontrak Go dashboard-service.
// ---------------------------------------------------------------------------

export type MockProviderItem = {
  id: string;
  platform: string;
  platform_name: string;
  name: string;
  secret_configured: boolean;
  enabled: boolean;
  priority: number;
  req_per_second: number;
  req_per_month: number;
  request_count: number;
  req_usage_percent: number;
};

export const MOCK_PROVIDER_ITEMS: MockProviderItem[] = [
  { id: 'prv-001', platform: 'instagram', platform_name: 'Instagram', name: 'Instagram Live - Primary', secret_configured: true, enabled: true, priority: 1, req_per_second: 1, req_per_month: 50, request_count: 2, req_usage_percent: 4 },
  { id: 'prv-002', platform: 'tiktok', platform_name: 'TikTok', name: 'TikTok Live - Primary', secret_configured: true, enabled: false, priority: 2, req_per_second: 2, req_per_month: 100, request_count: 0, req_usage_percent: 0 },
  { id: 'prv-003', platform: 'twitter_x', platform_name: 'Twitter/X', name: 'TwitterX Live - Primary', secret_configured: true, enabled: true, priority: 3, req_per_second: 1, req_per_month: 200, request_count: 12, req_usage_percent: 6 },
];

/**
 * Mock daftar provider dengan filter query param (keyword/platform/enabled).
 * Hanya GET; method lain diteruskan ke handler berikutnya via `fallback()`
 * (bukan `continue()`) supaya mock create yang didaftarkan setelahnya tetap
 * bisa menangani POST pada URL yang sama.
 */
export function mockProviderList(page: Page, items: MockProviderItem[] = MOCK_PROVIDER_ITEMS) {
  return page.route(/\/v1\/scrape\/credential(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    const keyword = url.searchParams.get('keyword') ?? '';
    const platform = url.searchParams.get('platform') ?? '';
    const enabled = url.searchParams.get('enabled') ?? '';
    const pageNum = Number(url.searchParams.get('page') ?? 1);
    const size = Number(url.searchParams.get('size') ?? 10);

    const filtered = items.filter(
      (item) =>
        (!keyword || item.name.toLowerCase().includes(keyword.toLowerCase())) &&
        (!platform || platform === 'all' || item.platform === platform.toLowerCase()) &&
        (!enabled || enabled === 'all' || String(item.enabled) === enabled),
    );
    const start = (pageNum - 1) * size;
    const data = filtered.slice(start, start + size);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data,
        meta: paginatedMeta(pageNum, size, filtered.length),
      }),
    });
  });
}

/**
 * Mock POST /v1/scrape/credential (buat provider baru).
 * Daftarkan SETELAH `mockProviderList`.
 */
export function mockCreateProvider(
  page: Page,
  { succeed = true }: { succeed?: boolean } = {},
) {
  return page.route(/\/v1\/scrape\/credential$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    if (!succeed) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Failed to load data.' }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { id: 'prv-new', name: 'created', platform: 'tiktok', mode: 'live', enabled: true },
      }),
    });
  });
}

/**
 * Mock PATCH /v1/scrape/credential/:id/enable|disable (toggle switch).
 * Secara default juga MEMUTAR state item di array `items` sehingga refetch
 * daftar setelah toggle mengembalikan state baru — sama seperti perilaku API
 * asli (UI selalu refetch setelah PATCH).
 */
export function mockToggleProvider(
  page: Page,
  items: MockProviderItem[] = MOCK_PROVIDER_ITEMS,
  { succeed = true }: { succeed?: boolean } = {},
) {
  return page.route(/\/v1\/scrape\/credential\/[^/?]+\/(enable|disable)$/, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }
    if (!succeed) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Failed to load data.' }) });
      return;
    }
    const url = route.request().url();
    const id = url.split('/credential/')[1]?.split('/')[0] ?? '';
    const enable = url.endsWith('/enable');
    const item = items.find((i) => i.id === id);
    if (item) item.enabled = enable;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: item ?? null }),
    });
  });
}

/**
 * Mock POST /api/admin/user (buat user baru via modal "+ Add user").
 * Daftarkan SETELAH `mockUserList` supaya POST menang atas pola URL yang sama
 * (Playwright memberi prioritas ke route yang terakhir didaftarkan).
 */
export function mockCreateUser(
  page: Page,
  { succeed = true }: { succeed?: boolean } = {},
) {
  return page.route('**/api/admin/user', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    if (!succeed) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Failed to load data.' }),
      });
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { id: 'usr-new', username: String(body.username ?? ''), name: String(body.name ?? ''), role: String(body.role ?? 'Operator'), status: String(body.status ?? 'Active') },
      }),
    });
  });
}

/**
 * Mock PUT/PATCH /api/admin/user/:id (simpan Edit user).
 * Daftarkan SETELAH `mockUserList` supaya mutasi menang; method lain
 * diteruskan ke handler berikutnya via fallback().
 */
export function mockUpdateUser(
  page: Page,
  { succeed = true }: { succeed?: boolean } = {},
) {
  return page.route(/\/api\/admin\/user\/[^/?]+$/, async (route) => {
    const method = route.request().method();
    if (method !== 'PUT' && method !== 'PATCH') {
      await route.fallback();
      return;
    }
    if (!succeed) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Failed to load data.' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'usr-002', username: 'updated', name: 'updated' } }),
    });
  });
}

/**
 * Mock POST /api/admin/user/:id/reset-password (Reset password user).
 * Daftarkan SETELAH `mockUserList`.
 */
export function mockResetUserPassword(
  page: Page,
  { succeed = true }: { succeed?: boolean } = {},
) {
  return page.route(/\/api\/admin\/user\/[^/?]+\/reset-password$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    if (!succeed) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Failed to reset password.' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Password was reset successfully.' }),
    });
  });
}
