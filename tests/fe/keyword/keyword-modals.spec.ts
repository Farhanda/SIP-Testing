import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockKeywordOptions,
  mockSchedulerList,
  mockUnscheduledList,
  mockCreateScheduler,
  mockUpdateScheduler,
} from '../../../src/helpers/api-mock';

/**
 * Test modal di halaman Monitoring Keyword (FR-13 — form & validasi).
 * Arsitektur BARU (2026-08): kedua tab memanggil BE langsung
 * /v1/scrape/keyword-management — create = POST, edit = PUT /:id.
 * Endpoint di-mock agar deterministik (aplikasi punya random failure).
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

      // Default: semua platform yang dirender listbox terpilih (daftar kini
      // dinamis — deploy 2026-08 bisa hanya subset platform); periode kosong
      await keywordPage.expectUnscPlatformsAllSelected();
      await expect(keywordPage.unscPeriodSelect).toHaveValue('');
      await expect(keywordPage.startProcessButton).toBeVisible();
    });

    test('validasi keyword kosong tidak mengirim request (modal tetap terbuka)', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockUnscheduledList(page);
      // Add On Demand kini POST ke /v1/scrape/keyword-management
      await mockCreateScheduler(page, { succeed: true });
      await keywordPage.gotoOnDemandTab();

      await keywordPage.openCreateModal();

      const posts: string[] = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && req.url().includes('/v1/scrape')) posts.push(req.url());
      });

      // Submit dengan keyword kosong → diblokir tanpa request
      await keywordPage.fillUnscKeyword('');
      await keywordPage.submitCreate();
      await keywordPage.expectCreateModalOpen(true);
      await expect.poll(() => posts.length).toBe(0);
    });

    test('submit valid mengirim POST ke BE sesuai kontrak keyword-management', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockUnscheduledList(page);
      // Add On Demand kini POST ke /v1/scrape/keyword-management
      await mockCreateScheduler(page, { succeed: true });
      await keywordPage.gotoOnDemandTab();

      await keywordPage.openCreateModal();

      const postBodies: Record<string, unknown>[] = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && req.url().includes('/v1/scrape')) {
          try {
            postBodies.push(JSON.parse(req.postData() ?? '{}'));
          } catch {
            postBodies.push({});
          }
        }
      });

      await keywordPage.fillUnscKeyword('Tes Keyword');
      await keywordPage.submitCreate();

      // Request POST terkirim dengan keyword yang diisi
      // (field keyword adalah combobox → dikirim sebagai array).
      // Catatan: penutupan modal TIDAK diassert — UI baru menutup modal
      // hanya setelah list-refresh mengonfirmasi keyword terbuat.
      await expect.poll(() => postBodies.length).toBeGreaterThan(0);
      const sentKeyword = postBodies[0].keyword;
      expect(Array.isArray(sentKeyword) ? sentKeyword[0] : sentKeyword).toBe('Tes Keyword');
    });

    test('gagal dari server membuat modal tetap terbuka', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await mockCreateScheduler(keywordPage.page, { succeed: false });
      await keywordPage.gotoOnDemandTab();

      await keywordPage.openCreateModal();
      await keywordPage.fillUnscKeyword('Tes Gagal');
      await keywordPage.submitCreate();

      await keywordPage.expectCreateModalOpen(true);
    });
  });

  test.describe('Modal Edit scheduled keyword (Scheduled)', () => {
    test('modal Edit scheduled keyword terbuka dengan data baris terisi', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockSchedulerList(keywordPage.page);
      await keywordPage.gotoScheduledTab();

      // Tunggu baris target benar-benar terrender sebelum membuka modal
      await expect(keywordPage.editRowButton('RUU Digital')).toBeVisible({ timeout: 10_000 });
      await keywordPage.openEditModal('RUU Digital');

      // Data baris ter-prefill
      await expect(keywordPage.editKeywordInput).toHaveValue('RUU Digital');

      // Checkbox platform kini DINAMIS (hanya platform relevan yang tampil)
      const boxes = keywordPage.page
        .getByRole('dialog')
        .locator('input[type="checkbox"]');
      const boxCount = await boxes.count();
      expect(boxCount).toBeGreaterThanOrEqual(1);
      for (let i = 0; i < boxCount; i++) {
        await expect(boxes.nth(i)).toBeChecked();
      }
      await expect(keywordPage.saveChangesButton).toBeVisible();
    });

    test('validasi keyword kosong tidak menyimpan (modal tetap terbuka)', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockSchedulerList(page);
      await mockUpdateScheduler(page, { succeed: true });
      await keywordPage.gotoScheduledTab();

      await keywordPage.openEditModal('RUU Digital');

      const puts: string[] = [];
      page.on('request', (req) => {
        if ((req.method() === 'PUT' || req.method() === 'PATCH') && req.url().includes('/v1/scrape/keyword-management/')) puts.push(req.url());
      });

      await keywordPage.editKeywordInput.fill('');
      await keywordPage.saveEdit();
      await keywordPage.expectEditModalOpen(true);
      await expect.poll(() => puts.length).toBe(0);
    });

    test('simpan perubahan mengirim PUT ke BE & menutup modal', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockSchedulerList(page);
      await mockUpdateScheduler(page, { succeed: true });
      await keywordPage.gotoScheduledTab();

      const putBodies: Record<string, unknown>[] = [];
      page.on('request', (req) => {
        if ((req.method() === 'PUT' || req.method() === 'PATCH') && req.url().includes('/v1/scrape/keyword-management/')) {
          try {
            putBodies.push(JSON.parse(req.postData() ?? '{}'));
          } catch {
            putBodies.push({});
          }
        }
      });

      await keywordPage.openEditModal('RUU Digital');
      await keywordPage.editKeywordInput.fill('RUU Digital Baru');
      await keywordPage.saveEdit();

      // Parameter yang dikirim sesuai kontrak baru (platform slug lowercase)
      await expect.poll(() => putBodies.length).toBeGreaterThan(0);
      expect(putBodies[0].keyword).toBe('RUU Digital Baru');
      expect(putBodies[0].schedule_enabled).toBe(true);
      expect(Array.isArray(putBodies[0].platforms)).toBe(true);

      await keywordPage.expectEditModalOpen(false);
    });
  });
});
