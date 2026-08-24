import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockCreateScheduler,
  mockKeywordOptions,
  mockSchedulerList,
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
    test('action menu baris menampilkan opsi Edit', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockSchedulerList(keywordPage.page);
      await keywordPage.goto();

      await keywordPage.actionMenuButton('RUU Digital').click();

      await expect(keywordPage.page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    });

    test('modal Edit scheduled keyword dapat dibuka dari action menu', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockSchedulerList(keywordPage.page);
      await keywordPage.goto();

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
});
