import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockUnscheduledDetail } from '../../../src/helpers/api-mock';

/**
 * Test halaman detail keyword on-demand (/monitoring/keyword/unscheduled/:id).
 * Menggunakan Page Object Model UnscheduledDetailPage (POM fixture).
 *
 * Menguji:
 * - Layout detail keyword completed (breadcrumb, heading, export button, kartu analisis)
 * - Navigasi breadcrumb kembali ke halaman monitoring keyword
 * - State keyword in-progress / queued ("Detail not available yet")
 * - Error handling saat detail gagal dimuat + aksi Retry
 */
test.describe('Monitoring Keyword — Detail On Demand', () => {
  test('detail unscheduled completed menampilkan breadcrumb, heading, tombol export, dan kartu analisis', async ({
    unscheduledDetailPage,
  }) => {
    await mockUnscheduledDetail(unscheduledDetailPage.page, {
      id: 'un-detail-1',
      keyword: 'RUU Digital',
      platforms: ['Twitter/X'],
      periodLabel: 'Last 24 hours',
      createdAt: new Date().toISOString(),
      status: 'completed',
      runCount: 1,
      progressPct: 100,
    });

    await unscheduledDetailPage.goto('un-detail-1');
    await unscheduledDetailPage.page.waitForLoadState('networkidle');

    await expect(unscheduledDetailPage.breadcrumb).toBeVisible();
    await unscheduledDetailPage.expectHeading('RUU Digital');
    await expect(unscheduledDetailPage.exportReportButton).toBeVisible();

    // Kartu analisis dashboard dirender untuk status completed
    await expect(unscheduledDetailPage.conversationSummaryHeading).toBeVisible();
    await expect(unscheduledDetailPage.sentimentGroupHeading).toBeVisible();
    await expect(unscheduledDetailPage.contentGroupHeading).toBeVisible();
    await expect(unscheduledDetailPage.topPerformersHeading).toBeVisible();
  });

  test('klik breadcrumb Keyword menavigasi kembali ke daftar monitoring keyword', async ({
    unscheduledDetailPage,
  }) => {
    await mockUnscheduledDetail(unscheduledDetailPage.page, {
      id: 'un-detail-nav',
      keyword: 'BPJS Kesehatan',
      platforms: ['TikTok'],
      periodLabel: 'Last 7 days',
      createdAt: new Date().toISOString(),
      status: 'completed',
      runCount: 2,
      progressPct: 100,
    });

    await unscheduledDetailPage.goto('un-detail-nav');
    await unscheduledDetailPage.page.waitForLoadState('networkidle');

    // Breadcrumb memuat link kembali ke halaman keyword
    const keywordBreadcrumb = unscheduledDetailPage.breadcrumb.getByRole('link', { name: /Keyword/i });
    await expect(keywordBreadcrumb).toBeVisible();
    await keywordBreadcrumb.click();

    await expect(unscheduledDetailPage.page).toHaveURL(/\/monitoring\/keyword/);
  });

  test('detail keyword dalam status processing menampilkan pesan not available', async ({
    unscheduledDetailPage,
  }) => {
    await mockUnscheduledDetail(unscheduledDetailPage.page, {
      id: 'un-detail-proc',
      keyword: 'Ketenagakerjaan',
      platforms: ['Instagram'],
      periodLabel: 'Last 24 hours',
      createdAt: new Date().toISOString(),
      status: 'processing',
      runCount: 0,
      progressPct: 40,
    });

    await unscheduledDetailPage.goto('un-detail-proc');
    await unscheduledDetailPage.page.waitForLoadState('networkidle');

    await unscheduledDetailPage.expectHeading('Ketenagakerjaan');
    await expect(unscheduledDetailPage.notAvailable).toBeVisible();
  });

  test('detail gagal dimuat menampilkan pesan error dan tombol Retry memuat ulang', async ({
    unscheduledDetailPage,
  }) => {
    await mockUnscheduledDetail(
      unscheduledDetailPage.page,
      {
        id: 'un-detail-retry',
        keyword: 'Pendidikan Inklusif',
        platforms: ['Twitter/X'],
        periodLabel: 'Last 24 hours',
        createdAt: new Date().toISOString(),
        status: 'completed',
        runCount: 1,
        progressPct: 100,
      },
      { failFirst: 1 }, // Request pertama gagal 500, request berikutnya (setelah Retry) sukses 200
    );

    await unscheduledDetailPage.goto('un-detail-retry');
    await unscheduledDetailPage.page.waitForLoadState('networkidle');

    // Pesan error & tombol Retry tampil
    await unscheduledDetailPage.expectErrorNotice();
    await expect(unscheduledDetailPage.retryButton).toBeVisible();

    // Klik Retry → memicu refetch yang berhasil
    await unscheduledDetailPage.retryButton.click();
    await unscheduledDetailPage.page.waitForLoadState('networkidle');

    await unscheduledDetailPage.expectHeading('Pendidikan Inklusif');
  });
});

