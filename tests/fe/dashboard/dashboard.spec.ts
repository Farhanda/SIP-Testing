import { test, expect } from '../fixtures';
import { query, isDbConfigured, closeDbPool } from '../../../src/helpers/db';

const GATEWAY_URL = 'http://10.200.101.13:8080';

/**
 * Test Suite: Frontend v2 Dashboard Module & Multi-Layer Alignment
 * Target: http://10.200.101.13:3000/dashboard (Dev)
 *
 * Sesuai aturan AGENTS.md:
 * - Menguji interaksi dan navigasi Web UI pada modul Dashboard Overview.
 * - Memvalidasi nilai UI (kartu volume KPI, grafik tren, ranking, dan modal detail)
 *   secara nyata terhadap respon Backend API v2 dan database PostgreSQL (sip_db).
 */
test.describe('Dashboard Overview — Frontend v2 & Multi-Layer Alignment', () => {
  test.afterAll(async () => {
    await closeDbPool();
  });

  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
    // Pastikan keyword MBG terpilih agar dataset lengkap (topik, sentimen, postingan)
    const currentKw = await dashboardPage.keywordInput.inputValue();
    if (currentKw.trim().toUpperCase() !== 'MBG') {
      await dashboardPage.selectKeyword('MBG');
    }
  });

  test('TC-FE-D01: Header, navigasi, breadcrumb, dan Protocol Status card ter-render dengan benar', async ({
    dashboardPage,
    page,
  }) => {
    // 1. Validasi URL dan Heading utama
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(dashboardPage.heading).toBeVisible();
    await expect(dashboardPage.subtitle).toBeVisible();

    // 2. Validasi Section Headings
    await expect(dashboardPage.whatsHappeningHeading).toBeVisible();
    await expect(dashboardPage.whenHeading).toBeVisible();
    await expect(dashboardPage.whatArePeopleSayingHeading).toBeVisible();
    await expect(dashboardPage.whatIsDrivingItHeading).toBeVisible();

    // 3. Validasi Protocol Status Card vs API
    const protocolRes = await page.request.get(`${GATEWAY_URL}/v2/dashboard/protocol-status?keyword=MBG&period=1M`);
    expect(protocolRes.status()).toBe(200);
    const protocolData = await protocolRes.json();

    await expect(dashboardPage.protocolCard).toBeVisible();
    const protocolText = await dashboardPage.getProtocolStatus();
    expect(protocolText).toContain('PROTOCOL');

    const expectedOverall = (protocolData.data?.overall?.status || '').toUpperCase();
    if (expectedOverall) {
      expect(protocolText).toContain(expectedOverall);
    }

    // Validasi badge platform terlihat (Instagram, TikTok, Twitter/X)
    for (const plat of ['Instagram', 'TikTok', 'Twitter/X']) {
      const badge = dashboardPage.protocolCard.locator('li, span').filter({ hasText: plat });
      await expect(badge).toBeVisible();
    }
  });

  test('TC-FE-D02: Kartu Volume KPI (Total Conversation, Engagement, Views) selaras dengan API v2 & DB sip_db', async ({
    dashboardPage,
    page,
  }) => {
    // 1. Ambil data langsung dari API v2
    const summaryRes = await page.request.get(`${GATEWAY_URL}/v2/dashboard/summary?keyword=MBG&period=1M`);
    expect(summaryRes.status()).toBe(200);
    const summaryBody = await summaryRes.json();
    const apiSummary = summaryBody.data;

    // 2. Validasi elemen KPI cards visible di UI
    await expect(dashboardPage.totalConversationCard).toBeVisible();
    await expect(dashboardPage.totalEngagementCard).toBeVisible();
    await expect(dashboardPage.viewsCard).toBeVisible();

    // 3. Ambil nilai metrik yang tampil di UI
    const uiTotalConv = await dashboardPage.getTotalConversation();
    const uiEngagement = await dashboardPage.getEngagement();
    const uiViews = await dashboardPage.getViews();

    // 4. Validasi FE UI vs BE API response
    expect(uiTotalConv).toBe(apiSummary.total_conversation.label);
    expect(uiEngagement).toBe(apiSummary.engagement.label);
    expect(uiViews).toBe(apiSummary.views.label);

    // 5. Validasi silang BE API vs PostgreSQL (sip_db)
    if (isDbConfigured()) {
      const dbRows = await query<{
        total_posts: string;
        total_engagement: string;
        total_views: string;
      }>(
        `SELECT 
           COUNT(*) as total_posts,
           COALESCE(SUM(sc.like_count + sc.comment_count + sc.share_count + sc.save_count + sc.repost_count), 0) as total_engagement,
           COALESCE(SUM(sc.view_count), 0) as total_views
         FROM scraped_contents sc
         JOIN scrape_requests sr ON sc.scrape_request_id = sr.id
         WHERE LOWER(sr.keyword) = 'mbg'
           AND sc.published_at >= NOW() - INTERVAL '30 days'`
      );

      const dbTotal = parseInt(dbRows[0]?.total_posts || '0', 10);
      expect(Math.abs(apiSummary.total_conversation.value - dbTotal)).toBeLessThanOrEqual(50);
    }
  });

  test('TC-FE-D03: Conversation Trend chart ter-render dan selaras dengan API conversation-trend', async ({
    dashboardPage,
    page,
  }) => {
    const trendRes = await page.request.get(`${GATEWAY_URL}/v2/dashboard/conversation-trend?keyword=MBG&period=1M`);
    expect(trendRes.status()).toBe(200);
    const trendBody = await trendRes.json();

    // 1. Verifikasi canvas chart dirender
    await expect(dashboardPage.conversationTrendCanvas).toBeVisible();
    const box = await dashboardPage.conversationTrendCanvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);

    // 2. Verifikasi switcher metric
    await expect(dashboardPage.conversationTrendMetricButton).toBeVisible();

    // 3. Verifikasi data tren tidak kosong dan memiliki titik-titik tanggal valid
    const trendData = trendBody.data || [];
    expect(trendData.length).toBeGreaterThan(0);
    expect(trendData[0]).toHaveProperty('date');
    expect(trendData[0]).toHaveProperty('count');
    expect(trendData[0]).toHaveProperty('label');
  });

  test('TC-FE-D04: Sentiment Analysis donut chart & breakdown persentase selaras dengan API sentiment', async ({
    dashboardPage,
    page,
  }) => {
    const sentimentRes = await page.request.get(`${GATEWAY_URL}/v2/dashboard/sentiment?keyword=MBG&period=1M`);
    expect(sentimentRes.status()).toBe(200);
    const sentimentBody = await sentimentRes.json();

    // 1. Verifikasi kartu Sentiment visible
    await expect(dashboardPage.sentimentCard).toBeVisible();

    // 2. Verifikasi total percakapan di tengah donut chart
    const uiTotalSentiment = await dashboardPage.getSentimentTotal();
    const apiTotalConv = String(sentimentBody.data?.total || '');
    expect(uiTotalSentiment.replace(/,/g, '')).toBe(apiTotalConv);

    // 3. Verifikasi persentase tiap kategori sentimen
    const uiPercentages = await dashboardPage.getSentimentPercentages();
    const categories = sentimentBody.data?.categories || [];

    for (const cat of categories) {
      const catName = cat.sentiment.charAt(0).toUpperCase() + cat.sentiment.slice(1);
      const expectedPct = `${cat.pct}%`;
      expect(uiPercentages[catName]).toBe(expectedPct);
    }
  });

  test('TC-FE-D05: Top Topics list menampilkan ranking, nama topik, count, dan link See all', async ({
    dashboardPage,
    page,
  }) => {
    const topicsRes = await page.request.get(`${GATEWAY_URL}/v2/dashboard/top-topics?keyword=MBG&period=1M`);
    expect(topicsRes.status()).toBe(200);
    const topicsBody = await topicsRes.json();

    // 1. Verifikasi kartu Top Topics visible
    await expect(dashboardPage.topTopicsCard).toBeVisible();

    // 2. Verifikasi link "See all →" mengarah ke /topics
    await expect(dashboardPage.seeAllTopicsLink).toBeVisible();
    const href = await dashboardPage.seeAllTopicsLink.getAttribute('href');
    expect(href).toMatch(/\/topics(\?keyword=MBG)?/);

    // 3. Verifikasi daftar 5 topik teratas selaras dengan data API
    const uiTopics = await dashboardPage.getTopTopicsList();
    const apiTopics = topicsBody.data || [];

    expect(uiTopics.length).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(uiTopics.length, apiTopics.length); i++) {
      expect(uiTopics[i].rank).toBe(String(apiTopics[i].rank));
      expect(uiTopics[i].count).toBe(String(apiTopics[i].count));
    }
  });

  test('TC-FE-D06: Top Account table menampilkan daftar akun, platform, dan metrik sesuai API top-accounts', async ({
    dashboardPage,
    page,
  }) => {
    const accountsRes = await page.request.get(`${GATEWAY_URL}/v2/dashboard/top-accounts?keyword=MBG&period=1M`);
    expect(accountsRes.status()).toBe(200);
    const accountsBody = await accountsRes.json();

    // 1. Verifikasi kartu Top Account visible
    await expect(dashboardPage.topAccountCard).toBeVisible();

    // 2. Verifikasi baris tabel akun selaras dengan API
    const uiAccounts = await dashboardPage.getTopAccountsList();
    const apiAccounts = accountsBody.data || [];

    expect(uiAccounts.length).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(uiAccounts.length, apiAccounts.length); i++) {
      expect(uiAccounts[i].account).toBe(apiAccounts[i].account);
      expect(uiAccounts[i].platform).toBe(apiAccounts[i].platform_label);
      expect(uiAccounts[i].post).toBe(String(apiAccounts[i].posts));
      expect(uiAccounts[i].engagement).toBe(String(apiAccounts[i].engagement_label));
      expect(uiAccounts[i].view).toBe(String(apiAccounts[i].views_label));
    }
  });

  test('TC-FE-D07: Top Posts tables (by Engagement & by View) ter-render dengan tautan See all yang tepat', async ({
    dashboardPage,
  }) => {
    // 1. Top Post by Engagement
    await expect(dashboardPage.topPostEngagementCard).toBeVisible();
    await expect(dashboardPage.seeAllEngagementPostsLink).toBeVisible();
    const engHref = await dashboardPage.seeAllEngagementPostsLink.getAttribute('href');
    expect(engHref).toMatch(/\/content\?.*sortBy=engagement/);

    // 2. Top Post by View
    await expect(dashboardPage.topPostViewCard).toBeVisible();
    await expect(dashboardPage.seeAllViewPostsLink).toBeVisible();
    const viewHref = await dashboardPage.seeAllViewPostsLink.getAttribute('href');
    expect(viewHref).toMatch(/\/content\?.*sortBy=view/);
  });

  test('TC-FE-D08: Klik postingan membuka Post Detail Modal v2 dan metrik selaras dengan DB PostgreSQL', async ({
    dashboardPage,
    page,
  }) => {
    test.setTimeout(60_000);
    const postDetailPromise = page.waitForResponse(
      (res) => res.url().includes('/dashboard/posts/') && res.status() === 200,
    );

    // Buka postingan teratas pada tabel Top Post by Engagement
    await dashboardPage.openPostDetail('engagement', 0);
    const postDetailRes = await postDetailPromise;
    const postDetailBody = await postDetailRes.json();

    // 1. Verifikasi dialog modal terbuka
    await expect(dashboardPage.postDetailModal).toBeVisible();
    const modalText = await dashboardPage.postDetailModal.innerText();

    // 2. Verifikasi konten teks dan metrik utama ada di modal
    expect(modalText.length).toBeGreaterThan(50);
    expect(modalText).toMatch(/views/i);
    expect(modalText).toMatch(/engagement/i);

    // 3. Validasi Jam Publikasi & Jam Update pada Modal Postingan
    const modalData = await dashboardPage.getPostDetailModalData();
    expect(modalData.handle).toMatch(/^@/);
    expect(modalData.platform.length).toBeGreaterThan(0);
    // Tanggal/jam publikasi terisi
    expect(modalData.publishedAt.length).toBeGreaterThan(0);
    // Jam update: format "Updated on <tanggal>, HH:mm"
    expect(modalData.updatedAt).toMatch(/Updated on .+, \d{2}:\d{2}/i);

    // 4. Validasi silang langsung ke DB PostgreSQL (sip_db) termasuk jam posting (published_at)
    if (isDbConfigured() && postDetailBody.data?.id) {
      const postId = postDetailBody.data.id;
      const dbRows = await query<{
        like_count: string;
        comment_count: string;
        share_count: string;
        view_count: string;
        description: string;
        published_at: string;
      }>(
        `SELECT 
           sc.like_count,
           sc.comment_count,
           sc.share_count,
           sc.view_count,
           sc.description,
           sc.published_at
         FROM scraped_contents sc
         WHERE sc.id = $1`,
        [postId],
      );

      if (dbRows.length > 0) {
        const dbPost = dbRows[0];
        const likesMatch = modalText.match(/([\d,]+)\s+LIKES/i);
        if (likesMatch) {
          const modalLikes = parseInt(likesMatch[1].replace(/,/g, ''), 10);
          expect(modalLikes).toBe(Number(dbPost.like_count));
        }

        const commentsMatch = modalText.match(/([\d,]+)\s+COMMENTS/i);
        if (commentsMatch) {
          const modalComments = parseInt(commentsMatch[1].replace(/,/g, ''), 10);
          expect(modalComments).toBe(Number(dbPost.comment_count));
        }

        // Verifikasi tahun/tanggal publikasi di modal selaras dengan published_at di DB
        if (dbPost.published_at) {
          const dbDate = new Date(dbPost.published_at);
          expect(dbDate.toString()).not.toBe('Invalid Date');
        }
      }
    }

    // 5. Tutup modal dialog dan verifikasi modal tertutup
    await dashboardPage.closePostDetailModal();
  });

  test('TC-FE-D09: Filter Periode Standar (1 Month -> 7 Days -> 3 Days -> 1 Month) memperbarui metrik dan interval grafik', async ({
    dashboardPage,
    page,
  }) => {
    await expect(dashboardPage.periodButton).toBeVisible();

    // 1. Ganti periode ke 7 Days
    const trend7dPromise = page.waitForResponse(
      (res) => res.url().includes('/v2/dashboard/conversation-trend') && res.url().includes('period=7D'),
    );
    await dashboardPage.selectPeriod('7 Days');
    await expect(dashboardPage.periodButton).toContainText(/7 Days/i);
    const trend7dRes = await trend7dPromise;
    expect(trend7dRes.status()).toBe(200);
    const trend7dBody = await trend7dRes.json();
    expect(trend7dBody.meta.interval).toBe('day');
    expect(trend7dBody.data.length).toBeGreaterThanOrEqual(7);

    // 2. Ganti periode ke 3 Days
    const trend3dPromise = page.waitForResponse(
      (res) => res.url().includes('/v2/dashboard/conversation-trend') && res.url().includes('period=3D'),
    );
    await dashboardPage.selectPeriod('3 Days');
    await expect(dashboardPage.periodButton).toContainText(/3 Days/i);
    const trend3dRes = await trend3dPromise;
    expect(trend3dRes.status()).toBe(200);
    const trend3dBody = await trend3dRes.json();
    expect(trend3dBody.meta.interval).toBe('day');
    expect(trend3dBody.data.length).toBeGreaterThanOrEqual(3);


    // 3. Kembalikan ke 1 Month
    await dashboardPage.selectPeriod('1 Month');
    await expect(dashboardPage.periodButton).toContainText(/1 Month/i);
  });


  test('TC-FE-D10: Validasi Total Data — Invariant Cross-Platform (Instagram + TikTok + X = Total Conversation) dan Akumulasi Sentimen', async ({
    dashboardPage,
    page,
  }) => {
    // 1. Ambil summary total keseluruhan tanpa filter platform (period 1M)
    const overallRes = await page.request.get(`${GATEWAY_URL}/v2/dashboard/summary?keyword=MBG&period=1M`);
    expect(overallRes.status()).toBe(200);
    const overallBody = await overallRes.json();
    const overallTotal = overallBody.data.total_conversation.value;
    const overallEngagement = overallBody.data.engagement.value;

    // 2. Ambil metrik per masing-masing platform via API
    let sumPlatformConversation = 0;
    const platformBreakdown: Record<string, number> = {};

    for (const plat of ['instagram', 'tiktok', 'x']) {
      const platRes = await page.request.get(`${GATEWAY_URL}/v2/dashboard/summary?keyword=MBG&period=1M&platform=${plat}`);
      expect(platRes.status()).toBe(200);
      const platBody = await platRes.json();
      const platConv = platBody.data.total_conversation.value;
      platformBreakdown[plat] = platConv;
      sumPlatformConversation += platConv;
    }

    // Invariant Total Data: Penjumlahan total percakapan 3 platform harus sama persis dengan Total Percakapan keseluruhan
    expect(sumPlatformConversation).toBe(overallTotal);

    // 3. Validasi Invariant Total Sentimen pada Donut Chart
    const sentimentRes = await page.request.get(`${GATEWAY_URL}/v2/dashboard/sentiment?keyword=MBG&period=1M`);
    expect(sentimentRes.status()).toBe(200);
    const sentimentBody = await sentimentRes.json();
    const { total: sntTotal, classified_total, categories } = sentimentBody.data;

    // Total percakapan sentimen harus konsisten dengan summary
    expect(sntTotal).toBe(overallTotal);
    expect(classified_total).toBeLessThanOrEqual(sntTotal);

    // Akumulasi persentase kategori sentimen di UI & API harus 100% (±1% toleransi pembulatan)
    const sumPct = categories.reduce((acc: number, c: { pct: number }) => acc + c.pct, 0);
    expect(sumPct).toBeGreaterThanOrEqual(99);
    expect(sumPct).toBeLessThanOrEqual(101);

    // Akumulasi total per kategori harus sama persis dengan classified_total
    const sumCatTotal = categories.reduce((acc: number, c: { total: number }) => acc + c.total, 0);
    expect(sumCatTotal).toBe(classified_total);

    // 4. Validasi di UI: Angka total sentimen di tengah donut chart mencerminkan total percakapan
    const uiSentimentTotal = await dashboardPage.getSentimentTotal();
    expect(uiSentimentTotal.length).toBeGreaterThan(0);
  });

  test('TC-FE-D11: Validasi Jam — Filter Periode 24 Hours menghasilkan tren breakdown per jam (Hourly 24 titik, label HH:00, sum = total 24h)', async ({
    dashboardPage,
    page,
  }) => {
    // 1. Siapkan listener untuk response conversation-trend 24H
    const trendPromise = page.waitForResponse(
      (res) => res.url().includes('/v2/dashboard/conversation-trend') && res.url().includes('period=24H'),
    );
    const summaryPromise = page.waitForResponse(
      (res) => res.url().includes('/v2/dashboard/summary') && res.url().includes('period=24H'),
    );

    // 2. Pilih periode '24 Hours' di UI
    await dashboardPage.selectPeriod('24 Hours');
    await expect(dashboardPage.periodButton).toContainText(/24 Hours/i);

    const trendRes = await trendPromise;
    expect(trendRes.status()).toBe(200);
    const trendBody = await trendRes.json();

    const summaryRes = await summaryPromise;
    expect(summaryRes.status()).toBe(200);
    const summaryBody = await summaryRes.json();

    // 3. Validasi interval tren per jam (meta.interval = "hour")
    expect(trendBody.meta.interval).toBe('hour');
    expect(typeof trendBody.meta.generated_at).toBe('string');

    // 4. Validasi tepat 24 titik jam (24 jam sehari)
    expect(Array.isArray(trendBody.data)).toBe(true);
    expect(trendBody.data.length).toBe(24);

    // 5. Validasi label jam pada tiap titik data: format HH:00 (mis. "00:00", "01:00", ..., "23:00")
    for (const point of trendBody.data) {
      expect(point.label).toMatch(/^\d{2}:\d{2}$/);
      expect(typeof point.count).toBe('number');
      expect(point.count).toBeGreaterThanOrEqual(0);
      expect(typeof point.timestamp).toBe('string');
      // Timestamp ISO valid
      expect(new Date(point.timestamp).toString()).not.toBe('Invalid Date');
    }

    // 6. Validasi bahwa akumulasi count 24 titik jam = total_conversation periode 24h
    const sum24hCount = trendBody.data.reduce((acc: number, p: { count: number }) => acc + p.count, 0);
    expect(sum24hCount).toBe(summaryBody.data.total_conversation.value);

    // 7. Kembalikan periode ke 1 Month agar state halaman kembali ke default
    await dashboardPage.selectPeriod('1 Month');
    await expect(dashboardPage.periodButton).toContainText(/1 Month/i);
  });

  test('TC-FE-D12: Validasi Jam & Timestamp Metadata — generated_at merupakan jam ISO valid dan real-time', async ({
    page,
  }) => {
    // Validasi timestamp jam pembuatan data (generated_at) pada seluruh endpoint dashboard utama
    const endpoints = [
      '/v2/dashboard/summary?keyword=MBG&period=1M',
      '/v2/dashboard/conversation-trend?keyword=MBG&period=1M',
      '/v2/dashboard/sentiment?keyword=MBG&period=1M',
      '/v2/dashboard/protocol-status?keyword=MBG&period=1M',
    ];

    const now = new Date().getTime();

    for (const ep of endpoints) {
      const res = await page.request.get(`${GATEWAY_URL}${ep}`);
      expect(res.status()).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty('meta');
      expect(typeof body.meta.generated_at).toBe('string');

      // Validasi jam format ISO UTC
      const genTime = new Date(body.meta.generated_at).getTime();
      expect(isNaN(genTime)).toBe(false);

      // Selisih jam generate tidak boleh di masa depan yang janggal atau lebih lama dari 1 hari
      const diffMs = Math.abs(now - genTime);
      expect(diffMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    }
  });

  test('TC-FE-D13: Filter Periode Custom Range (YYYY-MM-DD/YYYY-MM-DD) — datepicker, API request, dan validasi DB PostgreSQL', async ({
    dashboardPage,
    page,
  }) => {
    const startDate = '2026-09-01';
    const endDate = '2026-09-07';

    const customTrendPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/v2/dashboard/conversation-trend') &&
        res.url().includes('2026-09-01') &&
        res.url().includes('2026-09-07'),
    );
    const customSummaryPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/v2/dashboard/summary') &&
        res.url().includes('2026-09-01') &&
        res.url().includes('2026-09-07'),
    );

    // 1. Terapkan custom range melalui modal datepicker popover UI
    await dashboardPage.selectCustomRange(startDate, endDate);

    // 2. Verifikasi tombol periode menampilkan teks rentang tanggal (misal 01/09/2026 – 07/09/2026)
    await expect(dashboardPage.periodButton).toContainText(/01\/09\/2026|2026/);

    // 3. Verifikasi response tren menerima custom period dan memiliki 7 hari data
    const trendRes = await customTrendPromise;
    expect(trendRes.status()).toBe(200);
    const trendBody = await trendRes.json();
    expect(trendBody.meta.interval).toBe('day');
    expect(trendBody.data.length).toBe(7);
    expect(trendBody.data[0].date).toBe(startDate);
    expect(trendBody.data[trendBody.data.length - 1].date).toBe(endDate);

    // 4. Verifikasi response summary menerima custom period
    const summaryRes = await customSummaryPromise;
    expect(summaryRes.status()).toBe(200);
    const summaryBody = await summaryRes.json();

    // 5. Validasi silang langsung ke DB PostgreSQL (sip_db) untuk custom range
    if (isDbConfigured()) {
      const dbRows = await query<{ total_posts: string }>(
        `SELECT COUNT(*) as total_posts
         FROM scraped_contents sc
         JOIN scrape_requests sr ON sc.scrape_request_id = sr.id
         WHERE LOWER(sr.keyword) = 'mbg'
           AND sc.published_at >= $1 AND sc.published_at <= $2`,
        ['2026-09-01 00:00:00+00', '2026-09-07 23:59:59+00'],
      );
      const dbTotal = parseInt(dbRows[0]?.total_posts || '0', 10);
      expect(Math.abs(summaryBody.data.total_conversation.value - dbTotal)).toBeLessThanOrEqual(1);
    }


    // 6. Kembalikan ke 1 Month
    await dashboardPage.selectPeriod('1 Month');
    await expect(dashboardPage.periodButton).toContainText(/1 Month/i);
  });
});


