import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman detail keyword on-demand (/monitoring/keyword/unscheduled/[id]).
 * Menampilkan breadcrumb, header keyword + status, dan (khusus status
 * completed) kartu analisis dashboard yang sama dengan halaman dashboard.
 */
export class UnscheduledDetailPage extends BasePage {
  readonly breadcrumb = this.page.getByRole('navigation', { name: 'Breadcrumb' });
  readonly exportReportButton = this.page.getByRole('button', { name: 'Export report' });
  readonly notAvailable = this.page.getByText('Detail not available yet');
  readonly retryButton = this.page.getByRole('button', { name: 'Retry' });
  readonly conversationSummaryHeading = this.page.getByRole('heading', { name: 'Conversation summary' });
  readonly sentimentGroupHeading = this.page.getByRole('heading', { name: 'Sentiment & Emotion Analysis' });
  readonly contentGroupHeading = this.page.getByRole('heading', { name: 'Content Intelligence' });
  readonly topPerformersHeading = this.page.getByRole('heading', { name: 'Top Performers' });

  async goto(id: string) {
    await this.page.goto(`/monitoring/keyword/unscheduled/${id}`);
  }

  async expectHeading(keyword: string) {
    await expect(this.page.getByRole('heading', { name: keyword, exact: true })).toBeVisible();
  }

  async expectErrorNotice() {
    await expect(this.page.getByText('Failed to load keyword detail.')).toBeVisible();
  }
}
