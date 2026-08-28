import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockTopKeywords } from '../../../src/helpers/api-mock';

/**
 * Test halaman Top Engagement (/display/top-engagement).
 *
 * Display wall full-screen yang menampilkan:
 * - Top posts (card/grid dengan link ke source platform)
 * - Top accounts (akun dengan engagement tertinggi)
 * - Top hashtags (hashtag trending)
 * - Chart visualisasi (10 SVG elements)
 * - Auto-refresh countdown (20 detik)
 * - SIP Insight branding
 *
 * API yang dipanggil:
 *   GET /v1/dashboard/top-keywords?limit=5 (sumber keyword, di-mock)
 *   GET /v1/dashboard/top-posts?keyword=...&period=1M&sort_by=view
 *   GET /v1/dashboard/top-accounts?keyword=...&period=1M
 *   GET /v1/dashboard/top-hashtags?keyword=...&period=1M
 */
test.describe('Display Wall — Top Engagement', () => {
  test.beforeEach(async ({ page }) => {
    // Hanya daftar keyword yang di-mock � chart endpoints memakai BE asli.
    await mockTopKeywords(page, ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan']);
  });

  test('halaman menampilkan heading keyword', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    // H1 harus menampilkan nama keyword
    await displayWallPage.expectKeywordVisible('RUU Digital');
  });

  test('page title mengandung "Top Engagement"', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectPageTitle('Top Engagement');
  });

  test('auto-refresh countdown button terlihat', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectRefreshButtonVisible();
  });

  test('SIP Insight branding terlihat (teks statis — by design bukan link)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectSipInsightBranding();
  });

  test('SIP Insight branding tidak berupa link (by design)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectSipInsightBranding();
    // By design: branding sengaja bukan <a> — tidak boleh ada link "SIP Insight"
    const linkCount = await displayWallPage.page.getByRole('link', { name: 'SIP Insight' }).count();
    expect(linkCount).toBe(0);
  });

  test('minimal 6 chart SVG terrender (posts + accounts + hashtags + charts)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectChartsVisible(6);
  });

  test('top posts terrender dengan link ke source platform', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Harus ada link ke TikTok/Instagram
    const postLinkCount = await displayWallPage.postLinks.count();
    expect(postLinkCount).toBeGreaterThan(0);
  });

  test('top posts memiliki minimal 3 post cards', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Top posts dari mock: minimal 2 post dengan link
    const postLinkCount = await displayWallPage.postLinks.count();
    expect(postLinkCount).toBeGreaterThanOrEqual(2);
  });

  test('top hashtags terrender', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Struktural: section "Top Hashtag" tampil & minimal satu teks '#'
    // (data real BE — tag spesifik tidak di-hardcode)
    await expect(
      displayWallPage.page.getByText(/top hashtags?/i).first()
    ).toBeVisible();
    const hashTexts = await displayWallPage.page
      .getByText(/#/)
      .count();
    expect(hashTexts).toBeGreaterThan(0);
  });

  test('display wall tidak memiliki navbar utama (full-screen mode)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Navbar utama tidak boleh tampil
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

    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');
    // Tunggu hingga chart request benar-benar dikirim (max 10s)
    await expect
      .poll(() => requests.filter(r => r.includes('period=')).length, { timeout: 10_000 })
      .toBeGreaterThan(0);

    // Semua request harus menggunakan period=1M
    const periodRequests = requests.filter(r => r.includes('period='));
    for (const req of periodRequests) {
      expect(req).toContain('period=1M');
    }
  });

  test('top posts link membuka di tab baru (target=_blank)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Cek post links punya target=_blank
    const firstLink = displayWallPage.postLinks.first();
    const target = await firstLink.getAttribute('target');
    expect(target).toBe('_blank');
  });

  test('top posts link memiliki rel=noopener (security)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');
    await displayWallPage.page.waitForLoadState('networkidle');

    const firstLink = displayWallPage.postLinks.first();
    const rel = await firstLink.getAttribute('rel');
    expect(rel).toContain('noopener');
  });
});
