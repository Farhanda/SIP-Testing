import { expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export interface ContentRowData {
  rank: string;
  content: string;
  author: string;
  topic: string;
  sentiment: string;
  engagement: string;
  views: string;
  hasDetailButton: boolean;
}

export interface ContentDetailModalData {
  author: string;
  handle: string;
  platform: string;
  publishedAt: string;
  updatedAt: string;
  content: string;
  views: string;
  engagement: string;
  likes: string;
  comments: string;
  shares: string;
  saves: string;
}

/**
 * Page Object Model untuk Halaman Content (/content) pada Frontend v2.
 * Menampilkan daftar Top Content, filter topik, filter sentimen, sorting by Engagement/Views,
 * pencarian konten, paginasi, dan modal drill-down Content Details.
 */
export class ContentPage extends BasePage {
  // ── Header & Title ──────────────────────────────────────────────────────────
  readonly badge = this.page.locator('div, span, p').filter({ hasText: /^CONTENT INTELLIGENCE$/i }).first();
  readonly heading = this.page.getByRole('heading', { name: /Understand the Content/i });
  readonly subtitle = this.page.locator('text=/Find the most influential content/i');

  // ── Top Controls / Global Filters ───────────────────────────────────────────
  readonly keywordInput = this.page.locator('input[placeholder*="Search keywords"], input[placeholder*="Search"]').first();
  readonly periodButton = this.page.locator('button').filter({ hasText: /^(24 Hours|3 Days|7 Days|1 Month|Custom range|Period)/i }).first();
  readonly platformButton = this.page.locator('button').filter({ hasText: /All platforms|Instagram|TikTok|Twitter/i }).first();

  // ── Content Specific Filters ────────────────────────────────────────────────
  readonly searchInput = this.page.locator('input[placeholder*="Search content"]');
  readonly topicSelect = this.page.locator('select').first();
  readonly sentimentSelect = this.page.locator('select').nth(1);
  readonly sortBySelect = this.page.locator('select').nth(2);

  // ── Card & Table ────────────────────────────────────────────────────────────
  readonly card = this.page.locator('div.rounded-2xl').filter({ hasText: 'Top Content' }).first();
  readonly table = this.card.locator('table');
  readonly tableHeaders = this.table.locator('thead th');
  readonly tableRows = this.table.locator('tbody tr');

  // ── Paginasi ────────────────────────────────────────────────────────────────
  readonly paginationInfo = this.page.locator('p, span, div').filter({ hasText: /Showing \d+–\d+ of \d+ contents/i }).first();
  readonly paginationContainer = this.page.locator('div').filter({ hasText: /Showing \d+–\d+ of \d+ contents/i }).last();

  // ── Content Details Modal (Slide-Over Panel v2) ─────────────────────────────
  readonly detailModal = this.page.locator('aside.translate-x-0').filter({ hasText: 'Content Details' });
  readonly detailCloseButton = this.detailModal.getByRole('button', { name: 'Close' });

  // ── Navigation ──────────────────────────────────────────────────────────────
  async goto(queryString: string = '') {
    const targetUrl = queryString ? `/content?${queryString}` : '/content';
    await this.page.goto(targetUrl);
    await this.page.waitForLoadState('networkidle');
  }

  // ── Filter Actions ──────────────────────────────────────────────────────────
  /** Pilih opsi periode dari dropdown. */
  async selectPeriod(periodName: string) {
    await this.periodButton.click();
    const panel = this.page.locator('div[id*="headlessui-popover-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
    const option = panel.locator('button').filter({ hasText: new RegExp(`^${periodName}$`, 'i') }).first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Pilih topik dari dropdown Topic. */
  async selectTopic(topicName: string) {
    await this.topicSelect.selectOption({ label: topicName });
    await this.page.waitForLoadState('networkidle');
  }

  /** Pilih sentimen dari dropdown Sentiment. */
  async selectSentiment(sentiment: string) {
    await this.sentimentSelect.selectOption({ label: sentiment });
    await this.page.waitForLoadState('networkidle');
  }

  /** Pilih opsi Sort By ('Sort by: Views' atau 'Sort by: Engagement'). */
  async selectSortBy(sortLabel: string) {
    await this.sortBySelect.selectOption({ label: sortLabel });
    await this.page.waitForLoadState('networkidle');
  }

  /** Cari konten via search bar input. */
  async searchContent(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
    await this.page.waitForLoadState('networkidle');
  }

  /** Ambil seluruh baris data pada tabel Top Content. */
  async getContentList(): Promise<ContentRowData[]> {
    const rows = await this.tableRows.all();
    const result: ContentRowData[] = [];
    for (const row of rows) {
      const cells = row.locator('td');
      const rank = (await cells.nth(0).innerText().catch(() => '')).trim();
      const content = (await cells.nth(1).innerText().catch(() => '')).trim();
      const author = (await cells.nth(2).innerText().catch(() => '')).trim();
      const topic = (await cells.nth(3).innerText().catch(() => '')).trim();
      const sentiment = (await cells.nth(4).innerText().catch(() => '')).trim();
      const engagement = (await cells.nth(5).innerText().catch(() => '')).trim();
      const views = (await cells.nth(6).innerText().catch(() => '')).trim();
      const hasDetailButton = (await cells.nth(7).locator('button').filter({ hasText: /Detail/i }).count().catch(() => 0)) > 0;
      result.push({ rank, content, author, topic, sentiment, engagement, views, hasDetailButton });
    }
    return result;
  }

  /** Buka modal detail postingan berdasarkan indeks baris (0-indexed). */
  async openPostDetail(rowIndex: number = 0) {
    const row = this.tableRows.nth(rowIndex);
    const detailBtn = row.locator('button').filter({ hasText: /Detail/i });
    await expect(detailBtn).toBeVisible({ timeout: 5000 });
    await detailBtn.click();
    await expect(this.detailModal).toBeVisible({ timeout: 10_000 });
  }

  /** Tutup modal Content Details. */
  async closePostDetail() {
    await expect(this.detailModal).toBeVisible();
    await this.detailCloseButton.click();
    await expect(this.detailModal).toBeHidden({ timeout: 5000 });
  }

  /** Ambil data metrik dan informasi dari modal Content Details. */
  async getPostDetailData(): Promise<ContentDetailModalData> {
    await expect(this.detailModal).toBeVisible();
    const modal = this.detailModal;

    const author = (await modal.locator('div.text-\\[16px\\].font-bold, div.font-bold').first().innerText().catch(() => '')).trim();
    const platform = (await modal.locator('span.font-semibold').first().innerText().catch(() => '')).trim();
    const publishedAt = (await modal.locator('div.text-\\[13\\.5px\\] span:nth-of-type(3)').first().innerText().catch(() => '')).trim();
    const updatedAt = (await modal.locator('div').filter({ hasText: /Updated on/i }).last().innerText().catch(() => '')).trim();

    const linkEl = modal.locator('a[href*="/@"]').first();
    const href = (await linkEl.getAttribute('href').catch(() => '')) || '';
    const handleMatch = href.match(/@([^/?#]+)/);
    const handle = handleMatch ? `@${handleMatch[1]}` : (author ? `@${author}` : '');

    const content = (await modal.locator('p.whitespace-pre-wrap, p, div.text-ink-800').first().innerText().catch(() => '')).trim();

    const getStat = async (label: string): Promise<string> => {
      const box = modal.locator('div.rounded-xl').filter({ hasText: label }).first();
      return (await box.locator('.tabular-nums, .font-extrabold').first().innerText({ timeout: 2000 }).catch(() => '')).trim();
    };

    const views = await getStat('Views');
    const engagement = await getStat('Engagement');
    const likes = await getStat('Likes');
    const comments = await getStat('Comments');
    const shares = await getStat('Shares');
    const saves = await getStat('Saves');

    return { author, handle, platform, publishedAt, updatedAt, content, views, engagement, likes, comments, shares, saves };
  }

  /** Navigasi ke nomor halaman tertentu pada paginasi. */
  async goToPage(pageNumber: number) {
    const pageBtn = this.page.getByRole('button', { name: String(pageNumber), exact: true });
    await expect(pageBtn).toBeVisible({ timeout: 5000 });
    await pageBtn.click();
    await this.page.waitForLoadState('networkidle');
  }
}

