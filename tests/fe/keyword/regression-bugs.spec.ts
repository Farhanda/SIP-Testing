import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockCreateScheduler,
  mockKeywordOptions,
  mockSchedulerList,
  mockUnscheduledList,
} from '../../../src/helpers/api-mock';

/**
 * Test regresi bug yang ditemukan dalam deep bug hunt (audit kode + probe
 * browser, 2026-08-12 & 2026-08-31). Test ini meng-encode perilaku yang BENAR —
 * jadi akan FAIL selama bug masih ada, lalu PASS setelah bug diperbaiki.
 *
 * - R2 (Bug B3, FIXED deploy 2026-09): Periode Custom dengan tanggal terbalik
 *   di modal Add On Demand — selector period sudah dihapus dari modal; validasi
 *   kini hidup di dialog jadwal (Add/Move/Edit scheduled): start_at > end_at
 *   DITOLAK tanpa request, modal tetap terbuka. Test menegakkan kontrak
 *   TC-UI-005 / P-03 pada dialog Add scheduled → sekarang PASS.
 *
 * - R9 (2026-08-31, masih buka): Escape key tidak menutup modal Add keyword.
 *   Modal hanya bisa ditutup via tombol Close/Cancel — Escape diabaikan.
 *   Ini accessibility (a11y) issue.
 *
 * - R10 (2026-08-31, masih buka): Error codes teknis (PROVIDER_PERMANENT_ERROR,
 *   PREPARATION_RETRY_EXHAUSTED) ter-expose ke user di keyword list.
 *
 * Terkait UI deploy 2026-09: R1 (Add scheduled) & B4 (Move to scheduled) kini
 * DIKEMBALIKAN ke aplikasi — coverage positifnya ada di keyword-modals.spec.ts
 * (Add scheduled POST) & keyword-actions.spec.ts (Move/Edit PUT).
 */
test.describe('Regresi Bug — Monitoring Keyword', () => {
  test('REGRESI R2: jadwal dengan tanggal terbalik (start > end) harus DITOLAK (tanpa request)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockSchedulerList(keywordPage.page);
    await mockCreateScheduler(keywordPage.page, { succeed: true });
    await keywordPage.gotoScheduledTab();

    const postRequests: string[] = [];
    keywordPage.page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/v1/scrape/keyword-management')) {
        postRequests.push(req.url());
      }
    });

    await keywordPage.openAddScheduledModal();
    await keywordPage.page.locator('#keyword').click();
    await keywordPage.page.locator('#keyword').fill('Tes Tanggal Terbalik');
    await keywordPage.addScheduleStartInput.fill('2026-09-10T09:00');
    await keywordPage.addScheduleEndInput.fill('2026-09-01T09:00'); // TERBALIK: start > end
    await keywordPage.frequencyValueInput.fill('2');
    await keywordPage.frequencyUnitSelect.selectOption({ label: 'Hour(s)' });
    await keywordPage.saveKeywordButton.click();

    // Perilaku benar (diverifikasi probe 2026-09-02): validasi menolak →
    // TIDAK ada request & modal tetap terbuka. (Bug B3 versi lama yang
    // menerima tanggal terbalik sudah diperbaiki lewat validasi UI baru.)
    await expect.poll(() => postRequests.length).toBe(0);
    await expect(keywordPage.page.locator('#keyword')).toBeVisible();
  });

  test('REGRESI R9: Escape key harus menutup modal Add keyword (a11y)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    await keywordPage.openCreateModal();
    await expect(keywordPage.createModal).toBeVisible();

    // Escape harus menutup modal (standar UX & a11y)
    await keywordPage.page.keyboard.press('Escape');

    // 🔴 BUG R9: saat ini Escape TIDAK menutup modal → modal masih terbuka → FAIL.
    // Perilaku benar: Escape menutup modal → toHaveCount(0) PASS.
    await expect(keywordPage.createModal).toHaveCount(0);
  });

  test('REGRESI R10: error codes harus tidak ter-expose ke user (harusnya user-friendly)', async ({ keywordPage }) => {
    // 🔴 BUG R10: keyword list menampilkan raw error codes seperti
    // RETRY_EXHAUSTED, PROVIDER_PERMANENT_ERROR — seharusnya pesan
    // user-friendly. Mock DETERMINISTIK (bukan data live yang bisa berubah)
    // supaya test stabil: item dengan last_execution_status raw error code
    // → FAIL selama UI masih menampilkan code mentah, PASS setelah UI
    // menampilkan pesan ramah (condition di mock tetap dipetakan).
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page, [
      {
        id: 'un-r10',
        keyword: 'RUU Digital',
        platforms: ['Twitter/X'],
        periodLabel: 'Last 24 hours',
        createdAt: new Date().toISOString(),
        status: 'failed',
        runCount: 1,
        progressPct: 0,
        lastExecutionStatus: 'RETRY_EXHAUSTED',
      },
    ]);
    await keywordPage.gotoOnDemandTab();

    // Baris mock harus ter-render dengan status Failed + raw error code
    await expect(keywordPage.page.getByText('RUU Digital', { exact: true })).toBeVisible();
    await expect(keywordPage.page.getByText('Failed', { exact: true })).toBeVisible();

    const hasErrorCode = await keywordPage.page
      .getByText(/RETRY_EXHAUSTED|PROVIDER_PERMANENT_ERROR/)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // PASS jika TIDAK ada error code (sudah fix).
    // FAIL jika masih ada raw error code → harus diganti pesan user-friendly.
    expect(hasErrorCode).toBe(false);
  });
});

