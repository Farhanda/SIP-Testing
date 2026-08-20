import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockCancelUnscheduled,
  mockDashboardApis,
  mockKeywordOptions,
  mockRetryUnscheduled,
  mockUnscheduledDetail,
  mockUnscheduledHistory,
  mockUnscheduledList,
} from '../../../src/helpers/api-mock';

/**
 * Test aksi baris & halaman detail pada tab On Demand (FR-13, G2):
 *  - Aksi per baris: Retry (status failed), Cancel (queued/processing),
 *    Move to scheduled (completed), Run History, dan link View detail.
 *  - Halaman detail /monitoring/keyword/unscheduled/[id] — status completed
 *    (kartu analisis dashboard), belum completed (pesan placeholder),
 *    dan error state + tombol Retry.
 *
 * Semua endpoint di-mock agar deterministik. Request yang dikirim aksi
 * (POST /unscheduled/:id/cancel & /retry) ditangkap untuk membuktikan
 * parameter & method terkirim benar (FR-13).
 */
test.describe('Monitoring Keyword — Aksi On Demand', () => {
  test.describe('Aksi baris', () => {
    test('kartu ringkasan statistik on demand menampilkan total, processing, completed, dan failed/cancelled', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await keywordPage.gotoOnDemandTab();

      // Nilai dihitung dari data mock (3 item: completed, queued, failed)
      await keywordPage.expectStatValue('Total keywords', '3');
      await keywordPage.expectStatValue('Currently processing', '1');
      await keywordPage.expectStatValue('Completed', '1');
      await keywordPage.expectStatValue('Failed / Cancelled', '1');
    });

    test('aksi retry pada keyword failed mengirim POST /retry & menampilkan toast sukses', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await mockRetryUnscheduled(keywordPage.page, { succeed: true });
      await keywordPage.gotoOnDemandTab();

      const retryRequests: string[] = [];
      keywordPage.page.on('request', (req) => {
        if (req.method() === 'POST' && req.url().includes('/retry')) {
          retryRequests.push(req.url());
        }
      });

      await keywordPage.retryButton('BPJS Kesehatan').click();

      await keywordPage.expectToast('Keyword "BPJS Kesehatan" reprocessed.', true);
      expect(retryRequests).toHaveLength(1);
      expect(retryRequests[0]).toContain('/api/admin/keyword/unscheduled/un-3/retry');
    });

    test('aksi cancel pada keyword queued mengirim POST /cancel & menampilkan toast sukses', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await mockCancelUnscheduled(keywordPage.page, { succeed: true });
      await keywordPage.gotoOnDemandTab();

      const cancelRequests: string[] = [];
      keywordPage.page.on('request', (req) => {
        if (req.method() === 'POST' && req.url().includes('/cancel')) {
          cancelRequests.push(req.url());
        }
      });

      await keywordPage.cancelButton('Ketenagakerjaan').click();

      await keywordPage.expectToast('Keyword "Ketenagakerjaan" cancelled.', true);
      expect(cancelRequests).toHaveLength(1);
      expect(cancelRequests[0]).toContain('/api/admin/keyword/unscheduled/un-2/cancel');
    });

    test('modal Move to scheduled keyword: prefill, validasi, dan submit toast sukses', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await keywordPage.gotoOnDemandTab();

      await keywordPage.moveButton('RUU Digital').click();
      await expect(keywordPage.moveModal).toBeVisible();

      // Data baris ter-prefill (platform mengikuti item, frequency default 1, max posts 500)
      await expect(keywordPage.moveKeywordInput).toHaveValue('RUU Digital');
      await expect(keywordPage.movePlatformCheckbox('X')).toBeChecked();
      await expect(keywordPage.movePlatformCheckbox('Instagram')).not.toBeChecked();
      await expect(keywordPage.moveFrequencySelect).toHaveValue('1');
      await expect(keywordPage.moveMaxPostsInput).toHaveValue('500');

      // Validasi: keyword kosong → silent return (modal tetap terbuka, tanpa toast)
      await keywordPage.moveKeywordInput.fill('');
      await keywordPage.moveSubmitButton.click();
      await expect(keywordPage.moveModal).toBeVisible();
      await keywordPage.expectToast('Keyword "RUU Digital" moved to scheduled keywords.', false);

      // Validasi: platform kosong → silent return (modal tetap terbuka)
      await keywordPage.moveKeywordInput.fill('RUU Digital');
      await keywordPage.movePlatformCheckbox('X').uncheck();
      await keywordPage.moveSubmitButton.click();
      await expect(keywordPage.moveModal).toBeVisible();

      // Submit valid → toast sukses & modal tertutup (aksi UI-only, tanpa request API)
      await keywordPage.movePlatformCheckbox('X').check();
      await keywordPage.moveSubmitButton.click();
      await keywordPage.expectToast('Keyword "RUU Digital" moved to scheduled keywords.', true);
      await expect(keywordPage.moveModal).toHaveCount(0);
    });

    test('modal Run history menampilkan daftar run tersimpan untuk keyword', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await mockUnscheduledHistory(keywordPage.page);
      await keywordPage.gotoOnDemandTab();

      // Tombol "History · 2" muncul karena runCount > 1
      await keywordPage.historyButton('RUU Digital').click();
      await expect(keywordPage.historyModal).toBeVisible();
      await expect(
        keywordPage.historyModal.getByText(/RUU Digital · 2 runs stored/)
      ).toBeVisible();

      // Run terbaru ditandai "Latest"; daftar render platform, periode, dan status
      await expect(keywordPage.historyModal.getByText('Latest', { exact: true })).toBeVisible();
      await expect(keywordPage.historyModal.getByText('Last 24 hours', { exact: true })).toBeVisible();
      await expect(keywordPage.historyModal.getByText('Last 7 days', { exact: true })).toBeVisible();
      await expect(keywordPage.historyModal.getByText('Completed', { exact: true })).toBeVisible();
      await expect(keywordPage.historyModal.getByText('Failed', { exact: true })).toBeVisible();
      await expect(keywordPage.historyModal.getByRole('link', { name: 'View' })).toBeVisible();
    });
  });

  test.describe('Halaman detail unscheduled', () => {
    test('halaman detail unscheduled (completed) menampilkan breadcrumb, status, dan hasil analisis', async ({ keywordPage, unscheduledDetailPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await mockUnscheduledDetail(keywordPage.page, {
        id: 'un-1',
        keyword: 'RUU Digital',
        platforms: ['X'],
        periodLabel: 'Last 24 hours',
        createdAt: new Date().toISOString(),
        status: 'completed',
        runCount: 2,
        progressPct: 100,
      });
      await mockDashboardApis(keywordPage.page);
      await keywordPage.gotoOnDemandTab();

      // Link "View detail" tersedia di baris completed
      await expect(keywordPage.viewDetailLink('RUU Digital')).toBeVisible();
      // Navigasi langsung (deterministik — klik link rentan race dengan
      // polling list tiap 4 dtk yang me-render ulang baris)
      await unscheduledDetailPage.goto('un-1');

      await expect(unscheduledDetailPage.breadcrumb.getByText('Keyword monitoring')).toBeVisible();
      await expect(
        unscheduledDetailPage.page.getByText('Keyword on demand · Completed')
      ).toBeVisible();
      await unscheduledDetailPage.expectHeading('RUU Digital');
      await expect(
        unscheduledDetailPage.page.getByText(/Scraping and AI analysis results for the period/)
      ).toBeVisible();
      // Tag status di header (scope: header — "Completed" juga muncul di kartu CollectionSummary)
      await expect(
        unscheduledDetailPage.page.locator('header').getByText('Completed', { exact: true })
      ).toBeVisible();

      // Integrasi detail → kartu dashboard (G2): collectionId "menggema" keyword
      await expect(
        unscheduledDetailPage.page.getByText('Collection #SIP-RUU Digital', { exact: true })
      ).toBeVisible();
      await expect(unscheduledDetailPage.conversationSummaryHeading).toBeVisible();
      await expect(unscheduledDetailPage.sentimentGroupHeading).toBeVisible();
      await expect(unscheduledDetailPage.contentGroupHeading).toBeVisible();
      await expect(unscheduledDetailPage.topPerformersHeading).toBeVisible();
      await expect(unscheduledDetailPage.exportReportButton).toBeVisible();
    });

    test('halaman detail unscheduled (belum completed) menampilkan pesan Detail not available yet', async ({ unscheduledDetailPage }) => {
      await mockUnscheduledDetail(unscheduledDetailPage.page, {
        id: 'un-2',
        keyword: 'Ketenagakerjaan',
        platforms: ['Instagram', 'TikTok'],
        periodLabel: 'Last 7 days',
        createdAt: new Date().toISOString(),
        status: 'queued',
        runCount: 1,
        progressPct: 0,
      });
      await unscheduledDetailPage.goto('un-2');

      await expect(
        unscheduledDetailPage.page.getByText('Keyword on demand · Queued')
      ).toBeVisible();
      await unscheduledDetailPage.expectHeading('Ketenagakerjaan');
      await expect(unscheduledDetailPage.notAvailable).toBeVisible();
      await expect(
        unscheduledDetailPage.page.getByText(/Analysis details will appear once this keyword/)
      ).toBeVisible();

      // Kartu analisis tidak dimuat untuk keyword yang belum selesai
      await expect(unscheduledDetailPage.sentimentGroupHeading).toHaveCount(0);
    });

    test('halaman detail unscheduled menampilkan error state dan tombol Retry berfungsi', async ({ unscheduledDetailPage }) => {
      // Request pertama gagal (500) → error notice; Retry → refetch sukses
      await mockUnscheduledDetail(
        unscheduledDetailPage.page,
        {
          id: 'un-1',
          keyword: 'RUU Digital',
          platforms: ['X'],
          periodLabel: 'Last 24 hours',
          createdAt: new Date().toISOString(),
          status: 'completed',
          runCount: 2,
          progressPct: 100,
        },
        { failFirst: 1 },
      );
      await mockDashboardApis(unscheduledDetailPage.page);
      await unscheduledDetailPage.goto('un-1');

      await unscheduledDetailPage.expectErrorNotice();
      await expect(unscheduledDetailPage.retryButton).toBeVisible();

      await unscheduledDetailPage.retryButton.click();

      // Setelah Retry, data berhasil dimuat
      await unscheduledDetailPage.expectHeading('RUU Digital');
      await expect(unscheduledDetailPage.notAvailable).toHaveCount(0);
    });
  });
});
