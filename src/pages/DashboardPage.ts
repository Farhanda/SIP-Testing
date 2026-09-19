import { expect, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Dashboard (/dashboard) pada Frontend v2.
 * Berisi interaksi filter pencarian (keyword/platform/period), protocol status,
 * serta grid kartu hasil (KPI Volume, Conversation Trend, Sentiment & Topics, Top Accounts, Top Posts).
 */
export class DashboardPage extends BasePage {
  // ── Header & Title ──────────────────────────────────────────────────────────
  readonly heading = this.page.getByRole('heading', { name: /Social Intelligence Dashboard|Dashboard Overview/i });
  readonly subtitle = this.page.getByText(/Real-time insights from social media conversations/i);
  readonly exportButton = this.page.getByRole('button', { name: /Export/i });

  // ── Filters (Top Bar) ───────────────────────────────────────────────────────
  readonly keywordCombobox = this.page.getByRole('combobox');
  readonly keywordInput = this.page.locator('input[placeholder="Search keywords"]');
  readonly periodButton = this.page.getByLabel('Period');
  readonly platformButton = this.page.getByLabel('Platform');

  // ── Protocol Status Card ────────────────────────────────────────────────────
  readonly protocolCard = this.page.locator('text=PROTOCOL').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');

  // ── Section 1: WHAT'S HAPPENING? (KPI Cards) ────────────────────────────────
  readonly whatsHappeningHeading = this.page.getByRole('heading', { name: /WHAT'S HAPPENING\?/i });
  readonly totalConversationCard = this.page.locator('div.rounded-2xl').filter({ hasText: 'Total Conversation' }).first();
  readonly totalEngagementCard = this.page.locator('div.rounded-2xl').filter({ hasText: 'Engagement' }).first();
  readonly viewsCard = this.page.locator('div.rounded-2xl').filter({ hasText: 'Views' }).first();

  // ── Section 2: WHEN? (Conversation Trend) ───────────────────────────────────
  readonly whenHeading = this.page.getByRole('heading', { name: /WHEN\?/i });
  readonly conversationTrendHeading = this.page.getByRole('heading', { name: 'Conversation Trend' });
  readonly conversationTrendCanvas = this.page.locator('canvas').first();
  readonly conversationTrendMetricButton = this.page
    .locator('button')
    .filter({ hasText: /^Total Conversation$/i });

  // ── Section 3: WHAT ARE PEOPLE SAYING? ──────────────────────────────────────
  readonly whatArePeopleSayingHeading = this.page.getByRole('heading', { name: /WHAT ARE PEOPLE SAYING\?/i });
  readonly sentimentHeading = this.page.getByRole('heading', { name: 'Sentiment' });
  readonly sentimentCard = this.sentimentHeading.locator('xpath=ancestor::*[contains(@class, "rounded-2xl")][1]');
  readonly topTopicsHeading = this.page.getByRole('heading', { name: 'Top Topics' });
  readonly topTopicsCard = this.topTopicsHeading.locator('xpath=ancestor::*[contains(@class, "rounded-2xl")][1]');
  readonly seeAllTopicsLink = this.topTopicsCard.getByRole('link', { name: /See all/i });

  // ── Section 4: WHAT IS DRIVING IT? ──────────────────────────────────────────
  readonly whatIsDrivingItHeading = this.page.getByRole('heading', { name: /WHAT IS DRIVING IT\?/i });
  readonly topAccountHeading = this.page.getByRole('heading', { name: 'Top Account' });
  readonly topAccountCard = this.topAccountHeading.locator('xpath=ancestor::*[contains(@class, "rounded-2xl")][1]');
  readonly topPostEngagementHeading = this.page.getByRole('heading', { name: 'Top Post by Engagement' });
  readonly topPostEngagementCard = this.topPostEngagementHeading.locator('xpath=ancestor::*[contains(@class, "rounded-2xl")][1]');
  readonly seeAllEngagementPostsLink = this.topPostEngagementCard.getByRole('link', { name: /See all/i });
  readonly topPostViewHeading = this.page.getByRole('heading', { name: 'Top Post by View' });
  readonly topPostViewCard = this.topPostViewHeading.locator('xpath=ancestor::*[contains(@class, "rounded-2xl")][1]');
  readonly seeAllViewPostsLink = this.topPostViewCard.getByRole('link', { name: /See all/i });

  // ── Post Detail Modal Dialog (v2 /posts/{id}) ───────────────────────────────
  readonly postDetailModal = this.page.locator('aside.translate-x-0').filter({ hasText: 'Content Details' });
  readonly postDetailCloseButton = this.postDetailModal.getByRole('button', { name: 'Close' });

  // ── Navigation ──────────────────────────────────────────────────────────────
  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  // ── Filter Actions ──────────────────────────────────────────────────────────
  /** Pilih keyword dari combobox. */
  async selectKeyword(keyword: string) {
    const respPromise = this.page.waitForResponse(
      (res) =>
        res.url().includes('/v2/dashboard/summary') &&
        res.url().toLowerCase().includes(`keyword=${encodeURIComponent(keyword).toLowerCase()}`),
    );
    await this.keywordInput.click();
    await this.keywordInput.fill(keyword);
    const option = this.page.getByRole('option', { name: keyword, exact: false }).first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
    await respPromise;
    await this.page.waitForLoadState('networkidle');
  }

  /** Pilih opsi periode dari dropdown (mis. '24 Hours', '3 Days', '7 Days', '1 Month'). */
  async selectPeriod(periodName: string) {
    await this.periodButton.click();
    const panel = this.page.locator('div[id*="headlessui-popover-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
    const option = panel.locator('button').filter({ hasText: new RegExp(`^${periodName}$`, 'i') }).first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Pilih custom range tanggal (format YYYY-MM-DD). */
  async selectCustomRange(startDate: string, endDate: string) {
    await this.periodButton.click();
    const panel = this.page.locator('div[id*="headlessui-popover-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    const customBtn = panel.locator('button').filter({ hasText: /Custom range/i }).first();
    await expect(customBtn).toBeVisible({ timeout: 5000 });
    await customBtn.click();

    const startInput = panel.locator('input[aria-label="Start date"]');
    const endInput = panel.locator('input[aria-label="End date"]');
    const applyBtn = panel.locator('button').filter({ hasText: /Apply/i });

    await startInput.fill(startDate);
    await endInput.fill(endDate);
    await expect(applyBtn).toBeEnabled();
    await applyBtn.click();
    await this.page.waitForLoadState('networkidle');
  }



  /** Toggle platform pilihan (Instagram, TikTok, Twitter/X). */
  async togglePlatform(platformName: string) {
    await this.platformButton.click();
    const option = this.page.getByRole('option', { name: new RegExp(platformName, 'i') }).first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
    await this.page.keyboard.press('Escape');
    await this.page.waitForLoadState('networkidle');
  }

  // ── Value Getters ───────────────────────────────────────────────────────────
  /** Ambil status keseluruhan dari Protocol Card (mis. 'PROTOCOL BAHAYA'). */
  async getProtocolStatus(): Promise<string> {
    const text = await this.protocolCard.innerText();
    return text.replace(/\s+/g, ' ').trim();
  }

  /** Ambil nilai Total Conversation dari KPI Card (mis. '2.65K' atau '1,593'). */
  async getTotalConversation(): Promise<string> {
    const valueEl = this.totalConversationCard.locator('div.text-\\[clamp\\(26px\\,2\\.4vw\\,36px\\)\\]').first();
    return (await valueEl.innerText()).trim();
  }

  /** Ambil nilai Engagement dari KPI Card. */
  async getEngagement(): Promise<string> {
    const valueEl = this.totalEngagementCard.locator('div.text-\\[clamp\\(26px\\,2\\.4vw\\,36px\\)\\]').first();
    return (await valueEl.innerText()).trim();
  }

  /** Ambil nilai Views dari KPI Card. */
  async getViews(): Promise<string> {
    const valueEl = this.viewsCard.locator('div.text-\\[clamp\\(26px\\,2\\.4vw\\,36px\\)\\]').first();
    return (await valueEl.innerText()).trim();
  }

  /** Ambil total sentimen di tengah donut chart. */
  async getSentimentTotal(): Promise<string> {
    const totalEl = this.sentimentCard.locator('div').filter({ hasText: /Conversations/i }).first();
    const text = await totalEl.innerText();
    const match = text.match(/[\d,\.]+/);
    return match ? match[0] : text.trim();
  }

  /** Ambil persentase sentimen (Negative, Positive, Neutral). */
  async getSentimentPercentages(): Promise<Record<string, string>> {
    const items = await this.sentimentCard.locator('ul li').all();
    const result: Record<string, string> = {};
    for (const item of items) {
      const text = await item.innerText();
      const parts = text.split(/\s+/);
      if (parts.length >= 2) {
        result[parts[0]] = parts[parts.length - 1];
      }
    }
    return result;
  }

  /** Ambil daftar Top Topics (rank, nama, count). */
  async getTopTopicsList(): Promise<Array<{ rank: string; name: string; count: string }>> {
    const rows = await this.topTopicsCard.locator('ul li').all();
    const result: Array<{ rank: string; name: string; count: string }> = [];
    for (const row of rows) {
      const rank = (await row.locator('span.rounded-full').innerText().catch(() => '')).trim();
      const name = (await row.locator('a').innerText().catch(() => '')).trim();
      const count = (await row.locator('span.tabular-nums').innerText().catch(() => '')).trim();
      result.push({ rank, name, count });
    }
    return result;
  }

  /** Ambil daftar Top Accounts. */
  async getTopAccountsList(): Promise<Array<{ account: string; platform: string; post: string; engagement: string; view: string }>> {
    const rows = await this.topAccountCard.locator('tbody tr').all();
    const result: Array<{ account: string; platform: string; post: string; engagement: string; view: string }> = [];
    for (const row of rows) {
      const account = (await row.locator('td').nth(0).locator('a').innerText().catch(() => '')).trim();
      const platform = (await row.locator('td').nth(0).locator('div.text-\\[12px\\]').innerText().catch(() => '')).trim();
      const post = (await row.locator('td').nth(1).innerText().catch(() => '')).trim();
      const engagement = (await row.locator('td').nth(2).innerText().catch(() => '')).trim();
      const view = (await row.locator('td').nth(3).innerText().catch(() => '')).trim();
      result.push({ account, platform, post, engagement, view });
    }
    return result;
  }

  /** Buka dialog detail postingan dengan mengklik salah satu baris postingan di kartu Top Post. */
  async openPostDetail(source: 'engagement' | 'view' = 'engagement', rowIndex = 0): Promise<void> {
    const card = source === 'engagement' ? this.topPostEngagementCard : this.topPostViewCard;
    const postButton = card.locator('tbody tr').nth(rowIndex).locator('td button').first();
    await expect(postButton).toBeVisible();
    await postButton.click();
    await expect(this.postDetailModal).toBeVisible({ timeout: 10_000 });
  }

  /** Tutup dialog detail postingan. */
  async closePostDetailModal(): Promise<void> {
    await expect(this.postDetailModal).toBeVisible();
    await this.postDetailCloseButton.click();
    await expect(this.postDetailModal).toBeHidden({ timeout: 5000 });
  }

  /** Ambil data dari dialog modal detail postingan yang sedang terbuka. */
  async getPostDetailModalData(): Promise<{
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
  }> {
    await expect(this.postDetailModal).toBeVisible();
    const modal = this.postDetailModal;

    const author = (await modal.locator('div.text-\\[16px\\].font-bold, div.font-bold').first().innerText().catch(() => '')).trim();
    
    // Header metadata: Platform & Published date
    const platformEl = modal.locator('span.font-semibold').first();
    const platform = (await platformEl.innerText().catch(() => '')).trim();

    const publishedEl = modal.locator('div.text-\\[13\\.5px\\] span:nth-of-type(3)').first();
    const publishedAt = (await publishedEl.innerText().catch(() => '')).trim();

    // Updated at: "Updated on 17 Sep, 11:39"
    const updatedEl = modal.locator('div').filter({ hasText: /Updated on/i }).last();
    const updatedAt = (await updatedEl.innerText().catch(() => '')).trim();

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
}

