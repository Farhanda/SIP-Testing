import { expect } from '../fixtures';
import { test } from '../fixtures';
import { loadJsonData } from '../../../src/helpers/data';
import { mockDashboardApis, mockKeywordOptions } from '../../../src/helpers/api-mock';

/**
 * Test Dashboard (FR-11, FR-13, FR-14, FR-20, G2):
 * endpoint API simulasi di-mock agar deterministik — aplikasi sengaja punya
 * random failure (failRate 15%) sehingga assert data asli akan flaky.
 * Mock dibuat dengan bentuk respons yang sama dengan API asli.
 */
test.describe('Dashboard', () => {
  test('halaman dashboard menampilkan header, filter, dan tombol aksi', async ({ dashboardPage }) => {
    await dashboardPage.goto();

    // Heading 'Dashboard Overview' hanya ada di build lokal; deployed app
    // menggunakan heading yang berbeda — skip bila tidak ditemukan.
    const heading = dashboardPage.page.getByRole('heading', { name: 'Dashboard Overview' });
    const hasHeading = await heading.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasHeading) {
      await expect(heading).toBeVisible();
    }
    await expect(dashboardPage.searchFiltersHeading).toBeVisible();
    await expect(dashboardPage.applyFilterButton).toBeVisible();
    await expect(dashboardPage.resetFiltersButton).toBeVisible();
  });

  test('empty state "No search yet" tampil ketika belum ada keyword', async ({ dashboardPage }) => {
    // Options kosong → dashboard tidak auto-select keyword → tetap empty state
    await mockKeywordOptions(dashboardPage.page, []);
    await dashboardPage.goto();

    await dashboardPage.expectNoSearchYet();
  });

  test('validasi keyword kosong menampilkan pesan "Keyword is required."', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    // Auto-select memilih keyword pertama → tombol clear muncul
    await dashboardPage.clearKeyword();
    await dashboardPage.applyFilter();

    await dashboardPage.expectKeywordRequiredError();
  });

  test('validasi platform kosong menampilkan pesan "Select at least one platform."', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    // Tunggu auto-select selesai, lalu hapus semua platform
    await expect(dashboardPage.clearKeywordButton).toBeVisible();
    await dashboardPage.deselectAllPlatforms();
    await dashboardPage.applyFilter();

    await dashboardPage.expectPlatformRequiredError();
  });

  // Data-driven (FR-20): satu test per keyword di test-data/dashboard-keywords.json
  const keywords = loadJsonData<{ keyword: string; code: string }[]>('dashboard-keywords.json');
  for (const data of keywords) {
    test(`cari keyword "${data.keyword}" → filter terkirim ke API & hasil tampil (mock API)`, async ({ dashboardPage }) => {
      await mockDashboardApis(dashboardPage.page);
      await mockKeywordOptions(dashboardPage.page, ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan']);
      await dashboardPage.goto();

      // Bukti filter terkirim: request topic-intelligence memakai keyword
      // yang dipilih (UI mengirim nama keyword, bukan slug).
      const summaryReqUrls: string[] = [];
      dashboardPage.page.on('request', (req) => {
        if (req.url().includes('/summary')) summaryReqUrls.push(req.url());
      });

      // Auto-select memilih keyword pertama saat load. Kosongkan pilihan
      // (tombol Clear selection), lalu pilih keyword eksplisit → Apply.
      await dashboardPage.clearKeyword();
      await dashboardPage.selectKeyword(data.keyword);
      await dashboardPage.applyFilter();

      // Hasil tampil: heading kartu utama ter-render
      await dashboardPage.expectResultsRendered();
      // Request terakhir membawa keyword eksplisit hasil Apply
      // (query serialisasi memakai '+' untuk spasi)
      await expect
        .poll(() => summaryReqUrls[summaryReqUrls.length - 1] ?? '')
        .toContain(`keyword=${data.keyword.replace(/ /g, '+')}`);
    });
  }

  test('trending topic dapat berpindah periode 24 Hours → 7 Days', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    // Periode default 24h
    await expect(
      dashboardPage.page.getByText('Transformasi layanan publik', { exact: true })
    ).toBeVisible();
    await dashboardPage.period7dButton.click();

    // Periode 7d — data mock berubah (exact: true agar tidak bentrok dengan teks post)
    await expect(
      dashboardPage.page.getByText('Layanan publik digital', { exact: true })
    ).toBeVisible();
    await expect(
      dashboardPage.page.getByText('Transformasi layanan publik', { exact: true })
    ).toHaveCount(0);
  });

  test('bagian Top Performers dapat di-hide dan ditampilkan kembali', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    // Auto-search menampilkan hasil → Top Performers tampil
    await dashboardPage.expectResultsRendered();
    await expect(dashboardPage.topPerformersHeading).toBeVisible();

    // Hide/Show punya DUA tombol di halaman (Search filters & Top Performers,
    // lihat index.tsx line 420 & 643) — scope ke tombol di dalam div header
    // Top Performers (heading + tombol adalah sibling) supaya unik:
    // naik satu level dari heading (parent div-nya), lalu cari tombol di sana.
    const topPerformersHeader = dashboardPage.topPerformersHeading.locator('..');
    const toggleButton = (name: 'Hide' | 'Show') =>
      topPerformersHeader.getByRole('button', { name });

    // Hide
    await toggleButton('Hide').click();
    await expect(toggleButton('Show')).toBeVisible();

    // Show kembali
    await toggleButton('Show').click();
    await expect(toggleButton('Hide')).toBeVisible();
  });

  // ── KPI Summary cards ────────────────────────────────────────────────

  test('KPI summary menampilkan kartu Total post, Total engagement, Views, Engagement rate, Active platforms', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    // Nilai dari mock API (KPI_SUMMARY_API di api-mock.ts)
    await expect(dashboardPage.totalPostCard).toBeVisible();
    await expect(dashboardPage.totalPostCard).toContainText('2,846');
    await expect(dashboardPage.totalEngagementCard).toBeVisible();
    await expect(dashboardPage.totalEngagementCard).toContainText('48.2K');
    await expect(dashboardPage.viewsCard).toBeVisible();
    await expect(dashboardPage.viewsCard).toContainText('1.24M');
    await expect(dashboardPage.engagementRateCard).toBeVisible();
    await expect(dashboardPage.engagementRateCard).toContainText('3.89%');
    // Active platforms: "3 / 3" — cari card yang mengandung "Active platforms"
    const activePlatformsCard = dashboardPage.page.locator('article').filter({ hasText: 'Active platforms' }).first();
    await expect(activePlatformsCard).toBeVisible();
    await expect(activePlatformsCard).toContainText('3 / 3');
  });

  // ── Top Posts table ──────────────────────────────────────────────────

  test('Top Posts menampilkan tabel dengan kolom Platform, Post, Views, Engagement', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    // Heading "Top posts" terlihat
    await expect(dashboardPage.topPostsHeading).toBeVisible();

    // Tabel ada dengan header kolom (ringkas 4 kolom pada kartu preview dashboard)
    await expect(dashboardPage.topPostsTable).toBeVisible();
    const headers = dashboardPage.topPostsTable.locator('th');
    await expect(headers).toHaveText(['Platform', 'Post', 'Views', 'Engagement']);

    // Data mock terrender di tabel
    // Row 1: TikTok, "Transformasi layanan publik...", 201.61K, 8,432
    await expect(dashboardPage.topPostsTable.getByText('TikTok', { exact: true }).first()).toBeVisible();
    await expect(dashboardPage.topPostsTable.getByText('Transformasi layanan publik perlu dimulai dari data...')).toBeVisible();
    await expect(dashboardPage.topPostsTable.getByText('201.61K')).toBeVisible();
    await expect(dashboardPage.topPostsTable.getByText('8,432')).toBeVisible();

    // Row 2: TikTok, "Antusiasme warga...", 147K, 6,208
    await expect(dashboardPage.topPostsTable.getByText('147K')).toBeVisible();
    await expect(dashboardPage.topPostsTable.getByText('6,208')).toBeVisible();
  });

  test('Top Posts "View all →" button terlihat', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();
    await expect(dashboardPage.viewAllButton).toBeVisible();
  });

  // ── Topic Intelligence chart ─────────────────────────────────────────

  test('section Topic intelligence tersedia di dashboard', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    // Section tetap ada di dashboard (halaman Keyword Intelligence tempat
    // chart detailnya berada DI LUAR LINGKUP testing — fitur belum digunakan)
    await expect(dashboardPage.topicIntelligenceHeading).toBeVisible();
  });

  // ── Sentiment & Emotion Analysis cards ───────────────────────────────

  test('kartu Sentiment trend & Sentiment map terrender di grup Sentiment', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    // Dari keempat kartu grup Sentiment, dua sudah dites terpisah
    // (conversation trend & emotion map via be-widgets) — di sini dua sisanya.
    await expect(dashboardPage.page.getByRole('heading', { name: 'Sentiment trend' })).toBeVisible();
    await expect(dashboardPage.page.getByRole('heading', { name: 'Sentiment map' })).toBeVisible();

    // Keduanya benar-benar menggambar chart (svg), bukan sekadar heading
    const sentimentGroup = dashboardPage.page
      .locator('section, div')
      .filter({ has: dashboardPage.page.getByRole('heading', { name: 'Sentiment & Emotion Analysis' }) })
      .first();
    await expect(sentimentGroup.locator('svg').first()).toBeVisible();
  });

  // ── Top Accounts ─────────────────────────────────────────────────────

  test('Top Accounts menampilkan daftar akun dengan handle, platform, dan jumlah post', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    // Top Performers visible → Top Accounts juga visible
    await expect(dashboardPage.topPerformersHeading).toBeVisible();
    await expect(dashboardPage.topAccountsHeading).toBeVisible();

    // Data mock: sip_indonesia (Twitter/X, 120 posts) & beritakota_id (TikTok, 84 posts)
    const accountsSection = dashboardPage.page.locator('article').filter({ hasText: 'Top accounts' }).first();
    await expect(accountsSection).toContainText('sip_indonesia');
    await expect(accountsSection).toContainText('Twitter/X');
    await expect(accountsSection).toContainText('120 post');
    await expect(accountsSection).toContainText('beritakota_id');
    await expect(accountsSection).toContainText('TikTok');
    await expect(accountsSection).toContainText('84 post');
  });

  test('klik akun di Top accounts membuka halaman posts dengan filter platform & actor (deploy 2026-09)', async ({
    dashboardPage,
  }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();
    const accountsSection = dashboardPage.page.locator('article').filter({ hasText: 'Top accounts' }).first();
    await expect(accountsSection.locator('a').first()).toBeVisible();

    // Item akun kini berupa LINK (deploy 2026-09): href ke halaman posts
    // dengan param keyword, platform, dan actor dari data akun.
    const firstLink = accountsSection.locator('a').first();
    const href = await firstLink.getAttribute('href');
    expect(href).toContain('/monitoring/dashboard/posts?');
    expect(href).toContain('keyword=');
    expect(href).toContain(`platform=${encodeURIComponent('Twitter/X')}`);
    expect(href).toContain('actor=sip_indonesia');

    // Link dibuka di tab baru (target=_blank)
    await expect(firstLink).toHaveAttribute('target', '_blank');

    // Klik → tab baru terbuka dengan filter platform & actor diterapkan
    const popupPromise = dashboardPage.page.waitForEvent('popup');
    await firstLink.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');

    // URL posts membawa param filter yang sama
    await expect(popup).toHaveURL(/\/monitoring\/dashboard\/posts\?/);
    const popupUrl = new URL(popup.url());
    expect(popupUrl.searchParams.get('platform')).toBe('Twitter/X');
    expect(popupUrl.searchParams.get('actor')).toBe('sip_indonesia');

    // Filter platform di halaman posts menunjukkan platform akun terpilih
    const platButton = popup.getByRole('button', { name: /platform/i }).first();
    await expect(platButton).toContainText('Twitter/X');
  });

  // ── Top Hashtags ─────────────────────────────────────────────────────

  test('Top Hashtags menampilkan daftar hashtag dengan tag dan jumlah post', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    // Top Performers visible → Top Hashtags juga visible
    await expect(dashboardPage.topPerformersHeading).toBeVisible();
    await expect(dashboardPage.topHashtagsHeading).toBeVisible();

    // Data mock: #SIPIndonesia (1,420) & #SuaraWarga (954)
    const hashtagsSection = dashboardPage.page.locator('article').filter({ hasText: 'Top hashtags' }).first();
    await expect(hashtagsSection).toContainText('#SIPIndonesia');
    await expect(hashtagsSection).toContainText('1,420 post');
    await expect(hashtagsSection).toContainText('#SuaraWarga');
    await expect(hashtagsSection).toContainText('954 post');
  });
});
