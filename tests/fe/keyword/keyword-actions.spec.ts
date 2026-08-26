import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockCreateScheduler,
  mockKeywordOptions,
  mockSchedulerList,
  mockUnscheduledDetail,
  mockUnscheduledList,
} from '../../../src/helpers/api-mock';

/**
 * Test aksi halaman Monitoring Keyword — arsitektur BARU (2026-08).
 * Tab On Demand kini menyediakan Reprocess (dialog) & Move to scheduled;
 * tab Scheduled menyediakan action menu (Edit / Activate) per baris.
 * Aksi lama (kartu statistik, Retry, Cancel, Run history, halaman detail)
 * sudah tidak ada di UI dan test-nya dihapus mengikuti aplikasi.
 */
test.describe('Monitoring Keyword — Aksi', () => {
  test.describe('Tab Scheduled', () => {
    test('baris Scheduled menyediakan tombol Edit langsung', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockSchedulerList(keywordPage.page);
      await keywordPage.gotoScheduledTab();

      await expect(keywordPage.editRowButton('RUU Digital')).toBeVisible();
    });

    test('modal Edit scheduled keyword terbuka dari tombol Edit baris', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockSchedulerList(keywordPage.page);
      await keywordPage.gotoScheduledTab();

      await keywordPage.openEditModal('RUU Digital');

      await expect(keywordPage.editModal).toBeVisible();
      await expect(keywordPage.editKeywordInput).toHaveValue('RUU Digital');
    });
  });

  test.describe('Tab On Demand', () => {
    test('modal Move to scheduled keyword: terbuka dengan prefill & tombol submit', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      // Jaring pengaman bila fix memanggil POST /v1/scrape/keyword-management
      await mockCreateScheduler(keywordPage.page, { succeed: true });
      await keywordPage.gotoOnDemandTab();

      await keywordPage.moveButton('RUU Digital').click();
      await expect(keywordPage.moveModal).toBeVisible();
      await expect(keywordPage.moveKeywordInput).toBeVisible();
      await expect(keywordPage.moveSubmitButton).toBeVisible();
    });

    test('submit Move to scheduled menutup modal', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await mockCreateScheduler(keywordPage.page, { succeed: true });
      await keywordPage.gotoOnDemandTab();

      await keywordPage.moveButton('RUU Digital').click();
      await expect(keywordPage.moveModal).toBeVisible();
      await keywordPage.moveSubmitButton.click();

      // UX: setelah submit modal tertutup (apapun hasil servernya)
      await expect(keywordPage.moveModal).toHaveCount(0);
    });

    test('dialog Reprocess keyword terbuka dengan keyword ter-prefill & dapat dibatalkan', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await keywordPage.gotoOnDemandTab();

      await keywordPage.reprocessButton('RUU Digital').click();
      await expect(keywordPage.reprocessDialog).toBeVisible();
      await expect(keywordPage.reprocessKeywordInput).toHaveValue('RUU Digital');
      await expect(keywordPage.startReprocessingButton).toBeVisible();

      // Batal menutup dialog tanpa menjalankan apa pun
      await keywordPage.reprocessDialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(keywordPage.reprocessDialog).toHaveCount(0);
    });
  });

  test.describe('Halaman detail unscheduled', () => {
    // Link masuk: nama keyword di baris On Demand → /monitoring/keyword/unscheduled/:id.
    // Endpoint BE baru (2026-08): GET /v1/scrape/keyword-management/unscheduled/:id.

    test('detail unscheduled completed menampilkan breadcrumb, heading, dan hasil analisis', async ({ page }) => {
      await mockUnscheduledDetail(page, {
        id: 'un-1',
        keyword: 'RUU Digital',
        platforms: ['Twitter/X'],
        periodLabel: 'Last 24 hours',
        createdAt: new Date().toISOString(),
        status: 'completed',
        runCount: 2,
        progressPct: 100,
      });

      await page.goto('/monitoring/keyword/unscheduled/un-1');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'RUU Digital', exact: true })).toBeVisible();
      // Kartu analisis dashboard dirender untuk status completed
      await expect(page.getByRole('heading', { name: 'Conversation summary' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Sentiment & Emotion Analysis' })).toBeVisible();
    });

    test('detail gagal dimuat menampilkan pesan error', async ({ page }) => {
      await mockUnscheduledDetail(
        page,
        { id: 'un-x', keyword: 'X', platforms: [], periodLabel: '', createdAt: new Date().toISOString(), status: 'failed', runCount: 0, progressPct: 0 },
        { failFirst: 999 }, // selalu gagal
      );

      await page.goto('/monitoring/keyword/unscheduled/un-x');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Failed to load keyword detail.')).toBeVisible();
    });
  });
});
