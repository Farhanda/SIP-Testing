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

    await dashboardPage.expectHeading('Dashboard Overview');
    await expect(dashboardPage.exportReportButton).toBeVisible();
    await expect(dashboardPage.trendingHeading).toBeVisible();
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
    await mockKeywordOptions(dashboardPage.page, ['Layanan Publik']);
    await dashboardPage.goto();

    // Auto-select memilih keyword pertama → tombol clear muncul
    await dashboardPage.clearKeyword();
    await dashboardPage.applyFilter();

    await dashboardPage.expectKeywordRequiredError();
  });

  test('validasi platform kosong menampilkan pesan "Select at least one platform."', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['Layanan Publik']);
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
    test(`cari keyword "${data.keyword}" → hasil dashboard tampil & data render (mock API)`, async ({ dashboardPage }) => {
      await mockDashboardApis(dashboardPage.page);
      await mockKeywordOptions(dashboardPage.page, ['Layanan Publik', 'Edukasi Digital']);
      await dashboardPage.goto();

      // Auto-select memilih keyword pertama saat load. Kosongkan pilihan
      // (tombol Clear selection), lalu pilih keyword eksplisit → Apply.
      // Catatan: menghapus keyword TIDAK menghapus hasil yang sudah render
      // (hasil hanya berubah setelah Apply) — jadi tidak assert empty state
      // di tengah; bukti filter terkirim = collectionId hasil apply.
      await dashboardPage.clearKeyword();
      await dashboardPage.selectKeyword(data.keyword);
      await dashboardPage.applyFilter();

      // Hasil tampil: heading kartu + data dari mock benar-benar ter-render
      await dashboardPage.expectResultsRendered();
      // collectionId di mock "menggema" keyword dari query param → bukti filter
      // terkirim & respons ter-render. UI mengirim SLUG (code) sebagai keyword,
      // jadi CollectionSummaryCard merender "Collection #SIP-<code>"
      // (mis. "Collection #SIP-layanan-publik").
      await dashboardPage.expectTextVisible(`Collection #SIP-${data.code}`);
    });
  }

  test('trending topic dapat berpindah periode 24 Hours → 7 Days', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['Layanan Publik']);
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
    await mockKeywordOptions(dashboardPage.page, ['Layanan Publik']);
    await dashboardPage.goto();

    // Auto-search menampilkan hasil → Top Performers tampil
    await dashboardPage.expectResultsRendered();
    await expect(dashboardPage.topPerformersHeading).toBeVisible();

    // Hide
    await dashboardPage.page.getByRole('button', { name: 'Hide' }).click();
    await expect(dashboardPage.page.getByRole('button', { name: 'Show' })).toBeVisible();

    // Show kembali
    await dashboardPage.page.getByRole('button', { name: 'Show' }).click();
    await expect(dashboardPage.page.getByRole('button', { name: 'Hide' })).toBeVisible();
  });
});
