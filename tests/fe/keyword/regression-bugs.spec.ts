import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockCreateScheduler,
  mockCreateUnscheduled,
  mockKeywordOptions,
  mockSchedulerList,
  mockUnscheduledList,
} from '../../../src/helpers/api-mock';

/**
 * Test regresi bug yang ditemukan dalam deep bug hunt (audit kode + probe
 * browser, 2026-08-12). Kedua test ini meng-encode perilaku yang BENAR —
 * jadi akan FAIL selama bug masih ada, lalu PASS setelah bug diperbaiki
 * (pola yang sama dengan kategori "Expected-Fail" di project API).
 *
 * - R1 (Bug B1): Modal "+ Add keyword" (tab Scheduled) saat ini NO-OP —
 *   submit hanya menutup modal tanpa request API & tanpa toast, padahal
 *   fiturnya tampil lengkap di UI. Test ini memaksa kontrak: submit dengan
 *   keyword valid HARUS mengirim POST ke /api/admin/keyword/scheduler.
 * - R2 (Bug B3): Periode Custom dengan tanggal terbalik (from > to) saat ini
 *   diterima & diproses. Test ini memaksa kontrak TC-UI-005 / P-03:
 *   tanggal terbalik HARUS ditolak — tidak ada request, modal tetap terbuka.
 */
test.describe('Regresi Bug — Monitoring Keyword', () => {
  test('REGRESI R1: submit "+ Add keyword" (Scheduled) harus mengirim POST ke API', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockSchedulerList(keywordPage.page);
    await mockCreateScheduler(keywordPage.page, { succeed: true });
    await keywordPage.goto();

    // Buka modal "Add scheduled keyword" & isi form lengkap
    const modal = keywordPage.page.getByRole('dialog', { name: 'Add scheduled keyword' });
    await keywordPage.addKeywordButton.click();
    await expect(modal).toBeVisible();

    const postBodies: Record<string, unknown>[] = [];
    keywordPage.page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/admin/keyword/scheduler')) {
        try {
          postBodies.push(JSON.parse(req.postData() ?? '{}'));
        } catch {
          postBodies.push({});
        }
      }
    });

    await modal.locator('#keyword').fill('SIP Indonesia');
    await modal.getByRole('button', { name: 'Save keyword' }).click();

    // Bug B1: saat ini TIDAK ada request sama sekali → poll gagal (FAIL).
    await expect.poll(() => postBodies.length).toBeGreaterThan(0);
    expect(postBodies[0].keyword).toBe('SIP Indonesia');

    // Setelah request sukses (mock 201) modal harus menutup.
    await expect(modal).toHaveCount(0);
  });

  test('REGRESI R2: periode Custom dengan tanggal terbalik harus DITOLAK (tanpa request)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await mockCreateUnscheduled(keywordPage.page, { succeed: true });
    await keywordPage.gotoOnDemandTab();

    const postRequests: string[] = [];
    keywordPage.page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/admin/keyword/unscheduled')) {
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

  test('REGRESI B4: submit Move to scheduled harus mengirim request API (bukan toast-only)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await mockSchedulerList(keywordPage.page);
    // Jaring pengaman: kalau fix memanggil POST /scheduler, mock menang (201).
    await mockCreateScheduler(keywordPage.page, { succeed: true });
    await keywordPage.gotoOnDemandTab();

    const mutations: string[] = [];
    keywordPage.page.on('request', (req) => {
      if (req.method() !== 'GET' && req.url().includes('/api/admin/keyword/')) {
        mutations.push(`${req.method()} ${req.url()}`);
      }
    });

    await keywordPage.moveButton('Bantuan Sosial 2026').click();
    await expect(keywordPage.moveModal).toBeVisible();

    // Baseline: tab On Demand hanya polling GET (4s) — request non-GET tidak
    // pernah muncul secara alami, jadi snapshot ini menyaring noise masa depan.
    const baseline = mutations.length;
    await keywordPage.moveSubmitButton.click();

    // Bug B4: saat ini hanya toast + onClose(), TANPA request API → poll ini FAIL.
    // Perilaku benar: memindahkan keyword ke jadwal harus memanggil API.
    await expect.poll(() => mutations.length).toBeGreaterThan(baseline);
  });
});
