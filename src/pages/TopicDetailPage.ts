import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Topic Detail (/monitoring/dashboard/topic/:topic).
 * Menampilkan detail topik tertentu — heading nama topik, chart emotion,
 * daftar post yang terkait, dan pagination.
 */
export class TopicDetailPage extends BasePage {
  readonly topicHeading = this.page.locator('h1').first();
  readonly postListHeading = this.page.getByRole('heading', { name: 'Post list' });
  readonly postRows = this.page.locator('table tbody tr');
  readonly tableHeaders = this.page.locator('table th');
  readonly paginationPrev = this.page.getByRole('button', { name: '‹' });
  readonly paginationNext = this.page.getByRole('button', { name: '›' });
  readonly applyFilterButton = this.page.getByRole('button', { name: 'Apply filter' });
  readonly resetFiltersButton = this.page.getByRole('button', { name: 'Reset filter' });
  readonly backToDashboardLink = this.page.getByRole('link', { name: 'Dashboard' });
  readonly topicIntelligenceLink = this.page.getByRole('link', { name: 'Topic intelligence' });

  async goto(topic: string, keyword: string = 'RUU Digital') {
    await this.page.goto(`/monitoring/dashboard/topic/${encodeURIComponent(topic)}?keyword=${encodeURIComponent(keyword)}`);
    await this.page.waitForLoadState('networkidle');
  }

  async expectTopicName(name: string) {
    await expect(this.topicHeading).toHaveText(name);
  }

  async expectPostCount(count: number) {
    await expect(this.postRows).toHaveCount(count);
  }

  async expectHeaders(expected: string[]) {
    await expect(this.tableHeaders).toHaveText(expected);
  }

  async expectChartsVisible(minCount: number = 1) {
    const charts = this.page.locator('svg');
    const count = await charts.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  async expectHasPagination() {
    // At least one pagination button should be visible
    const prevVisible = await this.paginationPrev.isVisible().catch(() => false);
    const nextVisible = await this.paginationNext.isVisible().catch(() => false);
    expect(prevVisible || nextVisible).toBeTruthy();
  }
}
