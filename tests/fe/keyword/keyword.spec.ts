import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockKeywordOptions,
  mockUnscheduledList,
} from '../../../src/helpers/api-mock';

/**
 * Test Monitoring Keyword (/monitoring/keyword) — UI saat ini (2026-08)
 * hanya punya SATU tab "On Demand" yang memanggil BE langsung
 * GET /v1/scrape/keyword-management?schedule_enabled=false.
 * Tab Scheduled, Move-to-scheduled, dan Edit-scheduled sudah dihapus dari
 * aplikasi → seluruh coverage diarahkan ke On Demand.
 * Daftar di-mock (deterministik); filter diuji end-to-end UI → API.
 */
test.describe('Monitoring Keyword', () => {
  test('daftar On Demand tampil lengkap dengan tabel & filter', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    // Deployed app: 'Keyword Management' (atau 'Monitoring Keyword')
    const heading = keywordPage.page.getByRole('heading', { name: /Keyword (Management|Monitoring)/ });
    await heading.first().waitFor({ state: 'visible' });
    await keywordPage.expectOnDemandTabSelected();
    await expect(keywordPage.searchInput).toBeVisible();

    // Kolom tabel On Demand
    for (const header of ['Keyword', 'Platform', 'Created', 'Last Run', 'Status']) {
      await keywordPage.expectColumnHeader(header);
    }

    // Data mock ter-render
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await expect(keywordPage.paginationText).toBeVisible();
  });

  test('pencarian keyword memfilter daftar On Demand', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    await keywordPage.searchKeyword('RUU');

    // Pencarian 'RUU' hanya menampilkan keyword yang mengandung 'RUU'
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await keywordPage.expectKeywordVisible('BPJS Kesehatan', false);
  });

  test('aksi baris On Demand tersedia (Toggle status, View detail, Reprocess)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    // Data mock ter-render
    await keywordPage.expectKeywordVisible('RUU Digital', true);

    // Aksi baris On Demand yang tersedia di UI saat ini
    await expect(keywordPage.toggleStatus('RUU Digital')).toBeVisible();
    await expect(keywordPage.viewDetailLink('RUU Digital')).toBeVisible();
    await expect(keywordPage.reprocessButton('RUU Digital')).toBeVisible();
  });

  test('tombol Reset filter mengosongkan pencarian & mengembalikan daftar lengkap', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    // Filter dulu: pencarian 'RUU' menyembunyikan keyword lain
    await keywordPage.searchKeyword('RUU');
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await keywordPage.expectKeywordVisible('Ketenagakerjaan', false);

    // Reset filter: input kosong & daftar penuh dimuat ulang
    await keywordPage.resetFilterButton.click();
    await expect(keywordPage.searchInput).toHaveValue('');
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await keywordPage.expectKeywordVisible('Ketenagakerjaan', true);
  });
});

