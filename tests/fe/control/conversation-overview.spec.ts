import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockDashboardApis,
  mockKeywordOptions,
  mockSelectedKeywords,
  mockTrendingTopicMultiPeriod,
} from '../../../src/helpers/api-mock';

/**
 * Test halaman Conversation Overview (/display/conversation-overview).
 *
 * Display wall full-screen yang menampilkan:
 * - Conversation trend chart (line chart volume & engagement)
 * - Emotion map (pie/donut chart distribusi emotion)
 * - Sentiment map (pie/donut chart distribusi sentiment)
 * - Trending topics dengan delta per periode (24h, 7d, 1mo)
 * - Auto-refresh countdown (20 detik)
 * - SIP Insight branding
 *
 * API yang dipanggil:
 *   GET /api/control/selected-keywords
 *   GET /v1/dashboard/conversation-trend?keyword=...&period=1M
 *   GET /v1/dashboard/emotion-map?keyword=...&period=1M
 *   GET /v1/dashboard/sentiment-map?keyword=...&period=1M
 *   GET /api/control/trending-topic-multi-period?keyword=...
 */
test.describe('Display Wall — Conversation Overview', () => {
  test.beforeEach(async ({ page }) => {
    await mockDashboardApis(page);
    await mockKeywordOptions(page, ['RUU Digital']);
    await mockSelectedKeywords(page, ['RUU Digital']);
    await mockTrendingTopicMultiPeriod(page);
  });

  test('halaman menampilkan heading keyword', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // H1 harus menampilkan nama keyword (auto-select dari selected-keywords)
    await displayWallPage.expectKeywordVisible('RUU Digital');
  });

  test('page title mengandung "Conversation Overview"', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectPageTitle('Conversation Overview');
  });

  test('auto-refresh countdown button terlihat', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectRefreshButtonVisible();

    // Tombol harus menampilkan countdown (mis. "20 seconds")
    const text = await displayWallPage.refreshCountdown.textContent();
    expect(text).toMatch(/\d+\s*seconds?/i);
  });

  test('SIP Insight branding link terlihat', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectSipInsightLink();
  });

  test('SIP Insight link mengarah ke homepage (/)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    const href = await displayWallPage.sipInsightLink.getAttribute('href');
    expect(href).toBe('/');
  });

  test('minimal 4 chart SVG terrender (conversation trend + emotion + sentiment + trending)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectChartsVisible(4);
  });

  test('conversation trend chart terrender', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Conversation trend adalah chart pertama
    const firstChart = displayWallPage.charts.first();
    await expect(firstChart).toBeVisible();

    // Chart harus punya elemen (line, circle, dll)
    const chartChildren = await firstChart.locator('circle, line, path, rect').count();
    expect(chartChildren).toBeGreaterThan(0);
  });

  test('emotion map chart terrender', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Emotion map biasanya pie/donut chart — cari SVG yang punya path lingkaran
    const svgCount = await displayWallPage.charts.count();
    expect(svgCount).toBeGreaterThanOrEqual(3); // trend + emotion + sentiment
  });

  test('trending topics section terrender', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Trending topics harus ada — cari teks dari mock data
    const hasPublicServices = await displayWallPage.page.getByText('Public services').isVisible().catch(() => false);
    const hasTariffPolicy = await displayWallPage.page.getByText('Tariff policy').isVisible().catch(() => false);
    // Minimal salah satu trending topic terlihat
    expect(hasPublicServices || hasTariffPolicy).toBeTruthy();
  });

  test('trending topics menampilkan delta per periode (24h, 7d, 1mo)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Cek ada delta labels
    const has24h = await displayWallPage.page.getByText('24h').first().isVisible().catch(() => false);
    const has7d = await displayWallPage.page.getByText('7d').first().isVisible().catch(() => false);
    const has1mo = await displayWallPage.page.getByText('1mo').first().isVisible().catch(() => false);
    expect(has24h || has7d || has1mo).toBeTruthy();
  });

  test('display wall tidak memiliki navbar utama (full-screen mode)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Navbar utama (Dashboard/Display Wall/Management) tidak boleh tampil
    const navLinks = displayWallPage.page.getByRole('navigation').getByRole('link', { name: 'Dashboard' });
    const hasNav = await navLinks.isVisible().catch(() => false);
    expect(hasNav).toBeFalsy();
  });

  test('display wall menggunakan period=1M sebagai default', async ({ displayWallPage }) => {
    const requests: string[] = [];
    displayWallPage.page.on('request', (req) => {
      if (req.url().includes('/v1/dashboard/')) {
        requests.push(req.url());
      }
    });

    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');
    await displayWallPage.page.waitForTimeout(2000);

    // Semua request harus menggunakan period=1M
    const periodRequests = requests.filter(r => r.includes('period='));
    for (const req of periodRequests) {
      expect(req).toContain('period=1M');
    }
  });
});
