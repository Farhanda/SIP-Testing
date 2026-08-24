import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockKeywordOptions,
  mockSchedulerList,
  mockUnscheduledList,
  mockCreateScheduler,
  mockCreateUnscheduled,
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

      // Default: semua platform terpilih (listbox) & periode "24 Hours" (select)
      await keywordPage.expectUnscPlatformsSelected(['Instagram', 'TikTok', 'Twitter/X']);
      await expect(keywordPage.unscPeriodSelect).toHaveValue('24H');
      await expect(keywordPage.startProcessButton).toBeVisible();
    });

    test('validasi keyword kosong tidak mengirim request (modal tetap terbuka)', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockUnscheduledList(page);
      // Add On Demand POST ke /v1/scrape (bare) — lihat mockCreateUnscheduled
      await mockCreateUnscheduled(page, { succeed: true });
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

    test('submit valid mengirim POST ke BE & menutup modal', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockUnscheduledList(page);
      // Add On Demand POST ke /v1/scrape (bare), bukan /keyword-management
      await mockCreateUnscheduled(page, { succeed: true });
      await keywordPage.gotoOnDemandTab();

      await keywordPage.openCreateModal();

      const postBodies: Record<string, unknown>[] = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/v1\/scrape(\?|$)/.test(req.url())) {
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
      // (field keyword adalah combobox → dikirim sebagai array)
      await expect.poll(() => postBodies.length).toBeGreaterThan(0);
      const sentKeyword = postBodies[0].keyword;
      expect(Array.isArray(sentKeyword) ? sentKeyword[0] : sentKeyword).toBe('Tes Keyword');

      await keywordPage.expectCreateModalOpen(false);
    });

    test('gagal dari server membuat modal tetap terbuka', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await mockCreateUnscheduled(keywordPage.page, { succeed: false });
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
      await keywordPage.goto();

      await keywordPage.openEditModal('RUU Digital');

      // Data baris ter-prefill
      await expect(keywordPage.editKeywordInput).toHaveValue('RUU Digital');
      for (const platform of ['Twitter/X', 'Instagram', 'TikTok']) {
        await expect(keywordPage.platformCheckbox(platform)).toBeChecked();
      }
      await expect(keywordPage.saveChangesButton).toBeVisible();
    });

    test('validasi keyword kosong tidak menyimpan (modal tetap terbuka)', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockSchedulerList(page);
      await mockUpdateScheduler(page, { succeed: true });
      await keywordPage.goto();

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
      await keywordPage.goto();

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
