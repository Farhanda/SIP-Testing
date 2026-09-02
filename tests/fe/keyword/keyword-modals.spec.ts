import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockCreateScheduler,
  mockKeywordOptions,
  mockSchedulerList,
  mockUnscheduledList,
} from '../../../src/helpers/api-mock';

/**
 * Test modal di halaman Monitoring Keyword (FR-13 — form & validasi).
 * UI deploy 2026-09 menghidupkan kembali tab Scheduled dengan dialog jadwal
 * (Add/Move/Edit: keyword + checkbox platform + start/end datetime +
 * frequency). Modal Add On Demand = POST ke /v1/scrape/keyword-management
 * (schedule_enabled=false); modal Add scheduled = POST schedule_enabled=true.
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

      // Default: semua checkbox platform terpilih (UI deploy 2026-09)
      await keywordPage.expectUnscPlatformsAllSelected();
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

      // Modal mungkin masih terbuka (confirm dialog overlay) — gunakan exact match
      await expect(keywordPage.createModal).toBeVisible();
    });
  });

  test.describe('Modal Add keyword scheduled (tab Scheduled)', () => {
    test('modal Add scheduled terbuka dengan keyword, platform, jadwal & frequency', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockSchedulerList(keywordPage.page);
      await keywordPage.gotoScheduledTab();

      await keywordPage.openAddScheduledModal();

      // Struktur dialog: keyword combobox, checkbox platform (default semua
      // terpilih), start/end datetime-local, frequency value + unit.
      const schedDialog = keywordPage.page.getByRole('dialog', { name: 'Add scheduled keyword' });
      await expect(keywordPage.page.locator('#keyword')).toBeVisible();
      const checkboxes = schedDialog.locator('input[type="checkbox"]');
      const total = await checkboxes.count();
      expect(total).toBeGreaterThanOrEqual(1);
      for (let i = 0; i < total; i++) {
        await expect(checkboxes.nth(i)).toBeChecked();
      }
      await expect(keywordPage.addScheduleStartInput).toBeVisible();
      await expect(keywordPage.addScheduleEndInput).toBeVisible();
      await expect(keywordPage.frequencyValueInput).toBeVisible();
      await expect(keywordPage.frequencyUnitSelect).toBeVisible();
      await expect(keywordPage.saveKeywordButton).toBeVisible();
    });

    test('submit Add scheduled valid mengirim POST schedule_enabled=true ke BE', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockSchedulerList(page);
      await mockCreateScheduler(page, { succeed: true });
      await keywordPage.gotoScheduledTab();

      await keywordPage.openAddScheduledModal();

      const postBodies: Record<string, unknown>[] = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && req.url().includes('/v1/scrape/keyword-management')) {
          try {
            postBodies.push(JSON.parse(req.postData() ?? '{}'));
          } catch {
            postBodies.push({});
          }
        }
      });

      await keywordPage.page.locator('#keyword').click();
      await keywordPage.page.locator('#keyword').fill('Jadwal Harian');
      await keywordPage.addScheduleStartInput.fill('2026-09-10T09:00');
      await keywordPage.addScheduleEndInput.fill('2026-09-11T09:00');
      await keywordPage.frequencyValueInput.fill('2');
      await keywordPage.frequencyUnitSelect.selectOption({ label: 'Hour(s)' });
      await keywordPage.saveKeywordButton.click();

      await expect.poll(() => postBodies.length).toBeGreaterThan(0);
      const body = postBodies[0];
      expect(body.schedule_enabled).toBe(true);
      const sched = body.schedule as Record<string, unknown>;
      // tanggal terkirim mengikuti timezone lokal — cukup assert tanggalnya
      expect(String(sched.start_at)).toMatch(/^2026-09-10T/);
      expect(String(sched.end_at)).toMatch(/^2026-09-11T/);
      expect((sched.frequency as Record<string, unknown>).unit).toBe('HOUR');
      expect((sched.frequency as Record<string, unknown>).value).toBe(2);
    });
  });
});

