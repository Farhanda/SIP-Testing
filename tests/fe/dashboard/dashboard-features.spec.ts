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

  test('Export report mengunduh file xlsx & menampilkan toast sukses', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();
    await dashboardPage.expectResultsRendered();

    const downloadPromise = dashboardPage.page.waitForEvent('download', { timeout: 15_000 });
    await dashboardPage.exportReportButton.click();
    const download = await downloadPromise;

    // File hasil ekspor ber-ekstensi xlsx
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    await expect(
      dashboardPage.page.getByText('Report exported successfully.')
    ).toBeVisible();
  });

  // ── Sort by di Top Posts ─────────────────────────────────────────────

  test('Top Posts memiliki dropdown Sort by dengan opsi Views dan Engagement', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();
    await expect(dashboardPage.topPostsHeading).toBeVisible();

    const sortBy = dashboardPage.page.getByRole('combobox', { name: 'Sort by' });
    await expect(sortBy).toBeVisible();
    await expect(sortBy).toHaveValue('view');

    const options = sortBy.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2); // Minimal: Views & Engagement
  });

  test('Top Posts dapat di-sort by Engagement', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    const sortBy = dashboardPage.page.getByRole('combobox', { name: 'Sort by' });
    await sortBy.selectOption('engagement');
    await expect(sortBy).toHaveValue('engagement');

    // Tabel masih ter-render setelah sort
    await expect(dashboardPage.topPostsTable).toBeVisible();
    await expect(dashboardPage.topPostsTable.locator('th')).toHaveText(['Platform', 'Post', 'Emotion', 'Topic', 'Views', 'Engagement']);
  });

  // ── Period dropdown ──────────────────────────────────────────────────

  test('Period dropdown tersedia di search filters', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    await dashboardPage.expectResultsRendered();

    const period = dashboardPage.page.getByRole('combobox', { name: 'Period' });
    await expect(period).toBeVisible();

    // Opsi default: Select period (disabled)
    const options = period.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(5); // Select period, 24 Hours, 3 Days, 7 Days, 1 Month, (Custom)
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
});
