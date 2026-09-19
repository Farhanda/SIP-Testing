import { test, expect } from '../fixtures';
import { Env } from '../../../src/config/env';
import { isDbConfigured, query } from '../../../src/helpers/db';

const GATEWAY_URL = Env.scrapeBaseUrl; // http://10.200.101.13:8080

test.describe('Keyword Monitoring — Frontend v2 & Multi-Layer Alignment', () => {
  test.beforeEach(async ({ keywordPage }) => {
    await keywordPage.goto();
  });

  test('TC-FE-KM01: Header, Subtitle, dan Tabs On Demand & Scheduled ter-render dengan benar', async ({
    keywordPage,
    page,
  }) => {
    // 1. Validasi URL halaman
    await expect(page).toHaveURL(/.*\/monitoring\/keyword/);

    // 2. Validasi Heading & Subtitle
    await expect(keywordPage.heading).toBeVisible();
    await expect(keywordPage.subtitle).toBeVisible();

    // 3. Validasi Tab On Demand (default terpilih) & Tab Scheduled
    await expect(keywordPage.tabOnDemand).toBeVisible();
    await expect(keywordPage.tabOnDemand).toHaveAttribute('aria-selected', 'true');

    await expect(keywordPage.tabScheduled).toBeVisible();
    await expect(keywordPage.tabScheduled).toHaveAttribute('aria-selected', 'false');

    // 4. Validasi tombol "+ Add keyword"
    await expect(keywordPage.addKeywordButton).toBeVisible();
  });

  test('TC-FE-KM02: Kartu Ringkasan On Demand selaras antarlayer (FE ↔ API ↔ DB)', async ({
    keywordPage,
    page,
  }) => {
    // 1. Ambil data ringkasan langsung dari API Backend Gateway
    const apiRes = await page.request.get(
      `${GATEWAY_URL}/v1/scrape/keyword-management/summary?schedule_enabled=false`,
    );
    expect(apiRes.status()).toBe(200);
    const apiJson = await apiRes.json();
    const summaryData = apiJson.data || {};

    // 2. Verifikasi kartu ringkasan di UI visible
    await expect(keywordPage.cardTotalKeywords).toBeVisible();
    await expect(keywordPage.cardCurrentlyProcessing).toBeVisible();
    await expect(keywordPage.cardCompleted).toBeVisible();
    await expect(keywordPage.cardFailedCancelled).toBeVisible();

    // 3. Bandingkan angka di UI dengan respons API
    const uiTotal = await keywordPage.getCardNumber(keywordPage.cardTotalKeywords);
    const uiProcessing = await keywordPage.getCardNumber(keywordPage.cardCurrentlyProcessing);
    const uiCompleted = await keywordPage.getCardNumber(keywordPage.cardCompleted);
    const uiFailed = await keywordPage.getCardNumber(keywordPage.cardFailedCancelled);

    expect(uiTotal).toBe(summaryData.total_keywords);
    expect(uiProcessing).toBe(summaryData.currently_processing);
    expect(uiCompleted).toBe(summaryData.completed);
    expect(uiFailed).toBe(summaryData.failed_cancelled);

    // 4. Validasi silang ke Database PostgreSQL (scrape_keywords) jika kredensial aktif
    if (isDbConfigured()) {
      const dbTotal = await query<{ total: string }>(`SELECT count(*) as total FROM scrape_keywords`);
      expect(uiTotal).toBe(parseInt(dbTotal[0].total, 10));
    }
  });

  test('TC-FE-KM03: Tabel On Demand menampilkan kolom lengkap dan data baris pertama selaras dengan API & DB', async ({
    keywordPage,
    page,
  }) => {
    // 1. Ambil daftar keyword On Demand dari API Backend
    const apiRes = await page.request.get(
      `${GATEWAY_URL}/v1/scrape/keyword-management?page=1&size=5&schedule_enabled=false`,
    );
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const apiKeywords = apiBody.data || [];

    // 2. Verifikasi tabel dan headers
    await expect(keywordPage.table).toBeVisible();
    const headerTexts = await keywordPage.tableHeaders.allInnerTexts();
    const cleanHeaders = headerTexts.map((h) => h.trim().toUpperCase());
    expect(cleanHeaders).toContain('KEYWORD');
    expect(cleanHeaders).toContain('PLATFORM');
    expect(cleanHeaders).toContain('CREATED');
    expect(cleanHeaders).toContain('LAST RUN');
    expect(cleanHeaders).toContain('ACTIONS');

    // 3. Verifikasi jumlah baris sesuai size (atau jumlah item yang ada)
    const rowCount = await keywordPage.tableRows.count();
    expect(rowCount).toBe(apiKeywords.length);

    // 4. Verifikasi baris pertama di UI memuat keyword pertama dari API
    if (apiKeywords.length > 0) {
      const firstRow = keywordPage.tableRows.first();
      await expect(firstRow).toContainText(apiKeywords[0].keyword);

      // Verifikasi platform tags pada baris pertama
      for (const p of apiKeywords[0].platforms) {
        if (p === 'instagram') await expect(firstRow).toContainText(/Instagram/i);
        if (p === 'tiktok') await expect(firstRow).toContainText(/TikTok/i);
        if (p === 'twitter_x') await expect(firstRow).toContainText(/Twitter/i);
      }
    }

    // 5. Validasi silang ke PostgreSQL
    if (isDbConfigured() && apiKeywords.length > 0) {
      const dbMatch = await query<{ keyword: string }>(
        `SELECT keyword FROM scrape_keywords WHERE keyword = $1`,
        [apiKeywords[0].keyword],
      );
      expect(dbMatch.length).toBeGreaterThan(0);
      expect(dbMatch[0].keyword).toBe(apiKeywords[0].keyword);
    }
  });

  test('TC-FE-KM04: Filter Status, Platform, dan Tombol Reset Filter pada Tab On Demand', async ({
    keywordPage,
    page,
  }) => {
    // 1. Verifikasi filter dropdown status dan platform visible
    await expect(keywordPage.statusSelect).toBeVisible();
    await expect(keywordPage.platformSelect).toBeVisible();
    await expect(keywordPage.applyFilterButton).toBeVisible();
    await expect(keywordPage.resetFilterButton).toBeVisible();

    // 2. Filter berdasarkan platform TikTok
    await keywordPage.platformSelect.selectOption({ label: 'TikTok' });
    await keywordPage.applyFilterButton.click();
    await page.waitForTimeout(1000);

    // Verifikasi semua baris yang tampil memiliki platform TikTok
    const rowCount = await keywordPage.tableRows.count();
    for (let i = 0; i < rowCount; i++) {
      const row = keywordPage.tableRows.nth(i);
      await expect(row).toContainText(/TikTok/i);
    }

    // 3. Klik tombol Reset filter
    await keywordPage.resetFilterButton.click();
    await page.waitForTimeout(1000);

    // Verifikasi select kembali ke default
    await expect(keywordPage.platformSelect).toHaveValue('all');
    await expect(keywordPage.statusSelect).toHaveValue('all');
  });

  test('TC-FE-KM05: Pencarian Keyword (Search Bar) memfilter hasil tabel secara akurat', async ({
    keywordPage,
    page,
  }) => {
    // 1. Verifikasi search input visible
    await expect(keywordPage.searchInput).toBeVisible();

    // 2. Isi kata kunci pencarian yang valid (MBG)
    await keywordPage.searchInput.fill('MBG');
    await keywordPage.applyFilterButton.click();
    await page.waitForTimeout(1000);

    // 3. Verifikasi hasil pencarian memuat MBG di setiap baris
    const rowCount = await keywordPage.tableRows.count();
    expect(rowCount).toBeGreaterThan(0);
    for (let i = 0; i < rowCount; i++) {
      const row = keywordPage.tableRows.nth(i);
      await expect(row).toContainText('MBG');
    }

    // 4. Reset filter untuk mengembalikan daftar
    await keywordPage.resetFilterButton.click();
    await page.waitForTimeout(1000);
    await expect(keywordPage.searchInput).toHaveValue('');
  });

  test('TC-FE-KM06: Modal "+ Add keyword" menampilkan input keyword dan checkbox platform tercentang default', async ({
    keywordPage,
  }) => {
    // 1. Buka modal Add keyword
    await keywordPage.openCreateModal();
    await expect(keywordPage.createModal).toBeVisible();

    // 2. Verifikasi input keyword combobox
    await expect(keywordPage.unscKeywordInput).toBeVisible();

    // 3. Verifikasi SEMUA checkbox platform (Instagram, TikTok, Twitter/X) tercentang secara default
    await keywordPage.expectUnscPlatformsAllSelected();

    // 4. Verifikasi tombol Start process
    await expect(keywordPage.startProcessButton).toBeVisible();

    // 5. Tutup modal Add keyword via tombol Cancel
    const cancelBtn = keywordPage.createModal.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();
    await keywordPage.expectCreateModalOpen(false);
  });

  test('TC-FE-KM07: Tab "Scheduled" aktif, menampilkan metrik jadwal dan Post Pipeline Trend', async ({
    keywordPage,
    page,
  }) => {
    // 1. Ambil data ringkasan Scheduled dari API Backend
    const apiRes = await page.request.get(
      `${GATEWAY_URL}/v1/scrape/keyword-management/summary?schedule_enabled=true`,
    );
    expect(apiRes.status()).toBe(200);
    const apiJson = await apiRes.json();
    const scheduledMeta = apiJson.data?.scheduled || {};

    // 2. Klik tab Scheduled
    await keywordPage.tabScheduled.click();
    await expect(keywordPage.tabScheduled).toHaveAttribute('aria-selected', 'true');
    await expect(keywordPage.tabOnDemand).toHaveAttribute('aria-selected', 'false');

    // 3. Verifikasi kartu ringkasan Scheduled visible
    await expect(keywordPage.cardActiveKeywords).toBeVisible();
    await expect(keywordPage.cardJobsToday).toBeVisible();
    await expect(keywordPage.cardPostsProcessed).toBeVisible();
    await expect(keywordPage.cardJobsOnHold).toBeVisible();

    // 4. Bandingkan angka Posts processed dengan API
    const uiPostsProcessed = await keywordPage.getCardNumber(keywordPage.cardPostsProcessed);
    expect(uiPostsProcessed).toBe(scheduledMeta.posts_processed?.total ?? 0);

    // 5. Verifikasi komponen trend chart / container visible
    await expect(page.getByText('Post pipeline trend')).toBeVisible();
  });

  test('TC-FE-KM08: Tabel Scheduled menampilkan kolom jadwal lengkap dan selaras dengan PostgreSQL', async ({
    keywordPage,
  }) => {
    // 1. Pindah ke tab Scheduled
    await keywordPage.tabScheduled.click();
    await expect(keywordPage.tabScheduled).toHaveAttribute('aria-selected', 'true');

    // 2. Verifikasi header tabel scheduled
    await expect(keywordPage.table).toBeVisible();
    const headerTexts = await keywordPage.tableHeaders.allInnerTexts();
    const cleanHeaders = headerTexts.map((h) => h.trim().toUpperCase());
    expect(cleanHeaders).toContain('KEYWORD');
    expect(cleanHeaders).toContain('PLATFORM');
    expect(cleanHeaders).toContain('CREATED');
    expect(cleanHeaders).toContain('FREQUENCY');
    expect(cleanHeaders).toContain('LAST RUN');
    expect(cleanHeaders).toContain('STATUS');
    expect(cleanHeaders).toContain('ACTIONS');

    // 3. Verifikasi jumlah baris scheduled di DB vs UI
    if (isDbConfigured()) {
      const dbSched = await query<{ count: string }>(
        `SELECT count(*) as count FROM scrape_keywords WHERE schedule_enabled = true`,
      );
      const totalSched = parseInt(dbSched[0].count, 10);
      const rowsCount = await keywordPage.tableRows.count();
      // Jumlah baris di UI adalah min(rowsCount, 5) karena page size default 5
      expect(rowsCount).toBe(Math.min(5, totalSched));

      // Verifikasi keyword pertama di tabel terdaftar sebagai scheduled di PostgreSQL
      const firstRowText = await keywordPage.tableRows.first().innerText();
      const firstKeywordName = firstRowText.split('\t')[0].split('\n')[0].trim();
      const dbMatch = await query<{ keyword: string; schedule_enabled: boolean }>(
        `SELECT keyword, schedule_enabled FROM scrape_keywords WHERE keyword = $1`,
        [firstKeywordName],
      );
      expect(dbMatch.length).toBeGreaterThan(0);
      expect(dbMatch[0].schedule_enabled).toBe(true);
    }
  });
});
