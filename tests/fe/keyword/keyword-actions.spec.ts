import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  MOCK_SCHEDULER_ITEMS,
  MOCK_UNSCHEDULED_ITEMS,
  mockKeywordOptions,
  mockSchedulerList,
  mockToggleKeyword,
  mockUnscheduledDetail,
  mockUnscheduledList,
  mockUpdateScheduler,
} from '../../../src/helpers/api-mock';

/**
 * Test aksi halaman Monitoring Keyword — UI deploy 2026-09 menghidupkan
 * kembali fitur scheduled: Move-to-scheduled (On Demand → Scheduled) dan
 * Edit scheduled aktif lagi. Aksi baris On Demand: Toggle status,
 * Reprocess (dialog), Move-to-scheduled. Aksi baris Scheduled: Toggle,
 * Edit, Move-to-on-demand.
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

  test.describe('Toggle status (On Demand & Scheduled)', () => {
    test('toggle status baris On Demand mengirim PATCH activate/deactivate ke BE', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockUnscheduledList(page, MOCK_UNSCHEDULED_ITEMS);
      await mockToggleKeyword(page, { unscheduled: MOCK_UNSCHEDULED_ITEMS });
      await keywordPage.gotoOnDemandTab();

      const patchRequests: string[] = [];
      page.on('request', (req) => {
        if (req.method() === 'PATCH' && req.url().includes('/keyword-management/')) {
          patchRequests.push(req.url());
        }
      });

      // RUU Digital (mock completed → switch ON) → toggle → PATCH /deactivate
      await expect(keywordPage.toggleStatus('RUU Digital')).toBeChecked();
      await keywordPage.toggleStatus('RUU Digital').click();
      await expect.poll(() => patchRequests.length).toBeGreaterThan(0);
      expect(patchRequests[0]).toMatch(/\/v1\/scrape\/keyword-management\/un-1\/deactivate$/);

      // BPJS Kesehatan (mock failed → switch OFF) → toggle → PATCH /activate
      await expect(keywordPage.toggleStatus('BPJS Kesehatan')).not.toBeChecked();
      await keywordPage.toggleStatus('BPJS Kesehatan').click();
      await expect.poll(() => patchRequests.length).toBe(2);
      expect(patchRequests[1]).toMatch(/\/v1\/scrape\/keyword-management\/un-3\/activate$/);

      // Setelah refetch, state mock ikut berubah (round-trip UI ↔ mock)
      await expect(keywordPage.toggleStatus('RUU Digital')).not.toBeChecked();
      await expect(keywordPage.toggleStatus('BPJS Kesehatan')).toBeChecked();
    });

    test('toggle status baris Scheduled mengirim PATCH activate/deactivate & switch ikut berubah', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockSchedulerList(page, MOCK_SCHEDULER_ITEMS);
      await mockToggleKeyword(page, { scheduler: MOCK_SCHEDULER_ITEMS });
      await keywordPage.gotoScheduledTab();

      const patchRequests: string[] = [];
      page.on('request', (req) => {
        if (req.method() === 'PATCH' && req.url().includes('/keyword-management/')) {
          patchRequests.push(req.url());
        }
      });

      // RUU Digital (mock active → switch ON) → toggle → PATCH /deactivate & switch OFF
      await expect(keywordPage.toggleStatus('RUU Digital')).toBeChecked();
      await keywordPage.toggleStatus('RUU Digital').click();
      await expect.poll(() => patchRequests.length).toBe(1);
      expect(patchRequests[0]).toMatch(/\/v1\/scrape\/keyword-management\/sch-1\/deactivate$/);
      await expect(keywordPage.toggleStatus('RUU Digital')).not.toBeChecked();

      // Ketenagakerjaan (mock hold → switch OFF) → toggle → PATCH /activate & switch ON
      await expect(keywordPage.toggleStatus('Ketenagakerjaan')).not.toBeChecked();
      await keywordPage.toggleStatus('Ketenagakerjaan').click();
      await expect.poll(() => patchRequests.length).toBe(2);
      expect(patchRequests[1]).toMatch(/\/v1\/scrape\/keyword-management\/sch-3\/activate$/);
      await expect(keywordPage.toggleStatus('Ketenagakerjaan')).toBeChecked();
    });
  });

  test.describe('Move to scheduled (On Demand → Scheduled)', () => {
    test('Move to scheduled mengirim PUT ke BE dengan jadwal (schedule_enabled=true)', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockUnscheduledList(page);
      await mockUpdateScheduler(page, { succeed: true });
      await keywordPage.gotoOnDemandTab();

      const putBodies: Array<{ url: string; body: Record<string, unknown> }> = [];
      page.on('request', (req) => {
        if (req.method() === 'PUT' && req.url().includes('/v1/scrape/keyword-management/')) {
          try {
            putBodies.push({ url: req.url(), body: JSON.parse(req.postData() ?? '{}') });
          } catch {
            // abaikan body yang tidak valid
          }
        }
      });

      await keywordPage.moveToScheduledButton('RUU Digital').click();
      const dlg = page.getByRole('dialog').last();
      await expect(dlg.getByRole('button', { name: 'Move keyword' })).toBeVisible();

      // Dialog memakai keyword baris yang sama & field jadwal terisi
      await keywordPage.moveScheduleStartInput.fill('2026-09-10T09:00');
      await keywordPage.moveScheduleEndInput.fill('2026-09-11T09:00');
      await keywordPage.frequencyValueInput.fill('3');
      await keywordPage.frequencyUnitSelect.selectOption({ label: 'Day(s)' });
      await keywordPage.moveKeywordButton.click();

      await expect.poll(() => putBodies.length).toBeGreaterThan(0);
      const { url, body } = putBodies[0];
      expect(url).toMatch(/\/v1\/scrape\/keyword-management\/[^/]+$/);
      expect(body.keyword).toBe('RUU Digital');
      expect(body.schedule_enabled).toBe(true);
      const sched = body.schedule as Record<string, unknown>;
      expect(String(sched.start_at)).toMatch(/^2026-09-10T/);
      expect((sched.frequency as Record<string, unknown>).unit).toBe('DAY');
      expect((sched.frequency as Record<string, unknown>).value).toBe(3);
    });

    test('tombol Move to scheduled tidak menutup dialog tanpa submit (Cancel)', async ({ keywordPage }) => {
      await mockKeywordOptions(keywordPage.page);
      await mockUnscheduledList(keywordPage.page);
      await keywordPage.gotoOnDemandTab();

      await keywordPage.moveToScheduledButton('RUU Digital').click();
      const dlg = keywordPage.page.getByRole('dialog').last();
      await expect(dlg.getByRole('button', { name: 'Move keyword' })).toBeVisible();
      await dlg.getByRole('button', { name: 'Cancel' }).click();
      await expect(dlg).toHaveCount(0);
    });
  });

  test.describe('Edit scheduled (tab Scheduled)', () => {
    test('Edit scheduled membuka dialog ter-prefill & mengirim PUT perubahan', async ({ keywordPage }) => {
      const page = keywordPage.page;
      await mockKeywordOptions(page);
      await mockSchedulerList(page);
      await mockUpdateScheduler(page, { succeed: true });
      await keywordPage.gotoScheduledTab();

      const putBodies: Array<Record<string, unknown>> = [];
      page.on('request', (req) => {
        if (req.method() === 'PUT' && req.url().includes('/v1/scrape/keyword-management/')) {
          try {
            putBodies.push(JSON.parse(req.postData() ?? '{}'));
          } catch {
            // abaikan
          }
        }
      });

      await keywordPage.editScheduledButton('RUU Digital').click();
      const dlg = page.getByRole('dialog').last();
      await expect(dlg.getByRole('button', { name: 'Save changes' })).toBeVisible();

      // Prefill: keyword & platform sesuai baris scheduled
      await expect(keywordPage.editKeywordInput).toHaveValue('RUU Digital');

      // Ubah frequency lalu simpan
      await keywordPage.frequencyValueInput.fill('5');
      await keywordPage.frequencyUnitSelect.selectOption({ label: 'Hour(s)' });
      await keywordPage.saveChangesButton.click();

      await expect.poll(() => putBodies.length).toBeGreaterThan(0);
      const body = putBodies[0];
      expect(body.keyword).toBe('RUU Digital');
      expect(body.schedule_enabled).toBe(true);
      const sched = body.schedule as Record<string, unknown>;
      expect((sched.frequency as Record<string, unknown>).unit).toBe('HOUR');
      expect((sched.frequency as Record<string, unknown>).value).toBe(5);
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

