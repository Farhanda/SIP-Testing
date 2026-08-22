import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM untuk halaman Display Wall (/display/*).
 *
 * Display wall adalah tampilan full-screen tanpa navbar utama,
 * digunakan untuk presentasi/monitoring. Setiap wall memiliki:
 * - Keyword heading (h1)
 * - Auto-refresh countdown button
 * - SIP Insight branding link
 * - Chart/visualisasi data
 */
export class DisplayWallPage extends BasePage {
  /** Keyword heading (h1) — nama keyword yang sedang ditampilkan. */
  readonly keywordHeading = this.page.locator('h1').first();

  /** Auto-refresh countdown button (mis. "20 seconds"). */
  readonly refreshCountdown = this.page.locator('button').filter({ hasText: /seconds?/i }).first();

  /** SIP Insight branding link. */
  readonly sipInsightLink = this.page.getByRole('link', { name: 'SIP Insight' });

  /** All SVG chart elements on the page. */
  readonly charts = this.page.locator('svg');

  /** All links on the page. */
  readonly links = this.page.locator('a[href]');

  /** All images on the page. */
  readonly images = this.page.locator('img');

  /** All list items on the page. */
  readonly listItems = this.page.locator('li');

  // ── Conversation Overview specific ──────────────────────────────────

  /** Conversation trend chart area. */
  readonly conversationTrendChart = this.page.locator('svg').first();

  // ── Top Engagement specific ─────────────────────────────────────────

  /** All post links (links to TikTok/Instagram/etc). */
  readonly postLinks = this.page.locator('a[href*="tiktok"], a[href*="instagram"]');

  /** Hashtag list area. */
  readonly hashtagArea = this.page.locator('[class*=hashtag], [class*=tag]');

  // ── Shared assertions ───────────────────────────────────────────────

  async expectKeywordVisible(keyword: string) {
    await expect(this.keywordHeading).toContainText(keyword);
  }

  async expectRefreshButtonVisible() {
    await expect(this.refreshCountdown).toBeVisible();
  }

  async expectSipInsightLink() {
    await expect(this.sipInsightLink).toBeVisible();
  }

  async expectChartsVisible(minCount: number = 1) {
    const count = await this.charts.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  async expectPageTitle(titlePart: string) {
    await expect(this.page).toHaveTitle(new RegExp(titlePart, 'i'));
  }
}
