import { expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export interface TopicDetailKpis {
  totalPosts: string;
  totalEngagement: string;
  negativeSentiment: string;
  topPlatform: string;
}

export interface TopicPostRow {
  platform: string;
  post: string;
  emotion: string;
  sentiment: string;
  views: string;
  engagement: string;
}

/**
 * POM halaman Topic Detail (/monitoring/dashboard/topic/:topic).
 * Menampilkan detail topik tertentu — 4 kartu KPI (Total posts, Engagement, Negative sentiment, Top platform),
 * filter keyword/platform/sentiment/emotion, sorting by Views/Engagement, dan daftar postingan terkait.
 */
export class TopicDetailPage extends BasePage {
  readonly topicHeading = this.page.locator('h1').first();
  readonly breadcrumb = this.page.locator('div, nav, span').filter({ hasText: /Topic Intelligence\s*>\s*/i }).first();
  readonly postListHeading = this.page.getByRole('heading', { name: 'Post list' });

  // ── 4 KPI Cards ─────────────────────────────────────────────────────────────
  readonly totalPostsCard = this.page.locator('article').filter({ hasText: 'Total posts' }).first();
  readonly totalEngagementCard = this.page.locator('article').filter({ hasText: 'Total engagement' }).first();
  readonly negativeSentimentCard = this.page.locator('article').filter({ hasText: 'Negative sentiment' }).first();
  readonly topPlatformCard = this.page.locator('article').filter({ hasText: 'Top platform' }).first();

  // ── Filter Controls ─────────────────────────────────────────────────────────
  readonly searchInput = this.page.locator('#tdKeyword');
  readonly platformButton = this.page.locator('button[id*="headlessui-listbox-button"]').first();
  readonly sentimentSelect = this.page.locator('#tdSentiment');
  readonly emotionSelect = this.page.locator('#tdEmotion');
  readonly applyFilterButton = this.page.getByRole('button', { name: 'Apply filter' });
  readonly resetFiltersButton = this.page.getByRole('button', { name: 'Reset filter' });
  readonly sortBySelect = this.page.locator('#tdSortBy');

  // ── Table ───────────────────────────────────────────────────────────────────
  readonly table = this.page.locator('table');
  readonly tableHeaders = this.page.locator('table th');
  readonly postRows = this.page.locator('table tbody tr');

  // ── Pagination ──────────────────────────────────────────────────────────────
  readonly pagination = this.page.locator('div').filter({ hasText: /Page \d+ of \d+/i }).last();

  async goto(topic: string = 'Kesehatan') {
    await this.page.goto(`/monitoring/dashboard/topic/${encodeURIComponent(topic)}`);
    await this.page.waitForLoadState('networkidle');
  }

  async getKpis(): Promise<TopicDetailKpis> {
    const getVal = async (card: Locator) => {
      const text = await card.innerText().catch(() => '');
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      return lines[1] || lines[0] || '';
    };

    const totalPosts = await getVal(this.totalPostsCard);
    const totalEngagement = await getVal(this.totalEngagementCard);
    const negativeSentiment = await getVal(this.negativeSentimentCard);
    const topPlatform = await getVal(this.topPlatformCard);

    return { totalPosts, totalEngagement, negativeSentiment, topPlatform };
  }

  async getPostsList(): Promise<TopicPostRow[]> {
    const rows = await this.postRows.all();
    const result: TopicPostRow[] = [];
    for (const row of rows) {
      const cells = row.locator('td');
      const platform = (await cells.nth(0).innerText().catch(() => '')).trim();
      const post = (await cells.nth(1).innerText().catch(() => '')).trim();
      const emotion = (await cells.nth(2).innerText().catch(() => '')).trim();
      const sentiment = (await cells.nth(3).innerText().catch(() => '')).trim();
      const views = (await cells.nth(4).innerText().catch(() => '')).trim();
      const engagement = (await cells.nth(5).innerText().catch(() => '')).trim();
      result.push({ platform, post, emotion, sentiment, views, engagement });
    }
    return result;
  }
}
