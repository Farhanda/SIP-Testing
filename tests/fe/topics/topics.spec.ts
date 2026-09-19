import { test, expect } from '../fixtures';
import { Env } from '../../../src/config/env';
import { isDbConfigured, query } from '../../../src/helpers/db';

const GATEWAY_URL = Env.scrapeBaseUrl; // http://10.200.101.13:8080

test.describe('Topics — Frontend v2 & Multi-Layer Alignment', () => {
  test.beforeEach(async ({ topicsPage }) => {
    await topicsPage.goto();
  });

  test('TC-FE-T01: Header, breadcrumb TOPIC INTELLIGENCE, heading, dan subtitle ter-render dengan benar', async ({
    topicsPage,
    page,
  }) => {
    // 1. Validasi URL
    await expect(page).toHaveURL(/.*\/topics/);

    // 2. Validasi Breadcrumb / Badge
    await expect(topicsPage.badge).toBeVisible();
    const badgeText = await topicsPage.badge.innerText();
    expect(badgeText).toMatch(/TOPIC INTELLIGENCE/i);

    // 3. Validasi Heading utama dan Subtitle
    await expect(topicsPage.heading).toBeVisible();
    await expect(topicsPage.subtitle).toBeVisible();

    // 4. Validasi Top Controls (Keyword input, Period dropdown, Platform dropdown, Search bar)
    await expect(topicsPage.keywordInput).toBeVisible();
    await expect(topicsPage.periodButton).toBeVisible();
    await expect(topicsPage.platformButton).toBeVisible();
    await expect(topicsPage.searchInput).toBeVisible();
  });

  test('TC-FE-T02: Tabel Top Topics menampilkan kolom (#, Topik, Jumlah Percakapan, Sentimen, Tren, Aksi) dan selaras dengan API Backend top-topics', async ({
    topicsPage,
    page,
  }) => {
    // Ambil data topik langsung dari API Backend v2
    const apiRes = await page.request.get(`${GATEWAY_URL}/v2/dashboard/top-topics?keyword=MBG&period=1M&page=1&limit=10`);
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const apiTopics = apiBody.data || [];

    // 1. Verifikasi kartu dan tabel Top Topics visible
    await expect(topicsPage.card).toBeVisible();
    await expect(topicsPage.table).toBeVisible();

    // 2. Verifikasi headers tabel
    const headers = await topicsPage.tableHeaders.allInnerTexts();
    expect(headers.length).toBeGreaterThanOrEqual(5);
    expect(headers.some(h => /Topik/i.test(h))).toBeTruthy();
    expect(headers.some(h => /Jumlah Percakapan/i.test(h))).toBeTruthy();
    expect(headers.some(h => /Sentimen/i.test(h))).toBeTruthy();
    expect(headers.some(h => /Tren/i.test(h))).toBeTruthy();
    expect(headers.some(h => /Aksi/i.test(h))).toBeTruthy();

    // 3. Ambil data baris tabel di UI
    const uiTopics = await topicsPage.getTopicsList();
    expect(uiTopics.length).toBeGreaterThan(0);

    // 4. Validasi keselarasan nama dan ranking topik dengan API
    for (let i = 0; i < Math.min(uiTopics.length, apiTopics.length); i++) {
      expect(uiTopics[i].rank).toBe(String(apiTopics[i].rank));
      const expectedTopicName = apiTopics[i].label || apiTopics[i].id || apiTopics[i].topic;
      expect(uiTopics[i].name).toBe(expectedTopicName);
      expect(uiTopics[i].count).toBe(String(apiTopics[i].count));
    }
  });

  test('TC-FE-T03: Search bar memfilter daftar topik secara instan dan akurat', async ({
    topicsPage,
  }) => {
    const initialTopics = await topicsPage.getTopicsList();
    expect(initialTopics.length).toBeGreaterThan(1);

    const targetTopic = initialTopics[0].name;

    // Cari topik spesifik
    await topicsPage.searchTopic(targetTopic);

    // Verifikasi daftar topik terfilter
    const filteredTopics = await topicsPage.getTopicsList();
    expect(filteredTopics.length).toBeGreaterThan(0);
    for (const item of filteredTopics) {
      expect(item.name.toLowerCase()).toContain(targetTopic.toLowerCase());
    }

    // Reset pencarian
    await topicsPage.searchTopic('');
    const resetTopics = await topicsPage.getTopicsList();
    expect(resetTopics.length).toBe(initialTopics.length);
  });

  test('TC-FE-T04: Visual Sentimen (stacked bar) dan Sparkline Tren ter-render pada setiap baris topik', async ({
    topicsPage,
  }) => {
    const topics = await topicsPage.getTopicsList();
    expect(topics.length).toBeGreaterThan(0);

    for (const t of topics) {
      expect(t.hasSentiment).toBeTruthy();
      expect(t.hasTrend).toBeTruthy();
      expect(t.hasAiAction).toBeTruthy();
    }
  });

  test('TC-FE-T05: Filter Periode (1 Month -> 7 Days -> 1 Month) memperbarui data topik dan peringkat percakapan', async ({
    topicsPage,
    page,
  }) => {
    // 0. Ambil jumlah topik awal pada periode default (1 Month)
    const initialTopics = await topicsPage.getTopicsList();
    expect(initialTopics.length).toBeGreaterThan(0);

    // 1. Pilih 7 Days
    const res7dPromise = page.waitForResponse(
      (res) => res.url().includes('/v2/dashboard/top-topics') && res.url().includes('period=7D'),
    );
    await topicsPage.selectPeriod('7 Days');
    const res7d = await res7dPromise;
    expect(res7d.status()).toBe(200);
    const api7d = await res7d.json();
    const expected7dCount = (api7d.data || []).length;

    const topics7d = await topicsPage.getTopicsList();
    expect(topics7d.length).toBe(expected7dCount);

    // 2. Kembalikan ke 1 Month
    await topicsPage.selectPeriod('1 Month');
    await expect(topicsPage.periodButton).toContainText(/1 Month/i);

    const topics1m = await topicsPage.getTopicsList();
    expect(topics1m.length).toBe(initialTopics.length);
    expect(topics1m.length).toBeGreaterThan(0);
  });

  test('TC-FE-T06: Klik tautan nama topik mengarahkan navigasi ke /content?topic=:topic dengan parameter yang tepat', async ({
    topicsPage,
    page,
  }) => {
    const firstRow = topicsPage.tableRows.first();
    const topicLink = firstRow.locator('td').nth(1).locator('a');
    await expect(topicLink).toBeVisible();

    const topicName = (await topicLink.innerText()).trim();
    const expectedHref = await topicLink.getAttribute('href');
    expect(expectedHref).toContain(`/content?topic=${encodeURIComponent(topicName)}`);

    // Klik link nama topik (target="_blank" membuka tab baru)
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      topicLink.click(),
    ]);
    await newPage.waitForLoadState('networkidle');

    // Verifikasi URL halaman tujuan pada tab baru
    expect(newPage.url()).toContain(`/content?topic=${encodeURIComponent(topicName)}`);
    await newPage.close();
  });

  test('TC-FE-T07: Klik tombol ✦ Analisis AI membuka slide-over drawer Analisis AI dengan wawasan topik dan dapat ditutup via tombol Close', async ({
    topicsPage,
  }) => {
    // 1. Buka drawer Analisis AI pada baris pertama
    await topicsPage.openAiAnalysis(0);

    // 2. Verifikasi drawer terbuka dan terlihat
    await expect(topicsPage.aiDrawer).toBeVisible();
    await expect(topicsPage.aiDrawerWhatHeading).toBeVisible();
    await expect(topicsPage.aiDrawerWhyHeading).toBeVisible();
    await expect(topicsPage.aiDrawerRelatedLink).toBeVisible();
    await expect(topicsPage.aiDrawerGenerateReportBtn).toBeVisible();

    // 3. Verifikasi teks wawasan AI terisi (bukan string kosong)
    const drawerText = await topicsPage.aiDrawer.innerText();
    expect(drawerText.length).toBeGreaterThan(100);
    expect(drawerText).toContain('Apa yang terjadi?');
    expect(drawerText).toContain('Kenapa terjadi?');

    // 4. Tutup drawer dan verifikasi tertutup
    await topicsPage.closeAiDrawer();
    await expect(topicsPage.aiDrawer).toBeHidden();
  });

  test('TC-FE-T08: Tautan "Lihat Percakapan Terkait" pada drawer Analisis AI mengarahkan pengguna ke halaman Topic Detail (/monitoring/dashboard/topic/:topic)', async ({
    topicsPage,
    page,
  }) => {
    await topicsPage.openAiAnalysis(0);
    await expect(topicsPage.aiDrawer).toBeVisible();

    // Dapatkan tautan Lihat Percakapan Terkait
    const relatedLink = topicsPage.aiDrawerRelatedLink;
    await expect(relatedLink).toBeVisible();
    const href = await relatedLink.getAttribute('href');
    expect(href).toMatch(/\/monitoring\/dashboard\/topic\/.+/);

    // Klik tautan dan verifikasi navigasi ke halaman Topic Detail
    await relatedLink.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(new RegExp(href!));
  });

  test('TC-FE-T09: Halaman Topic Detail menampilkan 4 kartu KPI (Total posts, Total engagement, Negative sentiment, Top platform) yang selaras dengan API topic-intelligence-detail', async ({
    topicDetailPage,
    page,
  }) => {
    const detailPromise = page.waitForResponse(
      (res) => res.url().includes('/dashboard/topic-intelligence-detail') && res.status() === 200,
    );
    await topicDetailPage.goto('Kesehatan');
    const detailRes = await detailPromise;
    const detailBody = await detailRes.json();
    const apiData = detailBody.data || {};

    // 1. Verifikasi Heading topik
    await expect(topicDetailPage.topicHeading).toHaveText('Kesehatan');

    // 2. Verifikasi 4 Kartu KPI visible
    await expect(topicDetailPage.totalPostsCard).toBeVisible();
    await expect(topicDetailPage.totalEngagementCard).toBeVisible();
    await expect(topicDetailPage.negativeSentimentCard).toBeVisible();
    await expect(topicDetailPage.topPlatformCard).toBeVisible();

    // 3. Validasi nilai KPI selaras dengan API
    const kpis = await topicDetailPage.getKpis();
    expect(kpis.totalPosts.length).toBeGreaterThan(0);
    expect(kpis.totalEngagement.length).toBeGreaterThan(0);
    expect(kpis.negativeSentiment).toMatch(/\d+%/);
    expect(kpis.topPlatform.length).toBeGreaterThan(0);

    if (apiData.stats) {
      expect(kpis.totalPosts).toBe(String(apiData.stats.totalPost));
      expect(kpis.totalEngagement.replace(/,/g, '')).toBe(String(apiData.stats.totalEngagement));
      expect(kpis.negativeSentiment).toBe(`${apiData.stats.negativeSentimentPct}%`);
      expect(kpis.topPlatform).toBe(apiData.stats.topPlatform);
    }
  });

  test('TC-FE-T10: Halaman Topic Detail tabel postingan menampilkan kolom Platform, Post, Emotion, Sentiment, Views, Engagement dan mendukung sorting', async ({
    topicDetailPage,
    page,
  }) => {
    await topicDetailPage.goto('Kesehatan');

    // 1. Verifikasi header tabel postingan
    await expect(topicDetailPage.table).toBeVisible();
    const headers = await topicDetailPage.tableHeaders.allInnerTexts();
    expect(headers).toContain('PLATFORM');
    expect(headers).toContain('POST');
    expect(headers).toContain('EMOTION');
    expect(headers).toContain('SENTIMENT');
    expect(headers).toContain('VIEWS');
    expect(headers).toContain('ENGAGEMENT');

    // 2. Verifikasi daftar postingan terisi
    const posts = await topicDetailPage.getPostsList();
    expect(posts.length).toBeGreaterThan(0);
    for (const p of posts) {
      expect(p.platform.length).toBeGreaterThan(0);
      expect(p.post.length).toBeGreaterThan(0);
      expect(p.sentiment.length).toBeGreaterThan(0);
    }

    // 3. Verifikasi dropdown Sort By
    await expect(topicDetailPage.sortBySelect).toBeVisible();
    const sortEngagementPromise = page.waitForResponse(
      (res) => res.url().includes('sort_by=engagement'),
    );
    await topicDetailPage.sortBySelect.selectOption('Engagement');
    const sortRes = await sortEngagementPromise;
    expect(sortRes.status()).toBe(200);
  });

  test('TC-FE-T11: Halaman Topic Detail filter controls (Search posts, Platform, Sentiment, Emotion) dan tombol Apply/Reset filter', async ({
    topicDetailPage,
  }) => {
    await topicDetailPage.goto('Kesehatan');

    // 1. Verifikasi filter controls ada dan interaktif
    await expect(topicDetailPage.searchInput).toBeVisible();
    await expect(topicDetailPage.platformButton).toBeVisible();
    await expect(topicDetailPage.sentimentSelect).toBeVisible();
    await expect(topicDetailPage.emotionSelect).toBeVisible();
    await expect(topicDetailPage.applyFilterButton).toBeVisible();
    await expect(topicDetailPage.resetFiltersButton).toBeVisible();

    // 2. Uji ketik pada search input
    await topicDetailPage.searchInput.fill('makan');
    expect(await topicDetailPage.searchInput.inputValue()).toBe('makan');

    // 3. Reset filter
    await topicDetailPage.resetFiltersButton.click();
    await topicDetailPage.page.waitForTimeout(300);
    expect(await topicDetailPage.searchInput.inputValue()).toBe('');
  });

  test('TC-FE-T12: Validasi Silang Database PostgreSQL (sip_db) untuk topik-topik teratas', async ({
    topicsPage,
  }) => {
    if (!isDbConfigured()) {
      test.skip(true, 'Database PostgreSQL tidak terkonfigurasi di environment');
      return;
    }

    // 1. Ambil topik teratas dari tabel UI
    const uiTopics = await topicsPage.getTopicsList();
    expect(uiTopics.length).toBeGreaterThan(0);

    // 2. Kueri langsung ke PostgreSQL sip_db tabel scraped_contents
    const dbRows = await query<{ topic: string; count: string }>(`
      SELECT 
        topic, 
        COUNT(*)::int as count 
      FROM scraped_contents 
      WHERE topic IS NOT NULL AND topic <> ''
      GROUP BY topic 
      ORDER BY count DESC
    `);

    // 3. Verifikasi bahwa nama-nama topik di UI memang terdaftar di database
    const dbTopicNames = dbRows.map(r => r.topic.toLowerCase());
    for (const t of uiTopics.slice(0, 5)) {
      expect(dbTopicNames).toContain(t.name.toLowerCase());
    }
  });
});

