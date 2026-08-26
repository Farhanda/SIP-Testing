import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Provider Management (/administration/provider).
 * Daftar provider scraping per platform (konsumsi BE langsung:
 * GET /v1/scrape/credential) dengan filter keyword/platform/enabled,
 * toggle enable/disable per baris, dan modal "+ Add provider".
 */
export class ProviderPage extends BasePage {
  readonly heading = this.page.getByRole('heading', { name: 'Provider Management' });
  readonly addButton = this.page.getByRole('button', { name: '+ Add provider' });
  readonly searchInput = this.page.getByLabel('Search providers');
  readonly platformSelect = this.page.locator('#providerFilterPlatform');
  readonly enabledSelect = this.page.locator('#providerFilterEnabled');
  readonly applyFilterButton = this.page.getByRole('button', { name: 'Apply filter' });
  readonly resetFilterButton = this.page.getByRole('button', { name: 'Reset filter' });
  // UI memakai singular ("Showing 1-5 of 5 provider") — regex menangkap dua-duanya.
  readonly showingText = this.page.getByText(/Showing \d+-\d+ of \d+ provider/i);

  // ---- Modal "Add provider" ----
  readonly modal = this.page.getByRole('dialog').filter({ has: this.page.getByRole('heading', { name: 'Add provider' }) });
  readonly editModal = this.page.getByRole('dialog').filter({ has: this.page.getByRole('heading', { name: 'Edit provider' }) });
  readonly editNameInput = this.editModal.locator('#name');
  readonly modalNameInput = this.modal.locator('#name');
  readonly modalPlatformInput = this.modal.getByPlaceholder('Select platform');
  readonly modalSecretInput = this.modal.locator('#secret');
  readonly modalPriorityInput = this.modal.locator('#priority');
  readonly modalReqPerSecondInput = this.modal.locator('#reqPerSecond');
  readonly modalReqPerMonthInput = this.modal.locator('#reqPerMonth');
  readonly modalSaveButton = this.modal.getByRole('button', { name: 'Save' });

  async goto() {
    await this.page.goto('/administration/provider');
  }

  /** Baris tabel yang memuat provider `name`. */
  rowOf(name: string) {
    return this.page.getByRole('row').filter({ hasText: name });
  }

  /** Switch enable/disable pada baris provider (aria-label dari aplikasi). */
  toggleOf(name: string) {
    return this.rowOf(name).getByRole('switch', { name: `Toggle enabled for ${name}` });
  }

  editButton(name: string) {
    return this.rowOf(name).getByRole('button', { name: `Edit provider ${name}` });
  }

  async expectColumnHeader(name: string) {
    await expect(this.page.getByRole('columnheader', { name, exact: true })).toBeVisible();
  }

  async expectProviderVisible(name: string, visible: boolean) {
    const row = this.rowOf(name);
    if (visible) {
      await expect(row).toBeVisible();
    } else {
      await expect(row).toHaveCount(0);
    }
  }

  async selectPlatform(value: string) {
    await this.platformSelect.selectOption(value);
    await this.applyFilterButton.click();
  }

  async selectEnabled(value: string) {
    await this.enabledSelect.selectOption(value);
    await this.applyFilterButton.click();
  }

  async searchProviders(keyword: string) {
    await this.searchInput.fill(keyword);
    await this.applyFilterButton.click();
  }

  async resetFilters() {
    await this.resetFilterButton.click();
  }

  async openCreateModal() {
    await this.addButton.click();
    await this.expectModalOpen(true);
  }

  /** Pilih platform di combobox modal (HeadlessUI — ketik lalu Enter). */
  async choosePlatform(label: string) {
    await this.modalPlatformInput.click();
    await this.modalPlatformInput.fill(label);
    await this.modalPlatformInput.press('Enter');
  }

  async submitCreate() {
    await this.modalSaveButton.click();
  }

  async expectModalOpen(open: boolean) {
    if (open) {
      await expect(this.modal).toBeVisible();
    } else {
      await expect(this.modal).toHaveCount(0);
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
