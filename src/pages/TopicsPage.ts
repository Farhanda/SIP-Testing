import { expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export interface TopicRowData {
  rank: string;
  name: string;
  count: string;
  hasSentiment: boolean;
  hasTrend: boolean;
  hasAiAction: boolean;
}

/**
 * Page Object Model untuk Halaman Ikhtisar Topics (/topics) pada Frontend v2.
 * Menampilkan daftar Top Topics, metrik percakapan, sentimen, sparkline tren,
 * search filter, period filter, dan drawer wawasan Analisis AI.
 */
export class TopicsPage extends BasePage {
  // ── Header & Title ──────────────────────────────────────────────────────────
  readonly badge = this.page.locator('div, span, p').filter({ hasText: /^TOPIC INTELLIGENCE$/i }).first();
  readonly heading = this.page.getByRole('heading', { name: /Discover.*What People Talk About/i });
  readonly subtitle = this.page.locator('text=/Explore trending topics and generate AI insights/i');

  // ── Top Controls / Global Filters ───────────────────────────────────────────
  readonly keywordInput = this.page.locator('input[placeholder*="Search keywords"], input[placeholder*="Search"]').first();
  readonly periodButton = this.page.locator('button').filter({ hasText: /^(24 Hours|3 Days|7 Days|1 Month|Custom range|Period)/i }).first();
  readonly platformButton = this.page.locator('button').filter({ hasText: /All platforms|Instagram|TikTok|Twitter/i }).first();
  readonly searchInput = this.page.locator('input[placeholder*="Search topics"], input[placeholder*="Search topic"]').first();

  // ── Card & Table ────────────────────────────────────────────────────────────
  readonly card = this.page.locator('div.rounded-2xl').filter({ hasText: 'Top Topics' }).first();
  readonly table = this.card.locator('table');
  readonly tableHeaders = this.table.locator('thead th');
  readonly tableRows = this.table.locator('tbody tr');

  // ── Paginasi ────────────────────────────────────────────────────────────────
  readonly paginationInfo = this.card.locator('div').filter({ hasText: /Showing \d+–\d+ of \d+ topics/i }).last();

  // ── Analisis AI Drawer (Slide-Over Panel v2) ─────────────────────────────────
  readonly aiDrawer = this.page.locator('aside.translate-x-0').filter({ hasText: 'Analisis AI' });
  readonly aiDrawerCloseButton = this.aiDrawer.getByRole('button', { name: 'Close' });
  readonly aiDrawerTopicHeading = this.aiDrawer.locator('div.font-bold, h2, h3').filter({ hasText: /^[A-Z]/i }).first();
  readonly aiDrawerPeriod = this.aiDrawer.locator('div, span, p').filter({ hasText: /WIB/i }).first();
  readonly aiDrawerWhatHeading = this.aiDrawer.getByText('Apa yang terjadi?');
  readonly aiDrawerWhyHeading = this.aiDrawer.getByText('Kenapa terjadi?');
  readonly aiDrawerRelatedLink = this.aiDrawer.getByRole('link', { name: /Lihat Percakapan Terkait/i });
  readonly aiDrawerGenerateReportBtn = this.aiDrawer.getByRole('button', { name: /Generate Laporan Topik/i });

  // ── Navigation ──────────────────────────────────────────────────────────────
  async goto() {
    await this.page.goto('/topics');
    await this.page.waitForLoadState('networkidle');
  }

  // ── Filter Actions ──────────────────────────────────────────────────────────
  /** Pilih keyword dari combobox. */
  async selectKeyword(keyword: string) {
    const respPromise = this.page.waitForResponse(
      (res) =>
        res.url().includes('/v2/dashboard/top-topics') &&
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

  /** Cari topik melalui input search filter. */
  async searchTopic(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  /** Ambil daftar baris topik yang tampil saat ini. */
  async getTopicsList(): Promise<TopicRowData[]> {
    const rows = await this.tableRows.all();
    const result: TopicRowData[] = [];
    for (const row of rows) {
      const cells = row.locator('td');
      const rank = (await cells.nth(0).innerText().catch(() => '')).trim();
      const name = (await cells.nth(1).innerText().catch(() => '')).trim();
      const count = (await cells.nth(2).innerText().catch(() => '')).trim();
      const hasSentiment = (await cells.nth(3).locator('div').count().catch(() => 0)) > 0;
      const hasTrend = (await cells.nth(4).locator('svg').count().catch(() => 0)) > 0;
      const hasAiAction = (await cells.nth(5).locator('button').count().catch(() => 0)) > 0;
      result.push({ rank, name, count, hasSentiment, hasTrend, hasAiAction });
    }
    return result;
  }

  /** Buka drawer Analisis AI untuk topik tertentu (berdasarkan nama topik atau index baris). */
  async openAiAnalysis(topicOrIndex: string | number = 0) {
    let row: Locator;
    if (typeof topicOrIndex === 'number') {
      row = this.tableRows.nth(topicOrIndex);
    } else {
      row = this.tableRows.filter({ hasText: topicOrIndex }).first();
    }
    const aiBtn = row.getByRole('button', { name: /Analisis AI/i });
    await expect(aiBtn).toBeVisible();
    await aiBtn.click();
    await expect(this.aiDrawer).toBeVisible({ timeout: 10_000 });
  }

  /** Tutup drawer Analisis AI. */
  async closeAiDrawer() {
    await expect(this.aiDrawer).toBeVisible();
    await this.aiDrawerCloseButton.click();
    await expect(this.aiDrawer).toBeHidden({ timeout: 5000 });
  }
}

