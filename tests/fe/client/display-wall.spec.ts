import { expect } from './fixtures';
import { test } from './fixtures';
import { Env } from '../../../src/config/env';
import { mockTopKeywords } from '../../../src/helpers/api-mock';

/**
 * Test Display Wall untuk client role.
 *
 * Client dapat mengakses:
 * - /display/top-engagement
 * - /display/conversation-overview
 *
 * Display wall berjalan full-screen tanpa navbar utama.
 * Menggunakan API asli (tanpa mock) untuk data display wall.
 */
test.describe('Client — Display Wall', () => {
  // ── Top Engagement ──────────────────────────────────────────────────

  test.describe('Top Engagement', () => {
    test.beforeEach(async ({ page }) => {
      await mockTopKeywords(page, ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan']);
    });

    test('halaman Top Engagement dapat diakses client', async ({ page }) => {
      await page.goto('/display/top-engagement');
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      // Page title mengandung "Top Engagement"
      await expect(page).toHaveTitle(/Top Engagement/);
    });

    test('Top Engagement menampilkan heading keyword', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');
      await displayWallPage.page.waitForLoadState('networkidle', { timeout: 15_000 });

      // H1 harus menampilkan nama keyword
      await displayWallPage.expectKeywordVisible('RUU Digital');
    });

    test('Top Engagement menampilkan auto-refresh countdown', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');
      await displayWallPage.page.waitForLoadState('networkidle', { timeout: 15_000 });

      await displayWallPage.expectRefreshButtonVisible();
    });

    test('Top Engagement menampilkan SIP Insight branding', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');
      await displayWallPage.page.waitForLoadState('networkidle', { timeout: 15_000 });

      await displayWallPage.expectSipInsightBranding();
    });

    test('Top Engagement minimal 6 chart SVG terrender', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');
      await displayWallPage.page.waitForLoadState('networkidle', { timeout: 15_000 });

      await displayWallPage.expectChartsVisible(6);
    });

    test('Top Engagement menampilkan top posts dengan link', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');
      await displayWallPage.page.waitForLoadState('networkidle', { timeout: 15_000 });

      const postLinkCount = await displayWallPage.postLinks.count();
      expect(postLinkCount).toBeGreaterThan(0);
    });

    test('Top Engagement tidak memiliki navbar utama (full-screen mode)', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');
      await displayWallPage.page.waitForLoadState('networkidle', { timeout: 15_000 });

      const navLinks = displayWallPage.page.getByRole('navigation').getByRole('link', { name: 'Dashboard' });
      const hasNav = await navLinks.isVisible().catch(() => false);
      expect(hasNav).toBeFalsy();
    });
  });

  // ── Conversation Overview ───────────────────────────────────────────

  test.describe('Conversation Overview', () => {
    test('halaman Conversation Overview dapat diakses client', async ({ page }) => {
      await page.goto('/display/conversation-overview');
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      // Page title mengandung "Conversation Overview"
      await expect(page).toHaveTitle(/Conversation Overview/);
    });

    test('Conversation Overview menampilkan heading keyword', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/conversation-overview');
      await displayWallPage.page.waitForLoadState('networkidle', { timeout: 15_000 });

      // Heading harus menampilkan nama keyword
      await displayWallPage.expectKeywordVisible('demo');
    });

    test('Conversation Overview menampilkan auto-refresh countdown', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/conversation-overview');
      await displayWallPage.page.waitForLoadState('networkidle', { timeout: 15_000 });

      await displayWallPage.expectRefreshButtonVisible();
    });

    test('Conversation Overview menampilkan SIP Insight branding', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/conversation-overview');
      await displayWallPage.page.waitForLoadState('networkidle', { timeout: 15_000 });

      await displayWallPage.expectSipInsightBranding();
    });

    test('Conversation Overview tidak memiliki navbar utama (full-screen mode)', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/conversation-overview');
      await displayWallPage.page.waitForLoadState('networkidle', { timeout: 15_000 });

      const navLinks = displayWallPage.page.getByRole('navigation').getByRole('link', { name: 'Dashboard' });
      const hasNav = await navLinks.isVisible().catch(() => false);
      expect(hasNav).toBeFalsy();
    });
  });
});
