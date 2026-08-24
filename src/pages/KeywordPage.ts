import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Monitoring Keyword (/monitoring/keyword).
 * Dua tab: "Scheduled" (daftar keyword terjadwal) dan "On Demand"
 * (keyword sekali-jalan), masing-masing dengan filter & tabel.
 */
export class KeywordPage extends BasePage {
  readonly heading = this.page.getByRole('heading', { name: /Keyword (Management|Monitoring)/ });
  readonly tabScheduled = this.page.getByRole('tab', { name: 'Scheduled' });
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
  readonly createModal = this.page.getByRole('dialog', { name: 'Add keyword' });
  readonly unscKeywordInput = this.page.locator('#unsc-keyword');
  readonly startProcessButton = this.page.getByRole('button', { name: 'Start process' });
  // Date field muncul saat period = Custom — label berubah jadi "Start date"
  // & "End date" (bukan id #unsc-date-from/to; dicek 2026-08-14).
  readonly unscDateFromInput = this.createModal.getByRole('textbox', { name: 'Start date' });
  readonly unscDateToInput = this.createModal.getByRole('textbox', { name: 'End date' });

  // Modal Add (On Demand): Platform = LISTBOX dropdown (bukan checkbox) &
  // Period = <select> (bukan radio) — struktur berubah (dicek 2026-08-14).
  readonly unscPeriodSelect = this.createModal.locator('#unsc-period');
  readonly unscPlatformButton = this.createModal.getByRole('button', {
    name: /All platforms|Select platform/,
  });

  /**
   * Set pilihan platform di modal Add (On Demand) via listbox.
   * Buka dropdown, klik option yang beda state, lalu tutup (Escape).
   */
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

  /** Verifikasi pilihan platform di modal Add (On Demand) sesuai daftar. */
  async expectUnscPlatformsSelected(platforms: string[]) {
    await this.unscPlatformButton.click();
    for (const platform of platforms) {
      await expect(
        this.page.getByRole('option', { name: platform, exact: true })
      ).toHaveAttribute('aria-selected', 'true');
    }
    await this.page.keyboard.press('Escape');
  }

  /** Checkbox platform — dipakai modal Edit scheduled (Scheduled) & Move. */
  platformCheckbox(name: string) {
    return this.page.getByRole('checkbox', { name, exact: true });
  }

  // ---- Modal "Edit scheduled keyword" (tab Scheduled) ----
  readonly editModal = this.page.getByRole('dialog', { name: 'Edit scheduled keyword' });
  readonly editKeywordInput = this.page.locator('#edit-keyword');
  readonly saveChangesButton = this.page.getByRole('button', { name: 'Save changes' });

  // ---- Modal "Move to scheduled keyword" (tab On Demand) ----
  readonly moveModal = this.page.getByRole('dialog', { name: 'Move to scheduled keyword' });
  readonly moveKeywordInput = this.page.locator('#move-keyword');
  readonly moveFrequencySelect = this.page.locator('#move-frequency');
  readonly moveMaxPostsInput = this.page.locator('#move-max-posts');
  readonly moveSubmitButton = this.page.getByRole('button', { name: 'Move keyword' });

  movePlatformCheckbox(name: string) {
    return this.moveModal.getByRole('checkbox', { name, exact: true });
  }

  // ---- Aksi baris tabel tab On Demand ----

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

  moveButton(keyword: string) {
    return this.rowOf(keyword).getByRole('button', { name: `Move ${keyword} to scheduled keyword` });
  }

  /** Tombol menu aksi pada baris Scheduled (berisi opsi Edit / Activate). */
  actionMenuButton(keyword: string) {
    return this.page.getByRole('button', { name: `Action menu for ${keyword}` });
  }

  async goto() {
    await this.page.goto('/monitoring/keyword');
  }

  async gotoOnDemandTab() {
    await this.goto();
    await this.tabOnDemand.click();
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

  async expectTabSelected(tab: 'Scheduled' | 'On Demand') {
    const locator = tab === 'Scheduled' ? this.tabScheduled : this.tabOnDemand;
    await expect(locator).toHaveAttribute('aria-selected', 'true');
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
    await this.unscKeywordInput.fill(keyword);
  }

  async deselectAllPlatforms() {
    for (const platform of ['Twitter/X', 'Instagram', 'TikTok']) {
      const checkbox = this.platformCheckbox(platform);
      if (await checkbox.isChecked()) {
        await checkbox.click();
      }
    }
  }

  async submitCreate() {
    await this.startProcessButton.click();
  }

  async expectCreateModalOpen(open: boolean) {
    if (open) {
      await expect(this.createModal).toBeVisible();
    } else {
      await expect(this.createModal).toHaveCount(0);
    }
  }

  // ---- Aksi modal Edit scheduled keyword ----

  async openEditModal(keyword: string) {
    await this.actionMenuButton(keyword).click();
    await this.page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(this.editModal).toBeVisible();
  }

  async saveEdit() {
    await this.saveChangesButton.click();
  }

  async expectEditModalOpen(open: boolean) {
    if (open) {
      await expect(this.editModal).toBeVisible();
    } else {
      await expect(this.editModal).toHaveCount(0);
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
