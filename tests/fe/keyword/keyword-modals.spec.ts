import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockCreateUnscheduled,
  mockKeywordOptions,
  mockSchedulerList,
  mockUnscheduledList,
  mockUpdateScheduler,
} from '../../../src/helpers/api-mock';

/**
 * Test modal di halaman Monitoring Keyword (FR-13 — form & validasi):
 * 1) Modal "Add keyword" (tab On Demand) → POST /api/admin/keyword/unscheduled
 * 2) Modal "Edit scheduled keyword" (tab Scheduled) → PATCH /api/admin/keyword/scheduler/:id
 *
 * Catatan: validasi kedua modal bersifat "silent return" — submit dengan
 * keyword/platform tidak valid TIDAK mengirim request & TIDAK menampilkan
 * pesan error; modal tetap terbuka. Test mengikuti perilaku nyata ini.
 * Endpoint POST/PATCH di-mock agar deterministik (aplikasi punya random failure).
 */
test.describe('Monitoring Keyword — Modal', () => {
  test.describe('Modal Add keyword (On Demand)', () => {
    test('modal Add keyword terbuka dengan field & nilai default', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await keywordPage.gotoOnDemandTab();

      await keywordPage.openCreateModal();

      // Judul & field
      await expect(
        keywordPage.page.getByRole('heading', { name: 'Add keyword' })
      ).toBeVisible();
      await expect(keywordPage.unscKeywordInput).toBeVisible();

      // Default: semua platform terpilih (listbox) & periode "24 Hours" (select)
      await keywordPage.expectUnscPlatformsSelected(['X', 'Instagram', 'TikTok']);
      await expect(keywordPage.unscPeriodSelect).toHaveValue('24H');
      await expect(keywordPage.startProcessButton).toBeVisible();
    });

    test('validasi keyword kosong & platform kosong tidak mengirim (modal tetap terbuka)', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await mockCreateUnscheduled(keywordPage.page, { succeed: true });
      await keywordPage.gotoOnDemandTab();

      await keywordPage.openCreateModal();

      // Skenario 1 — keyword terisi, platform kosong → validasi JS (silent return)
      await keywordPage.fillUnscKeyword('Tes Validasi');
      await keywordPage.setUnscPlatforms([]); // kosongkan semua platform (listbox)
      await keywordPage.submitCreate();
      await keywordPage.expectCreateModalOpen(true);
      await keywordPage.expectToast(`Keyword "Tes Validasi" added.`, false);

      // Skenario 2 — keyword kosong (input required) → submit tetap diblokir
      await keywordPage.setUnscPlatforms(['X', 'Instagram', 'TikTok']); // kembalikan semua
      await keywordPage.fillUnscKeyword('');
      await keywordPage.submitCreate();
      await keywordPage.expectCreateModalOpen(true);
    });

    test('submit valid menampilkan toast sukses & menutup modal', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await mockCreateUnscheduled(keywordPage.page, { succeed: true });
      await keywordPage.gotoOnDemandTab();

      await keywordPage.openCreateModal();
      await keywordPage.fillUnscKeyword('Tes Keyword');
      await keywordPage.submitCreate();

      await keywordPage.expectToast(`Keyword "Tes Keyword" added.`, true);
      await keywordPage.expectCreateModalOpen(false);
    });

    test('period Custom menampilkan date field dan validasi submit', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await mockCreateUnscheduled(keywordPage.page, { succeed: true });
      await keywordPage.gotoOnDemandTab();

      await keywordPage.openCreateModal();
      await keywordPage.fillUnscKeyword('Tes Custom');
      await keywordPage.unscPeriodSelect.selectOption('custom');

      // Date field muncul saat period = Custom
      await expect(keywordPage.unscDateFromInput).toBeVisible();
      await expect(keywordPage.unscDateToInput).toBeVisible();

      // Submit tanpa tanggal → silent return, modal tetap terbuka
      await keywordPage.submitCreate();
      await keywordPage.expectCreateModalOpen(true);

      // Isi tanggal → submit → sukses & modal tertutup
      await keywordPage.unscDateFromInput.fill('2026-08-01');
      await keywordPage.unscDateToInput.fill('2026-08-07');
      await keywordPage.submitCreate();

      await keywordPage.expectToast(`Keyword "Tes Custom" added.`, true);
      await keywordPage.expectCreateModalOpen(false);
    });

    test('gagal dari server menampilkan toast error & modal tetap terbuka', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await mockCreateUnscheduled(keywordPage.page, { succeed: false });
      await keywordPage.gotoOnDemandTab();

      await keywordPage.openCreateModal();
      await keywordPage.fillUnscKeyword('Tes Gagal');
      await keywordPage.submitCreate();

      await keywordPage.expectToast('Failed to add keyword.', true);
      await keywordPage.expectCreateModalOpen(true);
    });
  });

  test.describe('Modal Edit scheduled keyword (Scheduled)', () => {
    test('modal Edit scheduled keyword terbuka dengan data baris terisi', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockSchedulerList(keywordPage.page);
      await keywordPage.goto();

      await keywordPage.openEditModal('SIP Indonesia');

      // Data baris ter-prefill
      await expect(keywordPage.editKeywordInput).toHaveValue('SIP Indonesia');
      for (const platform of ['X', 'Instagram', 'TikTok']) {
        await expect(keywordPage.platformCheckbox(platform)).toBeChecked();
      }
      // cron "Every 1 hour" → frequency 1
      await expect(keywordPage.editFrequencySelect).toHaveValue('1');
      await expect(keywordPage.saveChangesButton).toBeVisible();
    });

    test('validasi keyword kosong tidak menyimpan (modal tetap terbuka)', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockSchedulerList(keywordPage.page);
      await mockUpdateScheduler(keywordPage.page, { succeed: true });
      await keywordPage.goto();

      await keywordPage.openEditModal('SIP Indonesia');

      // Skenario 1 — platform kosong (keyword terisi) → validasi JS (silent return)
      await keywordPage.deselectAllPlatforms();
      await keywordPage.saveEdit();
      await keywordPage.expectEditModalOpen(true);
      await keywordPage.expectToast('Keyword "SIP Indonesia" updated successfully.', false);

      // Skenario 2 — keyword kosong (input required) → submit tetap diblokir
      for (const platform of ['X', 'Instagram', 'TikTok']) {
        await keywordPage.platformCheckbox(platform).check();
      }
      await keywordPage.editKeywordInput.fill('');
      await keywordPage.saveEdit();
      await keywordPage.expectEditModalOpen(true);
    });

    test('simpan perubahan menampilkan toast sukses & menutup modal', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockSchedulerList(keywordPage.page);
      await mockUpdateScheduler(keywordPage.page, { succeed: true });
      await keywordPage.goto();

      // Tangkap body PATCH untuk membuktikan parameter terkirim benar (FR-13)
      let patchBody: Record<string, unknown> | null = null;
      keywordPage.page.on('request', (req) => {
        if (req.method() === 'PATCH' && req.url().includes('/scheduler/')) {
          patchBody = JSON.parse(req.postData() ?? '{}');
        }
      });

      await keywordPage.openEditModal('SIP Indonesia');
      await keywordPage.editKeywordInput.fill('SIP Indonesia Baru');
      await keywordPage.editFrequencySelect.selectOption('30');
      await keywordPage.saveEdit();

      await keywordPage.expectToast('Keyword "SIP Indonesia Baru" updated successfully.', true);
      await keywordPage.expectEditModalOpen(false);

      // Parameter yang dikirim ke API benar — UI sekarang mengirim slug
      // lowercase (x/instagram/tiktok), bukan label (dicek 2026-08-14).
      expect(patchBody).toEqual({
        keyword: 'SIP Indonesia Baru',
        platforms: ['x', 'instagram', 'tiktok'],
        cron: 'Every 30 minutes',
      });
    });
  });
});
