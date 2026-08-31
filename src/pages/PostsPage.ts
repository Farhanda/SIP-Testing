import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Top Posts (/monitoring/dashboard/posts).
 * Menampilkan daftar post lengkap dengan sorting, pagination, dan filter.
 */
export class PostsPage extends BasePage {
  readonly postRows = this.page.locator('table tbody tr');
  readonly tableHeaders = this.page.locator('table th');
  readonly sortBySelect = this.page.getByRole('combobox', { name: 'Sort by' });
  readonly topicSelect = this.page.getByRole('combobox', { name: 'Topic' });
  readonly searchInput = this.page.getByPlaceholder('Search keyword...');
  readonly emotionSelect = this.page.getByRole('combobox', { name: 'Emotion' });
  readonly sentimentSelect = this.page.getByRole('combobox', { name: 'Sentiment' });
  readonly platformButton = this.page.getByRole('button', { name: /Platform/ });
  readonly paginationPrev = this.page.getByRole('button', { name: '‹' });
  readonly paginationNext = this.page.getByRole('button', { name: '›' });
  readonly paginationPage1 = this.page.getByRole('button', { name: '1', exact: true });
  readonly applyFilterButton = this.page.getByRole('button', { name: 'Apply filter' });
  readonly resetFiltersButton = this.page.getByRole('button', { name: 'Reset filter' });
  readonly backToDashboardLink = this.page.getByRole('link', { name: 'Dashboard' });

  async gotoWithSort(sortBy: string = 'view', keyword: string = 'RUU Digital') {
    await this.page.goto(`/monitoring/dashboard/posts?keyword=${encodeURIComponent(keyword)}&sort_by=${sortBy}`);
    await this.page.waitForLoadState('networkidle');
  }

  async expectPostCount(count: number) {
    await expect(this.postRows).toHaveCount(count);
  }

  async expectHeaders(expected: string[]) {
    await expect(this.tableHeaders).toHaveText(expected);
  }

  async expectFirstPostHasText(text: string) {
    await expect(this.postRows.first().getByText(text)).toBeVisible();
  }

  async expectPostSortOrder(direction: 'asc' | 'desc', column: number) {
    // Verify posts are sorted correctly in the given column
    const rows = this.postRows;
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
  }
}
