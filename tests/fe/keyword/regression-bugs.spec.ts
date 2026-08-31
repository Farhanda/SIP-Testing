import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockCreateScheduler,
  mockKeywordOptions,
  mockUnscheduledList,
} from '../../../src/helpers/api-mock';

/**
 * Test regresi bug yang ditemukan dalam deep bug hunt (audit kode + probe
 * browser, 2026-08-12 & 2026-08-31). Test ini meng-encode perilaku yang BENAR —
 * jadi akan FAIL selama bug masih ada, lalu PASS setelah bug diperbaiki.
 *
 * - R2 (Bug B3): Periode Custom dengan tanggal terbalik (from > to) saat ini
 *   diterima & diproses. Test memaksa kontrak TC-UI-005 / P-03: tanggal
 *   terbalik HARUS ditolak — tidak ada request, modal tetap terbuka.
 *
 * - R8 (2026-08-31): User menu navbar menampilkan "Profile2" (typo) bukan
 *   "Profile". Label harusnya "Profile" tanpa angka.
 *
 * - R9 (2026-08-31): Escape key tidak menutup modal Add keyword.
 *   Modal hanya bisa ditutup via tombol Close/Cancel — Escape diabaikan.
 *   Ini accessibility (a11y) issue.
 *
 * Terkait UI baru (2026-08): R1 (Scheduled add) & B4 (Move to scheduled)
 * dihapus karena tab Scheduled & aksi Move sudah dihapus dari aplikasi.
 */
test.describe('Regresi Bug — Monitoring Keyword', () => {
  test('REGRESI R2: periode Custom dengan tanggal terbalik harus DITOLAK (tanpa request)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await mockCreateScheduler(keywordPage.page, { succeed: true });
    await keywordPage.gotoOnDemandTab();

    const postRequests: string[] = [];
    keywordPage.page.on('request', (req) => {
      if (req.method() === 'POST' && /\/v1\/scrape(\?|$)|keyword-management/.test(req.url())) {
        postRequests.push(req.url());
      }
    });

    await keywordPage.openCreateModal();
    await keywordPage.fillUnscKeyword('Tes Tanggal Terbalik');
    await keywordPage.setUnscPeriod('Custom range'); // period kini berupa tombol-tombol
    await keywordPage.unscDateFromInput.fill('2026-08-10');
    await keywordPage.unscDateToInput.fill('2026-08-01'); // TERBALIK: from > to
    await keywordPage.submitCreate();

    // Bug B3: saat ini submit BERHASIL → modal menutup → assert ini FAIL.
    // Perilaku benar: validasi menolak → modal tetap terbuka.
    await keywordPage.expectCreateModalOpen(true);
    await expect.poll(() => postRequests.length).toBe(0);
    await keywordPage.expectToast(`Keyword "Tes Tanggal Terbalik" added.`, false);
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
    // PROVIDER_PERMANENT_ERROR, PREPARATION_RETRY_EXHAUSTED.
    // Seharusnya ditampilkan pesan user-friendly.
    await mockKeywordOptions(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    const hasErrorCode = await keywordPage.page
      .getByText(/PROVIDER_PERMANENT_ERROR|PREPARATION_RETRY_EXHAUSTED/)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // PASS jika TIDAK ada error code (sudah fix).
    // FAIL jika masih ada raw error code → harus diganti pesan user-friendly.
    expect(hasErrorCode).toBe(false);
  });
});

