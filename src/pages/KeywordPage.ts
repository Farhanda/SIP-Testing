import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Monitoring Keyword (/monitoring/keyword).
 * UI deploy 2026-09 menghidupkan kembali fitur scheduled: ada DUA tab
 * ("On Demand" default & "Scheduled"). Aksi baris On Demand: Toggle
 * status, Reprocess, Move-to-scheduled. Aksi baris Scheduled: Toggle,
 * Edit, Move-to-on-demand. Modal Add On Demand memakai checkbox platform
 * (selector period sudah dihapus); dialog jadwal (Add/Move/Edit scheduled)
 * memakai start/end datetime + frequency.
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

  // Modal Add On Demand (deploy 2026-09): pilihan platform kini CHECKBOX group
  // (Instagram/TikTok/Twitter-X, semua checked secara default) — bukan lagi
  // dropdown listbox, dan selector period sudah dihapus dari modal ini.
  unscPlatformCheckbox(name: string) {
    return this.createModal.getByRole('checkbox', { name, exact: true });
  }

  /** Set pilihan platform di modal Add (On Demand) via checkbox. */
  async setUnscPlatforms(selected: string[]) {
    for (const platform of ['Instagram', 'TikTok', 'Twitter/X']) {
      const checkbox = this.unscPlatformCheckbox(platform);
      const isChecked = await checkbox.isChecked().catch(() => false);
      if (isChecked !== selected.includes(platform)) {
        await checkbox.click();
      }
    }
  }

  /** Verifikasi SEMUA checkbox platform terpilih (nilai default modal Add).
   *  Assertion struktural: minimal 1 checkbox & semuanya checked. */
  async expectUnscPlatformsAllSelected() {
    const checkboxes = this.createModal.locator('input[type="checkbox"]');
    const total = await checkboxes.count();
    expect(total).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < total; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }
  }

  // ---------------------------------------------------------------------------
  // Tab Scheduled (kembali aktif di deploy 2026-09) & dialog-dialog jadwal
  // ---------------------------------------------------------------------------
  readonly tabScheduled = this.page.getByRole('tab', { name: 'Scheduled' });

  /** Baris tabel Scheduled yang memuat teks `keyword`. */
  scheduledRowOf(keyword: string) {
    return this.page.getByRole('row').filter({ hasText: keyword });
  }

  editScheduledButton(keyword: string) {
    return this.scheduledRowOf(keyword).getByRole('button', { name: `Edit ${keyword}` });
  }

  moveToOnDemandButton(keyword: string) {
    return this.scheduledRowOf(keyword).getByRole('button', { name: `Move ${keyword} to on-demand keyword` });
  }

  moveToScheduledButton(keyword: string) {
    return this.rowOf(keyword).getByRole('button', { name: `Move ${keyword} to scheduled keyword` });
  }

  // Dialog jadwal (Add scheduled / Move to scheduled / Edit scheduled) punya
  // struktur yang sama: keyword combobox + checkbox platform + start/end
  // datetime-local + frequency value/unit. Field di-scope per id unik.
  readonly addScheduleStartInput = this.page.locator('#add-schedule-start-at');
  readonly addScheduleEndInput = this.page.locator('#add-schedule-end-at');
  readonly moveScheduleStartInput = this.page.locator('#move-schedule-start-at');
  readonly moveScheduleEndInput = this.page.locator('#move-schedule-end-at');
  readonly editScheduleStartInput = this.page.locator('#edit-schedule-start-at');
  readonly editScheduleEndInput = this.page.locator('#edit-schedule-end-at');
  readonly editKeywordInput = this.page.locator('#edit-keyword');
  readonly frequencyValueInput = this.page.getByLabel('Frequency value');
  readonly frequencyUnitSelect = this.page.getByLabel('Frequency unit');
  readonly saveKeywordButton = this.page.getByRole('button', { name: 'Save keyword' });
  readonly moveKeywordButton = this.page.getByRole('button', { name: 'Move keyword' });
  readonly saveChangesButton = this.page.getByRole('button', { name: 'Save changes' });

  /** Buka modal Add scheduled (tab Scheduled → tombol "+ Add keyword"). */
  async openAddScheduledModal() {
    await this.addKeywordButton.click();
    await expect(this.page.locator('#keyword')).toBeVisible();
  }

  async gotoScheduledTab() {
    await this.goto();
    await this.tabScheduled.click();
    await expect(this.tabScheduled).toHaveAttribute('aria-selected', 'true');
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

  /**
   * Link "View detail" menuju halaman detail unscheduled.
   * ⚠️ Catatan probe 2026-09-04: UI live saat ini TIDAK merender link ini di
   * baris On Demand (aksi baris hanya Toggle/Reprocess/Move-to-scheduled),
   * dan halaman detail /monitoring/keyword/unscheduled/:id tidak dapat
   * diakses dari daftar. Helper dipertahankan untuk saat fitur kembali.
   */
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
