import { expect } from '../fixtures';
import { test } from '../fixtures';
import { loadJsonData } from '../../../src/helpers/data';
import {
  mockKeywordOptions,
  mockSchedulerList,
  mockUnscheduledList,
} from '../../../src/helpers/api-mock';

/**
 * Test Monitoring Keyword (FR-12, FR-13, FR-20):
 * daftar scheduler & unscheduled di-mock (deterministik) dengan bentuk
 * respons yang sama dengan API asli; filter diuji end-to-end UI → API.
 */
test.describe('Monitoring Keyword', () => {
  test('daftar scheduled keyword tampil lengkap dengan tabel & filter', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.goto();

    // Deployed app: 'Keyword Management' (bukan 'Monitoring Keyword')
    const heading = keywordPage.page.getByRole('heading', { name: /Keyword (Management|Monitoring)/ });
    await heading.first().waitFor({ state: 'visible' });
    await keywordPage.expectTabSelected('Scheduled');
    await expect(keywordPage.searchInput).toBeVisible();

    // Kolom tabel
    for (const header of ['Keyword', 'Platform', 'Schedule', 'Frequency', 'Status']) {
      await keywordPage.expectColumnHeader(header);
    }

    // Data mock ter-render
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await expect(keywordPage.paginationText).toBeVisible();
  });

  // Data-driven (FR-20): filter status diuji per data test-data/keyword-filters.json
  const statusFilters = loadJsonData<
    { status: string; visibleKeyword: string; hiddenKeyword: string }[]
  >('keyword-filters.json');
  for (const data of statusFilters) {
    test(`filter status "${data.status}" menampilkan keyword sesuai status`, async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockSchedulerList(keywordPage.page);
      await keywordPage.goto();

      await keywordPage.selectStatus(data.status);
      await keywordPage.applyFilters();

      await keywordPage.expectKeywordVisible(data.visibleKeyword, true);
      await keywordPage.expectKeywordVisible(data.hiddenKeyword, false);
    });
  }

  test('filter platform bekerja mempersempit daftar', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.goto();

    // Platform TikTok: keyword yang tidak ada di TikTok tidak tampil
    await keywordPage.selectPlatform('TikTok');
    await keywordPage.applyFilters();

    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await keywordPage.expectKeywordVisible('Isu Pendidikan', false);
  });

  test('pencarian keyword memfilter daftar', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.goto();

    await keywordPage.searchKeyword('layanan');

    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await keywordPage.expectKeywordVisible('RUU Digital', false);
  });

  test('tab On Demand menampilkan daftar & filter status', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    await keywordPage.expectTabSelected('On Demand');
    await keywordPage.expectColumnHeader('Keyword');
    await keywordPage.expectColumnHeader('Status');

    // Data mock ter-render
    await keywordPage.expectKeywordVisible('RUU Digital', true);

    // Filter status "Completed"
    await keywordPage.selectStatus('completed');
    await keywordPage.applyFilters();
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await keywordPage.expectKeywordVisible('Ketenagakerjaan', false);
  });
});
