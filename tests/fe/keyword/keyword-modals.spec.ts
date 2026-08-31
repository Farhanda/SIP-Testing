import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockKeywordOptions,
  mockUnscheduledList,
  mockCreateScheduler,
} from '../../../src/helpers/api-mock';

/**
 * Test modal di halaman Monitoring Keyword (FR-13 — form & validasi).
 * UI saat ini (2026-08) hanya punya tab On Demand; create = POST ke
 * /v1/scrape/keyword-management (schedule_enabled=false). Modal Edit
 * scheduled sudah dihapus dari aplikasi → test-nya ikut dihapus.
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
      // dinamis — deploy 2026-08 bisa hanya subset platform)
      await keywordPage.expectUnscPlatformsAllSelected();
      // Period kini berupa button (HeadlessUI Listbox), bukan <select>
      await expect(keywordPage.unscPeriodButton).toBeVisible();
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

      // Modal mungkin仍 terbuka (confirm dialog overlay) — gunakan exact match
      await expect(keywordPage.createModal).toBeVisible();
    });
  });
});

