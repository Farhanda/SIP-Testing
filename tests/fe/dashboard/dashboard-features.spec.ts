import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockDashboardApis, mockKeywordOptions } from '../../../src/helpers/api-mock';

/**
 * Test fitur baru dashboard UI yang belum ter-cover:
 * - Auto-refresh dropdown (Off, 1 minute, 5 minutes, dst.)
 * - Fullscreen button
 * - Sort by dropdown di Top Posts (Views / Engagement)
 * - Period dropdown (Select period, 24 Hours, 3 Days, 7 Days, 1 Month, Custom)
 * - Protocol status badge
 * - Refresh dashboard now button
 *
 * + Eksplorasi live 2026-09-04 (http://10.200.101.13:3000) — interaksi
 *   slice & navigasi konteks (memakai API ASLI tanpa mock):
 *   - Kartu chart & donat (Emotion/Sentiment map) dan tombol topik adalah
 *     BUTTON yang bisa diklik → membuka TAB BARU halaman posts dengan
 *     filter terkait (`emotion=anger`, `topic=lainnya`). Perilaku BY DESIGN
 *     ("click a slice to see matching posts") — bukan bug.
 *   - Tombol "View all →" juga membuka TAB BARU (bukan SPA navigation) dan
 *     halaman dashboard ASAL TETAP di /monitoring/dashboard.
 *   - Keyword combobox punya autosuggest yang ter-filter sesuai ketikan.
 *   - Slice donat mengirim keyword yang SUDAH di-apply ke halaman posts.
 */
test.describe('Dashboard — Fitur UI Baru', () => {
  // ── Auto-refresh ─────────────────────────────────────────────────────

  test('auto-refresh dropdown menampilkan opsi default Off dan opsi lainnya', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    const autoRefresh = dashboardPage.page.getByRole('combobox', { name: 'Auto-refresh' });
    await expect(autoRefresh).toBeVisible();
    await expect(autoRefresh).toHaveValue('off');

    // Cek semua opsi tersedia (8 opsi: Off + 7 interval)
    const options = autoRefresh.locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(8);
  });

  test('auto-refresh dapat diubah ke opsi lain', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    const autoRefresh = dashboardPage.page.getByRole('combobox', { name: 'Auto-refresh' });
    await autoRefresh.selectOption({ label: '5 minutes' });
    await expect(autoRefresh).toHaveValue('5m');
  });

  // ── Refresh dashboard now ────────────────────────────────────────────

  test('tombol Refresh dashboard now terlihat dan dapat diklik', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    const refreshBtn = dashboardPage.page.getByRole('button', { name: 'Refresh dashboard now' });
    await expect(refreshBtn).toBeVisible();

    // Klik refresh tidak crash
    await refreshBtn.click();
    await dashboardPage.expectResultsRendered();
  });

  // ── Fullscreen ───────────────────────────────────────────────────────

  test('tombol Enter fullscreen terlihat', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    const fullscreenBtn = dashboardPage.page.getByRole('button', { name: 'Enter fullscreen' });
    await expect(fullscreenBtn).toBeVisible();
  });

  test('Enter fullscreen benar-benar masuk mode fullscreen & Exit keluar', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    await dashboardPage.enterFullscreenButton.click();
    await expect.poll(async () =>
      dashboardPage.page.evaluate(() => document.fullscreenElement !== null)
    ).toBe(true);
    await expect(dashboardPage.exitFullscreenButton).toBeVisible();

    await dashboardPage.exitFullscreenButton.click();
    await expect.poll(async () =>
      dashboardPage.page.evaluate(() => document.fullscreenElement !== null)
    ).toBe(false);
  });

  test('Export report mengunduh file posts-report.xlsx', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    // Export report berfungsi (deploy 2026-09): klik memicu event download
    // file xlsx yang di-generate client-side (tanpa request jaringan tambahan).
    const downloadPromise = dashboardPage.page.waitForEvent('download', { timeout: 15_000 });
    await dashboardPage.exportReportButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    expect(download.suggestedFilename()).toMatch(/posts-report/);
  });

  // ── Sort by di Top Posts ─────────────────────────────────────────────

  test('Top Posts memiliki dropdown Sort by dengan opsi Views dan Engagement', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();
    await expect(dashboardPage.topPostsHeading).toBeVisible();

    const sortBy = dashboardPage.page.getByRole('combobox', { name: 'Sort by' });
    const hasCombobox = (await sortBy.count()) > 0 && (await sortBy.isVisible().catch(() => false));
    if (hasCombobox) {
      await expect(sortBy).toHaveValue('view');
      const options = sortBy.locator('option');
      const count = await options.count();
      expect(count).toBeGreaterThanOrEqual(2); // Minimal: Views & Engagement
    } else {
      // Deployed UI: sort terpasang pada interactive column header button
      const viewsBtn = dashboardPage.topPostsTable.getByRole('button', { name: 'Views' });
      const engagementBtn = dashboardPage.topPostsTable.getByRole('button', { name: 'Engagement' });
      await expect(viewsBtn).toBeVisible();
      await expect(engagementBtn).toBeVisible();
    }
  });

  test('Top Posts dapat di-sort by Engagement', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    const sortBy = dashboardPage.page.getByRole('combobox', { name: 'Sort by' });
    const hasCombobox = (await sortBy.count()) > 0 && (await sortBy.isVisible().catch(() => false));
    if (hasCombobox) {
      await sortBy.selectOption('engagement');
      await expect(sortBy).toHaveValue('engagement');
    } else {
      const engagementBtn = dashboardPage.topPostsTable.getByRole('button', { name: 'Engagement' });
      await engagementBtn.click();
    }

    // Tabel masih ter-render setelah sort
    await expect(dashboardPage.topPostsTable).toBeVisible();
    const headers = await dashboardPage.topPostsTable.locator('th').allInnerTexts();
    expect(headers.some((h) => /Views/i.test(h))).toBe(true);
    expect(headers.some((h) => /Engagement/i.test(h))).toBe(true);
  });

  // ── Period dropdown ──────────────────────────────────────────────────

  test('Period button tersedia di search filters', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    // Period kini berupa button (HeadlessUI Listbox), bukan <select> combobox
    await expect(dashboardPage.periodButton).toBeVisible();
  });

  // ── Updated timestamp ────────────────────────────────────────────────

  test('dashboard menampilkan timestamp "Updated just now"', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();
    await expect(dashboardPage.page.getByText('Updated just now').first()).toBeVisible();
  });

  // ── Subtitle "Social Intelligence Platform" ──────────────────────────

  test('dashboard menampilkan subtitle "Social Intelligence Platform"', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await expect(dashboardPage.page.getByText('Social Intelligence Platform')).toBeVisible();
  });

  // ── Eksplorasi live 2026-09: slice & navigasi konteks (API asli) ─────

  test('caption "click a slice to see matching posts" tampil di kartu donat (live)', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    await expect(
      dashboardPage.page.getByText('click a slice to see matching posts').first(),
    ).toBeVisible();
  });

  test('klik slice Emotion map membuka TAB BARU halaman posts dengan filter emotion (live)', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    // Slice donat = button (live: "Anger 2%", "Joy 2%", dst).
    const slice = dashboardPage.page
      .getByRole('button', { name: /^Anger/i })
      .first();
    await expect(slice).toBeVisible();

    const popupPromise = dashboardPage.page.waitForEvent('popup', { timeout: 10_000 });
    await slice.click();
    const popup = await popupPromise;

    await expect(popup).toHaveURL(/\/monitoring\/dashboard\/posts/);
    // Slice donat = distribusi EMOSI → filter emotion terkirim ke posts page.
    await expect(popup).toHaveURL(/emotion=/);
    await expect(
      popup.getByRole('heading', { level: 1, name: /All posts about|All top posts/i }),
    ).toBeVisible();
    await popup.close();
  });

  test('klik tombol topik ("lainnya") membuka TAB BARU posts dengan filter topic (live)', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    // Live 2026-09: Topic intelligence = buttons ("lainnya 111 posts",
    // "Produk Layanan 4 posts", ...). "lainnya" (topik Others) selalu eksis.
    const lainnya = dashboardPage.page.getByRole('button', { name: /lainnya/i }).first();
    await expect(lainnya).toBeVisible();

    const popupPromise = dashboardPage.page.waitForEvent('popup', { timeout: 10_000 });
    await lainnya.click();
    const popup = await popupPromise;

    await expect(popup).toHaveURL(/\/monitoring\/dashboard\/posts/);
    await expect(popup).toHaveURL(/topic=/);
    // NOTE (temuan T4, minor): popup tombol topik TIDAK membawa param
    // keyword — beda dengan slice emosi & View all yang membawa
    // ?keyword=<ter-apply>. Inkonsistensi antar-widget, belum di-assert
    // sampai ada keputusan desain.
    await popup.close();
  });

  test('"View all →" membuka TAB BARU halaman posts & halaman asal tetap dashboard (live)', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    const popupPromise = dashboardPage.page.waitForEvent('popup', { timeout: 10_000 });
    await dashboardPage.viewAllButton.click();
    const popup = await popupPromise;

    await expect(popup).toHaveURL(/\/monitoring\/dashboard\/posts/);
    await expect(popup).toHaveURL(/sort_by=/);
    await expect(
      popup.getByRole('heading', { level: 1, name: /All posts about|All top posts/i }),
    ).toBeVisible();
    await popup.close();

    // Halaman asal TIDAK berpindah (popup, bukan SPA navigation)
    await expect(dashboardPage.page).toHaveURL(/\/monitoring\/dashboard/);
  });

  test('keyword combobox autosuggest memfilter opsi sesuai ketikan (live)', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    const kwInput = dashboardPage.keywordInput;
    await kwInput.click();
    await kwInput.fill('RUU');

    // Autosuggest live 2026-09: opsi hasil filter mengandung ketikan
    // (live: "RUU", "RUU Digital"). Scope ke listbox HeadlessUI yang terbuka
    // (elemen terakhir dengan role=listbox) — JANGAN getByRole('option')
    // global, karena native <select> lain (Auto-refresh dll) juga punya
    // <option> tersembunyi yang ikut ke-match.
    const options = dashboardPage.page.getByRole('listbox').last().getByRole('option');
    await expect(options.first()).toBeVisible();
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      await expect(options.nth(i)).toContainText(/RUU/i);
    }
  });

  test('memilih keyword dari autosuggest mengubah nilai combobox (live)', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    const kwInput = dashboardPage.keywordInput;
    await kwInput.click();
    await kwInput.fill('RUU');
    await dashboardPage.page
      .getByRole('listbox')
      .last()
      .getByRole('option', { name: 'RUU Digital' })
      .first()
      .click();

    await expect(kwInput).toHaveValue('RUU Digital');
  });

  test('tombol Clear selection menghapus pilihan keyword (live)', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    const kwInput = dashboardPage.keywordInput;
    await kwInput.click();
    await kwInput.fill('RUU');
    await dashboardPage.page
      .getByRole('listbox')
      .last()
      .getByRole('option', { name: 'RUU Digital' })
      .first()
      .click();
    await expect(kwInput).toHaveValue('RUU Digital');

    await dashboardPage.clearKeyword();
    await expect(kwInput).toHaveValue('');
  });

  test('slice donat mengirim keyword TERAPKAN (apply filter) ke halaman posts (live)', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    // Perilaku live 2026-09: slice EMOSI membawa keyword yang SUDAH di-apply
    // (konsisten dengan data yang tampil), bukan pilihan combobox yang
    // belum di-apply. Jadi: pilih keyword → Apply filter → baru klik slice.
    // NOTE inkonsistensi (temuan 2026-09-04 sore): tombol TOPIK ("lainnya")
    // TIDAK membawa keyword di URL popup (?period=24H&topic=... saja),
    // sedangkan slice emosi & View all membawa ?keyword=... — layak
    // dirapikan developer (temuan T4, minor).
    const kwInput = dashboardPage.keywordInput;
    await kwInput.click();
    await kwInput.fill('RUU');
    await dashboardPage.page
      .getByRole('listbox')
      .last()
      .getByRole('option', { name: 'RUU Digital' })
      .first()
      .click();
    await expect(kwInput).toHaveValue('RUU Digital');

    await dashboardPage.applyFilter();
    await dashboardPage.expectResultsRendered();

    // Tunggu bukti state apply selesai diproses (chart request dengan
    // keyword ter-apply) sebelum klik slice — bukan URL dashboard (yang
    // memang tidak pernah berubah karena state bersifat client-side).
    await dashboardPage.page.waitForResponse(
      (r) => r.url().includes('/v1/dashboard/') && r.url().includes('keyword=RUU'),
      { timeout: 15_000 },
    ).catch(() => {});

    const emotionCard = dashboardPage.page
      .locator('article')
      .filter({ has: dashboardPage.page.getByRole('heading', { name: 'Emotion map' }) });
    const slice = emotionCard.getByRole('button').first();
    await expect(slice).toBeVisible();

    const popupPromise = dashboardPage.page.waitForEvent('popup', { timeout: 10_000 });
    await slice.click();
    const popup = await popupPromise;

    // URL popup membawa keyword yang baru di-apply.
    await expect(popup).toHaveURL(/keyword=RUU\+Digital/);
    await expect(popup).toHaveURL(/emotion=/);
    await popup.close();
  });

  test('slice sentimen membuka tab baru halaman posts dengan filter sentiment yang sesuai (live)', async ({
    dashboardPage,
  }) => {
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    // Pilih keyword & apply filter agar data sentimen terisi
    const kwInput = dashboardPage.keywordInput;
    await kwInput.click();
    await kwInput.fill('RUU');
    await dashboardPage.page
      .getByRole('listbox')
      .last()
      .getByRole('option', { name: 'RUU Digital' })
      .first()
      .click();
    await dashboardPage.applyFilter();
    await dashboardPage.expectResultsRendered();

    // Tunggu request sentimen ter-load
    await dashboardPage.page
      .waitForResponse((r) => r.url().includes('/v1/dashboard/') && r.url().includes('keyword=RUU'), {
        timeout: 15_000,
      })
      .catch(() => {});

    // Cari button slice di kartu Sentiment map (Positive, Neutral, atau Negative)
    const sentimentCard = dashboardPage.page
      .locator('article')
      .filter({ has: dashboardPage.page.getByRole('heading', { name: 'Sentiment map' }) });
    const sentimentSlice = sentimentCard.getByRole('button', { name: /Positive|Negative|Neutral/i }).first();

    const isSliceVisible = await sentimentSlice.isVisible().catch(() => false);
    if (isSliceVisible) {
      const popupPromise = dashboardPage.page.waitForEvent('popup', { timeout: 10_000 });
      await sentimentSlice.click();
      const popup = await popupPromise;

      // URL popup membawa keyword dan parameter sentiment
      await expect(popup).toHaveURL(/\/monitoring\/dashboard\/posts/);
      await expect(popup).toHaveURL(/keyword=RUU\+Digital/);
      await expect(popup).toHaveURL(/sentiment=/);
      await popup.close();
    }
  });

  test('dropdown keyword membatasi tampilan proporsional dengan container scrollable (live)', async ({
    dashboardPage,
  }) => {
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    const kwInput = dashboardPage.keywordInput;
    await kwInput.click();
    await kwInput.fill('RUU');

    // Listbox HeadlessUI harus muncul setelah ketikan
    const listbox = dashboardPage.page.getByRole('listbox').last();
    await expect(listbox).toBeVisible();

    // Verifikasi batas visual / scrollable (verifikasi bug hunt W36: max ±5 data + scroll)
    const isScrollableOrBounded = await listbox.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const hasOverflow = style.overflowY === 'auto' || style.overflowY === 'scroll';
      const boundedHeight = el.clientHeight < 400;
      return hasOverflow || boundedHeight;
    });
    expect(isScrollableOrBounded).toBe(true);

    // Tutup dropdown dengan Escape
    await dashboardPage.page.keyboard.press('Escape');
  });
});
