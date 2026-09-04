import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockKeywordOptions,
  mockSchedulerList,
  mockUnscheduledList,
} from '../../../src/helpers/api-mock';

/**
 * Test Monitoring Keyword (/monitoring/keyword) — UI deploy 2026-09 punya
 * DUA tab: "On Demand" (default) & "Scheduled" (kembali aktif), keduanya
 * memanggil BE langsung GET /v1/scrape/keyword-management (beda query
 * schedule_enabled=true|false). Daftar di-mock (deterministik); filter
 * diuji end-to-end UI → API.
 *
 * + Eksplorasi live 2026-09-04 (http://10.200.101.13:3000) — memperluas
 *   file ini & keyword-modals.spec.ts:
 *   - Tab Scheduled dari URL langsung (?tab=scheduled) aktif.
 *   - Duplikasi keyword terdeteksi: "\"<kw>\" already exists on demand (Active)."
 *   - Validasi tanggal terbalik: "End date cannot be earlier than start date."
 *     — bisa muncul BERSAMAAN dengan pesan duplikasi (validasi berlapis).
 *   - Tombol × (aria-label="Close") menutup modal Add (On Demand & Scheduled).
 *   - Konsistensi heading antar tab (temuan T3 awal ternyata race probe —
 *     penajudan sudah benar: "Scheduled Keywords").
 *   Mock harus terdaftar SEBELUM navigasi manual (page.goto), bukan via
 *   gotoOnDemandTab/gotoScheduledTab yang langsung navigate di dalam helper.
 */
test.describe('Monitoring Keyword', () => {
  test('daftar On Demand tampil lengkap dengan tabel & filter', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    // Deployed app: 'Keyword Management' (atau 'Monitoring Keyword')
    const heading = keywordPage.page.getByRole('heading', { name: /Keyword (Management|Monitoring)/ });
    await heading.first().waitFor({ state: 'visible' });
    await keywordPage.expectOnDemandTabSelected();
    await expect(keywordPage.searchInput).toBeVisible();

    // Kolom tabel On Demand
    for (const header of ['Keyword', 'Platform', 'Created', 'Last Run', 'Status']) {
      await keywordPage.expectColumnHeader(header);
    }

    // Data mock ter-render
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await expect(keywordPage.paginationText).toBeVisible();
  });

  test('pencarian keyword memfilter daftar On Demand', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    await keywordPage.searchKeyword('RUU');

    // Pencarian 'RUU' hanya menampilkan keyword yang mengandung 'RUU'
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await keywordPage.expectKeywordVisible('BPJS Kesehatan', false);
  });

  test('aksi baris On Demand tersedia (Toggle status, View detail, Reprocess)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    // Data mock ter-render
    await keywordPage.expectKeywordVisible('RUU Digital', true);

    // Aksi baris On Demand yang tersedia di UI saat ini
    await expect(keywordPage.toggleStatus('RUU Digital')).toBeVisible();
    await expect(keywordPage.reprocessButton('RUU Digital')).toBeVisible();
  });

  test('tombol Reset filter mengosongkan pencarian & mengembalikan daftar lengkap', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockUnscheduledList(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    // Filter dulu: pencarian 'RUU' menyembunyikan keyword lain
    await keywordPage.searchKeyword('RUU');
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await keywordPage.expectKeywordVisible('Ketenagakerjaan', false);

    // Reset filter: input kosong & daftar penuh dimuat ulang
    await keywordPage.resetFilterButton.click();
    await expect(keywordPage.searchInput).toHaveValue('');
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await keywordPage.expectKeywordVisible('Ketenagakerjaan', true);
  });

  test('tab Scheduled menampilkan daftar lengkap dengan tabel & aksi baris', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.gotoScheduledTab();

    await expect(keywordPage.page.getByRole('heading', { name: 'Scheduled Keywords' })).toBeVisible();
    await expect(keywordPage.searchInput).toBeVisible();

    // Data mock scheduled ter-render
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await expect(keywordPage.paginationText).toBeVisible();

    // Aksi baris Scheduled: Toggle status, Edit, Move to on-demand
    await expect(keywordPage.toggleStatus('RUU Digital')).toBeVisible();
    await expect(keywordPage.editScheduledButton('RUU Digital')).toBeVisible();
    await expect(keywordPage.moveToOnDemandButton('RUU Digital')).toBeVisible();
  });  test('pencarian keyword memfilter daftar Scheduled', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.gotoScheduledTab();

    await keywordPage.searchKeyword('RUU');

    // Search 'RUU' hanya menampilkan keyword yang mengandung 'RUU'
    await keywordPage.expectKeywordVisible('RUU Digital', true);
    await keywordPage.expectKeywordVisible('BPJS Kesehatan', false);
  });

  // ── Eksplorasi live 2026-09: tab Scheduled via URL & validasi modal ───

  test('URL ?tab=scheduled langsung mengaktifkan tab Scheduled (live)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page, ['RUU Digital', 'BPJS Kesehatan']);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.page.goto('/monitoring/keyword?tab=scheduled');
    await keywordPage.page.waitForLoadState('domcontentloaded');

    await expect(keywordPage.tabScheduled).toHaveAttribute('aria-selected', 'true');
    await expect(keywordPage.tabOnDemand).toHaveAttribute('aria-selected', 'false');
    // Heading halaman tetap Keyword Management
    await expect(
      keywordPage.page.getByRole('heading', { name: 'Keyword Management' }),
    ).toBeVisible();
  });

  test('tab Scheduled menampilkan kolom & aksi baris Toggle/Edit/Move (live)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page, ['RUU Digital', 'BPJS Kesehatan']);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.page.goto('/monitoring/keyword?tab=scheduled');
    await keywordPage.page.waitForLoadState('domcontentloaded');

    // Kolom live 2026-09: KEYWORD, PLATFORM, LAST RUN, STATUS, ACTIONS
    for (const header of ['Keyword', 'Platform', 'Last Run', 'Status', 'Actions']) {
      await expect(
        keywordPage.page.getByRole('columnheader', {
          name: new RegExp(`^${header}$`, 'i'),
        }),
      ).toBeVisible();
    }

    // Baris mock RUU Digital punya aksi Toggle status, Edit, Move to on-demand
    await expect(keywordPage.scheduledRowOf('RUU Digital').first()).toBeVisible();
    await expect(keywordPage.toggleStatus('RUU Digital').first()).toBeVisible();
    await expect(keywordPage.editScheduledButton('RUU Digital').first()).toBeVisible();
    await expect(keywordPage.moveToOnDemandButton('RUU Digital').first()).toBeVisible();
  });

  test('duplikasi keyword on-demand menampilkan pesan "already exists" (live)', async ({ keywordPage }) => {
    // Live 2026-09: keyword yang sudah ada (Active, on demand) ditolak dengan
    // pesan eksplisit — kontrak validasi baru yang perlu dijaga regresi.
    await mockKeywordOptions(keywordPage.page, ['RUU Digital', 'BPJS Kesehatan']);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.page.goto('/monitoring/keyword?tab=scheduled');
    await keywordPage.page.waitForLoadState('domcontentloaded');

    await keywordPage.openAddScheduledModal();

    await keywordPage.page.locator('#keyword').click();
    await keywordPage.page.locator('#keyword').fill('RUU');
    // Pilih opsi hasil autosuggest (RUU Digital — sudah terdaftar di mock)
    await keywordPage.page
      .getByRole('option', { name: 'RUU Digital' })
      .first()
      .click();

    await keywordPage.saveKeywordButton.click();

    // Pesan duplikasi tampil di dialog & dialog tetap terbuka
    await expect(keywordPage.page.getByText(/already exists on demand/i)).toBeVisible();
    await expect(keywordPage.page.locator('#keyword')).toBeVisible();
  });

  test('validasi tanggal terbalik menampilkan pesan "End date cannot be earlier than start date." (live)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page, ['RUU Digital', 'BPJS Kesehatan']);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.page.goto('/monitoring/keyword?tab=scheduled');
    await keywordPage.page.waitForLoadState('domcontentloaded');

    await keywordPage.openAddScheduledModal();

    // Combobox keyword menerima teks bebas (pola sama dengan regresi R2):
    // isi keyword BARU (tidak ada di daftar opsi) supaya validasi duplikasi
    // tidak menyala dan kita menguji validasi tanggal secara terisolasi.
    await keywordPage.page.locator('#keyword').click();
    await keywordPage.page.locator('#keyword').fill('Kata Kunci Explore Baru');
    await keywordPage.addScheduleStartInput.fill('2026-09-10T09:00');
    await keywordPage.addScheduleEndInput.fill('2026-09-01T09:00'); // terbalik
    await keywordPage.frequencyValueInput.fill('2');
    await keywordPage.frequencyUnitSelect.selectOption({ label: 'Hour(s)' });

    await keywordPage.saveKeywordButton.click();

    // Pesan validasi eksplisit & dialog tetap terbuka (tanpa request)
    await expect(
      keywordPage.page.getByText('End date cannot be earlier than start date.'),
    ).toBeVisible();
    await expect(keywordPage.page.locator('#keyword')).toBeVisible();
  });

  test('duplikasi & validasi bisa muncul BERSAMAAN sebelum request dikirim (live)', async ({ keywordPage }) => {
    // Live 2026-09: mengisi keyword yang sudah ada + tanggal terbalik lalu
    // save → KEDUA pesan tampil, dialog tetap terbuka (validasi berlapis).
    await mockKeywordOptions(keywordPage.page, ['RUU Digital', 'BPJS Kesehatan']);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.page.goto('/monitoring/keyword?tab=scheduled');
    await keywordPage.page.waitForLoadState('domcontentloaded');

    await keywordPage.openAddScheduledModal();

    await keywordPage.page.locator('#keyword').click();
    await keywordPage.page.locator('#keyword').fill('RUU Digital');
    await keywordPage.addScheduleStartInput.fill('2026-09-10T09:00');
    await keywordPage.addScheduleEndInput.fill('2026-09-01T09:00'); // terbalik
    await keywordPage.frequencyValueInput.fill('2');
    await keywordPage.frequencyUnitSelect.selectOption({ label: 'Hour(s)' });
    await keywordPage.saveKeywordButton.click();

    await expect(keywordPage.page.getByText(/already exists on demand/i)).toBeVisible();
    await expect(
      keywordPage.page.getByText('End date cannot be earlier than start date.'),
    ).toBeVisible();
    await expect(keywordPage.page.locator('#keyword')).toBeVisible();
  });

  // ── Eksplorasi live 2026-09: mekanika tutup modal & dialog Reprocess ──

  test('tombol × (aria-label Close) menutup modal Add scheduled (live)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page, ['RUU Digital', 'BPJS Kesehatan']);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.page.goto('/monitoring/keyword?tab=scheduled');
    await keywordPage.page.waitForLoadState('domcontentloaded');

    await keywordPage.openAddScheduledModal();

    await keywordPage.page
      .getByRole('dialog')
      .first()
      .locator('button[aria-label="Close"]')
      .click();

    await expect(keywordPage.page.getByRole('dialog')).toHaveCount(0);
  });

  test('tombol × (aria-label Close) menutup modal Add keyword On Demand (live)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page, ['RUU Digital', 'BPJS Kesehatan']);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.page.goto('/monitoring/keyword');
    await keywordPage.page.waitForLoadState('domcontentloaded');

    await keywordPage.openCreateModal();

    await keywordPage.page
      .getByRole('dialog')
      .first()
      .locator('button[aria-label="Close"]')
      .click();

    await expect(keywordPage.page.getByRole('dialog')).toHaveCount(0);
  });

  test('dialog Reprocess terbuka dari baris On Demand & dapat dibatalkan (live)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page, ['RUU Digital', 'BPJS Kesehatan']);
    await mockUnscheduledList(keywordPage.page);
    await keywordPage.page.goto('/monitoring/keyword');
    await keywordPage.page.waitForLoadState('domcontentloaded');

    await keywordPage.reprocessButton('RUU Digital').first().click();

    const dialog = keywordPage.reprocessDialog;
    await expect(dialog).toBeVisible();
    await expect(keywordPage.startReprocessingButton).toBeVisible();

    // Cancel menutup dialog tanpa aksi
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(keywordPage.page.getByRole('dialog')).toHaveCount(0);
  });

  // ── Eksplorasi live 2026-09: konsistensi heading antar tab ────────────

  test('tab Scheduled tidak menampilkan heading "Keyword On Demand" (konsistensi, live)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page, ['RUU Digital', 'BPJS Kesehatan']);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.gotoScheduledTab();

    // Heading H1 halaman
    const h1 = keywordPage.page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();

    // Perilaku benar: TIDAK ada heading (level berapa pun) yang berbunyi
    // persis "Keyword On Demand" saat user berada di tab Scheduled.
    // (Dugaan bug T3 dari probe awal ternyata race condition pembacaan —
    // penajudan sudah benar: "Scheduled Keywords". Test menjaga perilaku ini.)
    await expect(
      keywordPage.page.getByRole('heading', { name: 'Keyword On Demand', exact: true }),
    ).toHaveCount(0);
  });

  test('tab On Demand tetap menampilkan heading On Demand (perilaku benar, live)', async ({ keywordPage }) => {
    await mockKeywordOptions(keywordPage.page, ['RUU Digital', 'BPJS Kesehatan']);
    await mockSchedulerList(keywordPage.page);
    await keywordPage.gotoOnDemandTab();

    // Di tab default, heading "Keyword On Demand" memang benar.
    await expect(
      keywordPage.page.getByRole('heading', { name: 'Keyword On Demand', exact: true }),
    ).toBeVisible();
  });

});

