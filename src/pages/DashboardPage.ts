import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

const PLATFORMS = ['Instagram', 'TikTok', 'Twitter/X'];

/**
 * POM halaman Dashboard (/monitoring/dashboard).
 * Berisi filter pencarian (keyword/platform/period), trending topic,
 * serta grid kartu hasil (protocol, KPI, chart, top performers).
 */
export class DashboardPage extends BasePage {
  readonly heading = this.page.getByRole('heading', { name: 'Dashboard Overview' });
  readonly enterFullscreenButton = this.page.getByRole('button', { name: 'Enter fullscreen' });
  readonly exitFullscreenButton = this.page.getByRole('button', { name: 'Exit fullscreen' });
  readonly trendingHeading = this.page.getByRole('heading', { name: 'Trending topic' });
  readonly period24hButton = this.page.getByRole('button', { name: '24 Hours' });
  readonly period7dButton = this.page.getByRole('button', { name: '7 Days' });
  readonly searchFiltersHeading = this.page.getByRole('heading', { name: 'Search filters' });
  readonly applyFilterButton = this.page.getByRole('button', { name: 'Apply filter' });
  readonly resetFiltersButton = this.page.getByRole('button', { name: 'Reset filters' });
  readonly keywordInput = this.page.getByRole('combobox', { name: 'Keyword' });
  readonly clearKeywordButton = this.page.getByRole('button', { name: 'Clear selection' });
  readonly platformButton = this.page.getByRole('button', { name: /Platform/ });
  readonly noSearchYet = this.page.getByText('No search yet');
  readonly conversationSummaryHeading = this.page.getByRole('heading', { name: 'Conversation summary' });
  readonly sentimentGroupHeading = this.page.getByRole('heading', { name: 'Sentiment & Emotion Analysis' });
  readonly contentGroupHeading = this.page.getByRole('heading', { name: 'Content Intelligence' });
  readonly topPerformersHeading = this.page.getByRole('heading', { name: 'Top Performers' });

  // Kartu Top Posts (table dari API BE — GET /v1/dashboard/top-posts)
  readonly topPostsHeading = this.page.getByRole('heading', { name: 'Top posts' });
  readonly topPostsTable = this.page.locator('table');
  readonly viewAllButton = this.page.getByRole('button', { name: 'View all →' });

  // Kartu Top Accounts (daftar dari API BE — GET /v1/dashboard/top-accounts)
  readonly topAccountsHeading = this.page.getByRole('heading', { name: 'Top accounts' });

  // Kartu Top Hashtags (daftar dari API BE — GET /v1/dashboard/top-hashtags)
  readonly topHashtagsHeading = this.page.getByRole('heading', { name: 'Top hashtags' });

  // Kartu Topic Intelligence (chart dari API BE — GET /v1/dashboard/topic-intelligence)
  readonly topicIntelligenceHeading = this.page.getByRole('heading', { name: 'Topic intelligence' });

  // Kartu KPI (data dari API BE — GET /v1/dashboard/summary)
  // Struktur DOM: satu <article> per metrik berisi label + nilai.
  readonly totalPostCard = this.page.locator('article').filter({ hasText: 'Total post' }).first();
  readonly totalEngagementCard = this.page.locator('article').filter({ hasText: 'Total engagement' }).first();
  readonly viewsCard = this.page.locator('article').filter({ hasText: 'Views' }).first();
  readonly engagementRateCard = this.page.locator('article').filter({ hasText: 'Engagement rate' }).first();
  readonly activePlatformsCard = this.page.locator('article').filter({ hasText: 'Active platforms' }).first();

  async goto() {
    await this.page.goto('/monitoring/dashboard');
  }

  /** Pilih keyword dari combobox (ketik lalu klik opsi). */
  async selectKeyword(keyword: string) {
    await this.keywordInput.click();
    await this.keywordInput.fill(keyword);
    await this.page.getByRole('option', { name: keyword, exact: true }).click();
  }

  /** Kosongkan pilihan keyword lewat tombol "Clear selection". */
  async clearKeyword() {
    await expect(this.clearKeywordButton).toBeVisible();
    await this.clearKeywordButton.click();
  }

  /** Hapus semua platform terpilih dari multiselect. */
  async deselectAllPlatforms() {
    await this.platformButton.click();
    for (const platform of PLATFORMS) {
      const option = this.page.getByRole('option', { name: platform, exact: true });
      // Cek berbagai kemungkinan atribut selected (aria-selected, data-selected, selected)
      const isSelected = await option.evaluate((el) => {
        return el.getAttribute('aria-selected') === 'true'
          || el.hasAttribute('selected')
          || el.getAttribute('data-selected') === 'true'
          || el.classList.contains('selected')
          || el.closest('[aria-selected="true"]') !== null;
      }).catch(() => false);
      if (isSelected) {
        await option.click();
      }
    }
    // Tutup dropdown (klik di luar)
    await this.page.keyboard.press('Escape');
  }

  async applyFilter() {
    await this.applyFilterButton.click();
  }

  async resetFilters() {
    await this.resetFiltersButton.click();
  }

  // ---- Ekspektasi siap pakai ----

  async expectNoSearchYet() {
    await expect(this.noSearchYet).toBeVisible();
  }

  async expectKeywordRequiredError() {
    await expect(this.page.getByText('Keyword is required.')).toBeVisible();
  }

  async expectPlatformRequiredError() {
    await expect(this.page.getByText('Select at least one platform.')).toBeVisible();
  }

  async expectResultsRendered() {
    await expect(this.conversationSummaryHeading).toBeVisible();
    await expect(this.sentimentGroupHeading).toBeVisible();
    await expect(this.contentGroupHeading).toBeVisible();
  }

  /** Data dari mock API benar-benar ter-render (bukti integrasi UI↔API). */
  async expectTextVisible(text: string) {
    await expect(this.page.getByText(text, { exact: true })).toBeVisible();
  }
}
