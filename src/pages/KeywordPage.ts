import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Monitoring Keyword (/monitoring/keyword).
 * UI saat ini (2026-08) hanya memiliki SATU tab: "On Demand" — tab
 * "Scheduled" dan aksi Move-to-scheduled / Edit-scheduled sudah dihapus
 * dari aplikasi. Aksi baris yang tersedia: Toggle status, View detail,
 * Reprocess.
 */
export class KeywordPage extends BasePage {
  readonly heading = this.page.getByRole('heading', { name: /Keyword (Management|Monitoring)/ });
  readonly tabOnDemand = this.page.getByRole('tab', { name: 'On Demand' });
  readonly searchInput = this.page.getByPlaceholder('Search keyword');
  readonly applyFilterButton = this.page.getByRole('button', { name: 'Apply filter' });
  readonly resetFilterButton = this.page.getByRole('button', { name: 'Reset filter' });
  readonly paginationText = this.page.getByText(/Page \d+ of \d+/);
  readonly emptyState = this.page.getByText('No keywords match your search/filter.');

  // Locate select berdasarkan option-nya (bukan indeks DOM) supaya tetap
  // benar di tab Scheduled maupun On Demand (pagination juga punya <select>).
  private selectWithOption(label: string) {
    return this.page
      .locator('select')
      .filter({ has: this.page.locator('option').filter({ hasText: label }) });
  }

  readonly statusSelect = this.selectWithOption('All statuses');
  readonly platformSelect = this.selectWithOption('All platforms');

  // ---- Modal "Add keyword" (tab On Demand) ----
  readonly addKeywordButton = this.page.getByRole('button', { name: '+ Add keyword' });
  readonly createModal = this.page.getByRole('dialog', { name: 'Add keyword', exact: true });
  readonly unscKeywordInput = this.createModal.getByRole('combobox', { name: 'Keyword' });
  readonly startProcessButton = this.page.getByRole('button', { name: 'Start process' });
  // Date field muncul saat period = Custom range — render di popup period,
  // BUKAN di dalam dialog modal (dicek 2026-08-31).
  readonly unscDateFromInput = this.page.getByRole('textbox', { name: 'Start date' });
  readonly unscDateToInput = this.page.getByRole('textbox', { name: 'End date' });

  // Modal Add: Period kini berupa button (HeadlessUI Listbox), bukan <select>.
  // Untuk memilih opsi: klik button → pilih option di listbox.
  readonly unscPeriodButton = this.createModal.locator('#unsc-period');
  readonly unscPlatformButton = this.createModal.getByRole('button', {
    name: /All platforms|Select platform/,
  });

  /**
   * Set pilihan platform di modal Add (On Demand) via listbox.
   * Buka dropdown, klik option yang beda state, lalu tutup (Escape).
   */
  /** Set pilihan period di modal Add (On Demand) — period berupa tombol-tombol.
   *  Klik button period → popup muncul → pilih tombol dengan label yang sesuai.
   *  Daftar opsi: 24 Hours, 3 Days, 7 Days, 1 Month, Custom range. */
  async setUnscPeriod(option: string) {
    await this.unscPeriodButton.click();
    // Tunggu popup period muncul (render di luar dialog)
    const popup = this.page.locator('button[aria-expanded="true"]').first();
    await popup.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    // Cari tombol dengan teks yang mengandung `option` (case-insensitive)
    const btn = this.page.getByRole('button', { name: new RegExp(option, 'i') });
    await btn.click();
  }

  async setUnscPlatforms(selected: string[]) {
    await this.unscPlatformButton.click();
    for (const platform of ['Instagram', 'TikTok', 'Twitter/X']) {
      const option = this.page.getByRole('option', { name: platform, exact: true });
      const isSelected = (await option.getAttribute('aria-selected')) === 'true';
      if (isSelected !== selected.includes(platform)) {
        await option.click();
      }
    }
    await this.page.keyboard.press('Escape');
  }

  /** Verifikasi SEMUA opsi platform yang dirender listbox terpilih.
   *  ⚠️ Daftar opsi kini DINAMIS (deploy 2026-08 bisa hanya subset platform),
   *  jadi assertion struktural: minimal 1 opsi & semuanya selected. */
  async expectUnscPlatformsAllSelected() {
    // Scope ke dalam [role=listbox] — getByRole('option') global ikut
    // mencocokkan <option> native milik select filter yang tersembunyi.
    const firstOption = this.page.locator('[role="listbox"] [role="option"]').first();
    for (let i = 0; i < 3 && !(await firstOption.isVisible().catch(() => false)); i++) {
      await this.unscPlatformButton.click();
      await firstOption.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    }
    const options = this.page.locator('[role="listbox"] [role="option"]');
    await expect(firstOption).toBeVisible();
    const total = await options.count();
    expect(total).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < total; i++) {
      await expect(options.nth(i)).toHaveAttribute('aria-selected', 'true');
    }
    await this.page.keyboard.press('Escape');
  }


  // ---- Aksi baris tabel (On Demand) ----

  /** Baris tabel yang memuat teks `keyword` (dipakai untuk men-scope aksi). */
  rowOf(keyword: string) {
    return this.page.getByRole('row').filter({ hasText: keyword });
  }

  /** Tombol Reprocess pada baris On Demand — membuka dialog Reprocess keyword. */
  reprocessButton(keyword: string) {
    return this.rowOf(keyword).getByRole('button', { name: `Reprocess ${keyword}` });
  }

  // Dialog Reprocess keyword (dibuka lewat tombol Reprocess)
  readonly reprocessDialog = this.page.getByRole('dialog', { name: 'Reprocess keyword' });
  readonly reprocessKeywordInput = this.reprocessDialog.getByRole('combobox', { name: 'Keyword' });
  readonly startReprocessingButton = this.reprocessDialog.getByRole('button', { name: 'Start reprocessing' });

  /** Link "View detail" menuju halaman detail unscheduled. */
  viewDetailLink(keyword: string) {
    return this.rowOf(keyword).getByRole('link', { name: `View detail for ${keyword}` });
  }

  /** Switch Toggle status pada baris On Demand. */
  toggleStatus(keyword: string) {
    return this.rowOf(keyword).getByRole('switch', { name: `Toggle status for ${keyword}` });
  }

  async goto() {
    await this.page.goto('/monitoring/keyword');
  }

  /** Default landing = tab On Demand (satu-satunya tab di UI saat ini). */
  async gotoOnDemandTab() {
    await this.goto();
    await this.tabOnDemand.click();
    await expect(this.tabOnDemand).toHaveAttribute('aria-selected', 'true');
  }

  async selectStatus(value: string) {
    await this.statusSelect.selectOption(value);
  }

  async selectPlatform(value: string) {
    // Opsi memakai value slug (instagram/tiktok/twitter_x) dengan label bebas
    await this.platformSelect.selectOption({ label: value });
  }

  async searchKeyword(keyword: string) {
    await this.searchInput.fill(keyword);
    await this.applyFilterButton.click();
  }

  async applyFilters() {
    await this.applyFilterButton.click();
  }

  async expectOnDemandTabSelected() {
    await expect(this.tabOnDemand).toHaveAttribute('aria-selected', 'true');
  }

  /** Assert sebuah keyword tampil / tidak tampil di tabel. */
  async expectKeywordVisible(keyword: string, visible: boolean) {
    const row = this.page.getByRole('row').filter({ hasText: keyword });
    if (visible) {
      await expect(row).toBeVisible();
    } else {
      await expect(row).toHaveCount(0);
    }
  }

  async expectColumnHeader(name: string) {
    await expect(this.page.getByRole('columnheader', { name, exact: true })).toBeVisible();
  }

  // ---- Aksi modal Add keyword ----

  async openCreateModal() {
    await this.addKeywordButton.click();
    await expect(this.createModal).toBeVisible();
  }

  async fillUnscKeyword(keyword: string) {
    await this.unscKeywordInput.click();
    await this.unscKeywordInput.fill(keyword);
  }

  async submitCreate() {
    await this.startProcessButton.click();
    // UI baru: muncul dialog konfirmasi "Add keyword?" — klik Start process lagi
    const confirmBtn = this.page.getByRole('dialog').last().getByRole('button', { name: 'Start process' });
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }
  }

  async expectCreateModalOpen(open: boolean) {
    if (open) {
      await expect(this.createModal).toBeVisible();
    } else {
      await expect(this.createModal).toHaveCount(0);
    }
  }

  async expectToast(message: string, visible: boolean) {
    const toast = this.page.getByText(message, { exact: true });
    if (visible) {
      await expect(toast).toBeVisible();
    } else {
      await expect(toast).toHaveCount(0);
    }
  }
}
