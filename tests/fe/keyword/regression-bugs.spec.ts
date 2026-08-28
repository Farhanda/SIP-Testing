import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockCreateScheduler,
  mockKeywordOptions,
  mockUnscheduledList,
} from '../../../src/helpers/api-mock';

/**
 * Test regresi bug yang ditemukan dalam deep bug hunt (audit kode + probe
 * browser, 2026-08-12). Test ini meng-encode perilaku yang BENAR — jadi akan
 * FAIL selama bug masih ada, lalu PASS setelah bug diperbaiki.
 *
 * - R2 (Bug B3): Periode Custom dengan tanggal terbalik (from > to) saat ini
 *   diterima & diproses. Test memaksa kontrak TC-UI-005 / P-03: tanggal
 *   terbalik HARUS ditolak — tidak ada request, modal tetap terbuka.
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
    await keywordPage.unscPeriodSelect.selectOption('custom'); // period = select (bukan radio)
    await keywordPage.unscDateFromInput.fill('2026-08-10');
    await keywordPage.unscDateToInput.fill('2026-08-01'); // TERBALIK: from > to
    await keywordPage.submitCreate();

    // Bug B3: saat ini submit BERHASIL → modal menutup → assert ini FAIL.
    // Perilaku benar: validasi menolak → modal tetap terbuka.
    await keywordPage.expectCreateModalOpen(true);
    await expect.poll(() => postRequests.length).toBe(0);
    await keywordPage.expectToast(`Keyword "Tes Tanggal Terbalik" added.`, false);
  });
});

