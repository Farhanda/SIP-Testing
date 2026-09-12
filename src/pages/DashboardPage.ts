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
  readonly exportReportButton = this.page.getByRole('button', { name: 'Export report' });
  readonly enterFullscreenButton = this.page.getByRole('button', { name: 'Enter fullscreen' });
  readonly exitFullscreenButton = this.page.getByRole('button', { name: 'Exit fullscreen' });
  readonly trendingHeading = this.page.getByRole('heading', { name: 'Trending topic' });
  readonly period24hButton = this.page.getByRole('button', { name: '24 Hours' });
  readonly period7dButton = this.page.getByRole('button', { name: '7 Days' });
  readonly searchFiltersHeading = this.page.getByRole('heading', { name: 'Search filters' });
  readonly periodButton = this.page.getByRole('button', { name: 'Period' });
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
  // Modal drill-down detail per jam (hourly detail dari conversation-trend & sentiment-trend)
  readonly trendModal = this.page.getByRole('dialog');
  readonly trendModalHeading = this.trendModal.getByRole('heading');
  readonly trendModalCloseButton = this.trendModal.getByRole('button', { name: /close|×/i });

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

  /** Hapus semua platform terpilih.
   *  ⚠️ Listbox baru (2026-08) MENUTUP popover setelah satu opsi diklik —
   *  jadi tiap iterasi: buka popover → klik SATU opsi yang masih selected
   *  → ulangi hingga tidak ada lagi yang selected. */
  async deselectAllPlatforms() {
    const selectedOption = this.page.locator('[role="option"][aria-selected="true"]').first();

    for (let attempt = 0; attempt < 6; attempt++) {
      await this.platformButton.click();
      const isOpen = await selectedOption
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false);

      if (!isOpen) {
        // Tidak ada opsi terpilih tersisa — tutup popover & selesai
        await this.page.keyboard.press('Escape');
        return;
      }

      // Klik dengan timeout pendek: popover bisa tertutup/di-render ulang
      // di antara waitFor & click (race) — bawaan click menunggu sampai
      // timeout test penuh. Gagal → tutup popover & ulangi iterasi.
      const clicked = await selectedOption
        .click({ timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      if (!clicked) {
        await this.page.keyboard.press('Escape').catch(() => {});
        continue;
      }
      // Tunggu popover menutup sebelum iterasi berikutnya membuka ulang
      await selectedOption.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
    // Jaring pengaman: pastikan popover tertutup di akhir
    await this.page.keyboard.press('Escape').catch(() => {});
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
    await expect(this.conversationSummaryHeading).toBeVisible({ timeout: 30_000 });
    await expect(this.sentimentGroupHeading).toBeVisible({ timeout: 30_000 });
    await expect(this.contentGroupHeading).toBeVisible({ timeout: 30_000 });
  }

  /** Data dari mock API benar-benar ter-render (bukti integrasi UI↔API). */
  async expectTextVisible(text: string) {
    await expect(this.page.getByText(text, { exact: true })).toBeVisible();
  }

  /**
   * Buka modal drill-down hourly untuk Conversation Trend berdasarkan indeks titik tanggal.
   */
  async openConversationTrendHourly(pointIndex = 0) {
    await this.page.evaluate((idx) => {
      const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .find((h) => /conversation trend/i.test(h.textContent || ''));
      const card = heading?.closest('article, section, div.border, div.rounded');
      const canvas = card?.querySelector('canvas');
      if (!canvas) throw new Error('Canvas Conversation Trend tidak ditemukan');

      const fiberKey = Object.keys(canvas).find((k) => k.startsWith('__reactFiber'));
      let curr = fiberKey ? (canvas as any)[fiberKey] : null;
      while (curr) {
        if (curr.memoizedProps?.options?.onClick) {
          curr.memoizedProps.options.onClick({}, [{ index: idx, datasetIndex: 0 }]);
          return;
        }
        curr = curr.return;
      }
      throw new Error('Handler onClick pada chart Conversation Trend tidak ditemukan');
    }, pointIndex);
  }

  /**
   * Buka modal drill-down hourly untuk Sentiment Trend berdasarkan indeks titik tanggal.
   */
  async openSentimentTrendHourly(pointIndex = 0) {
    await this.page.evaluate((idx) => {
      const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .find((h) => /sentiment trend/i.test(h.textContent || ''));
      const card = heading?.closest('article, section, div.border, div.rounded');
      const canvas = card?.querySelector('canvas');
      if (!canvas) throw new Error('Canvas Sentiment Trend tidak ditemukan');

      const fiberKey = Object.keys(canvas).find((k) => k.startsWith('__reactFiber'));
      let curr = fiberKey ? (canvas as any)[fiberKey] : null;
      while (curr) {
        if (curr.memoizedProps?.options?.onClick) {
          curr.memoizedProps.options.onClick({}, [{ index: idx, datasetIndex: 0 }]);
          return;
        }
        curr = curr.return;
      }
      throw new Error('Handler onClick pada chart Sentiment Trend tidak ditemukan');
    }, pointIndex);
  }

  /**
   * Tutup modal detail trend per jam.
   */
  async closeTrendModal() {
    await expect(this.trendModal).toBeVisible();
    await this.trendModalCloseButton.click();
    await expect(this.trendModal).toBeHidden();
  }
}
