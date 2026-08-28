import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockKeywordOptions,
  mockUnscheduledDetail,
  mockUnscheduledList,
} from '../../../src/helpers/api-mock';

/**
 * Test aksi halaman Monitoring Keyword — UI saat ini (2026-08) hanya punya
 * tab On Demand. Aksi baris yang tersedia: Toggle status, View detail, dan
 * Reprocess (dialog). Aksi lama (Move to scheduled, Edit scheduled, Retry,
 * Cancel, Run history) sudah dihapus dari aplikasi → test-nya ikut dihapus.
 */
test.describe('Monitoring Keyword — Aksi', () => {
  test.describe('Tab On Demand', () => {
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

