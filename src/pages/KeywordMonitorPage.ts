import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Data Collection Monitor (/data-system/keyword-monitor).
 * Menampilkan ringkasan KPI koleksi data, tabel status multi-platform
 * (Instagram, TikTok, Twitter/X), accordion detail per baris keyword
 * (kartu metrik per platform, perbandingan vs previous run, bar chart
 * 5 run terakhir), serta dialog "View keyword settings" (Edit keyword).
 */
export class KeywordMonitorPage extends BasePage {
  readonly path = '/data-system/keyword-monitor';

  // Heading & Subtitle
  readonly pageTitle = this.page.getByText('Data Collection Monitor');
  readonly subtitle = this.page.getByText('Track scheduled keyword data collection by platform');
  readonly addKeywordButton = this.page.getByRole('button', { name: /Add Keyword/i });

  // Summary KPI Cards
  readonly cardTotalKeywords = this.page.locator('div').filter({ hasText: 'Total Keywords' }).filter({ hasText: 'Scheduler active' }).first();
  readonly cardCompletedJobs = this.page.locator('div').filter({ hasText: 'Completed Jobs Today' }).filter({ hasText: 'scheduled today' }).first();
  readonly cardFailedCancelled = this.page.locator('div').filter({ hasText: 'Failed / Cancelled' }).filter({ hasText: 'Across all scheduled keywords' }).first();
  readonly cardCurrentlyRunning = this.page.locator('div').filter({ hasText: 'Currently Running' }).filter({ hasText: 'of total' }).first();

  // Filters & Search
  readonly searchInput = this.page.getByPlaceholder(/Search keyword/i);
  readonly statusSelect = this.page.locator('select').filter({ has: this.page.locator('option').filter({ hasText: 'All statuses' }) });
  readonly platformSelect = this.page.locator('select').filter({ has: this.page.locator('option').filter({ hasText: 'All platforms' }) });
  readonly resetFilterButton = this.page.getByRole('button', { name: /Reset filter/i });

  // Table container & rows
  readonly tableContainer = this.page.locator('div.overflow-x-auto');
  readonly keywordRows = this.page.locator('span.font-semibold.text-ink-900');

  // Dialog Edit Keyword ("View keyword settings")
  readonly editKeywordDialog = this.page.locator('[role="dialog"]').filter({ hasText: 'Edit keyword' });
  readonly dialogCloseButton = this.editKeywordDialog.getByRole('button', { name: '×' });
  readonly dialogCancelButton = this.editKeywordDialog.getByRole('button', { name: 'Cancel' });
  readonly dialogSaveButton = this.editKeywordDialog.getByRole('button', { name: 'Save changes' });

  // Pagination
  readonly paginationInfo = this.page.getByText(/Page \d+ of \d+/);
  readonly pageSizeSelect = this.page.locator('select').filter({ has: this.page.locator('option').filter({ hasText: '10' }) });

  async navigate(): Promise<void> {
    await this.page.goto(this.path, { waitUntil: 'domcontentloaded' });
    await expect(this.pageTitle).toBeVisible({ timeout: 15000 });
  }

  /**
   * Mengambil Locator baris keyword tertentu berdasarkan nama keyword.
   */
  getKeywordRow(keyword: string): Locator {
    return this.page.locator('div').filter({ has: this.page.locator(`span.font-semibold:has-text("${keyword}")`) }).first();
  }

  /**
   * Mengklik baris keyword untuk membuka atau menutup accordion detail.
   */
  async toggleKeywordAccordion(keyword: string): Promise<void> {
    const keywordSpan = this.page.locator('span.font-semibold.text-ink-900').filter({ hasText: keyword }).first();
    await expect(keywordSpan).toBeVisible({ timeout: 10000 });
    await keywordSpan.click();
  }

  /**
   * Mendapatkan container accordion panel yang sedang terbuka.
   */
  getExpandedPanel(): Locator {
    return this.page.locator('div').filter({ has: this.page.getByRole('button', { name: /View keyword settings/i }) }).first();
  }

  /**
   * Mendapatkan kartu platform di dalam expanded accordion.
   * platform: 'instagram' | 'tiktok' | 'x' | 'twitter'
   */
  getExpandedPlatformCard(platformName: string): Locator {
    return this.page
      .locator('div.rounded-2xl.p-3\\.5, div.rounded-2xl.p-3')
      .filter({ hasText: new RegExp(platformName, 'i') })
      .first();
  }

  /**
   * Klik tombol "View keyword settings" di accordion yang terbuka.
   */
  async openKeywordSettings(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /View keyword settings/i });
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();
    await expect(this.editKeywordDialog).toBeVisible({ timeout: 5000 });
  }

  /**
   * Mengambil angka dari KPI card summary.
   */
  async getKpiValue(card: Locator): Promise<number> {
    const text = await card.innerText();
    const match = text.match(/\b\d+\b/);
    return match ? parseInt(match[0], 10) : 0;
  }
}
