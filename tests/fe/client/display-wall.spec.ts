import { expect } from './fixtures';
import { test } from './fixtures';

/**
 * Test Display Wall untuk client role.
 *
 * Client dapat mengakses:
 * - /display/top-engagement
 * - /display/conversation-overview
 *
 * Display wall berjalan full-screen tanpa navbar utama.
 * Menggunakan API asli (tanpa mock) untuk data display wall.
 *
 * Penantian berbasis elemen/assertion auto-wait (bukan networkidle —
 * tidak stabil pada halaman auto-refresh).
 */
test.describe('Client — Display Wall', () => {
  // ── Top Engagement ──────────────────────────────────────────────────

  test.describe('Top Engagement', () => {
    // TANPA mock top-keywords: FE deployed memanggil API prod (di-bake saat
    // build) yang tidak punya data untuk keyword mock — wall jadi kosong.
    // Heading juga struktural (label keyword live dari BE).

    test('halaman Top Engagement dapat diakses client', async ({ page }) => {
      await page.goto('/display/top-engagement');

      // Page title mengandung "Top Engagement"
      await expect(page).toHaveTitle(/Top Engagement/);
    });

    test('Top Engagement menampilkan heading keyword', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');

      // Struktural: h1 terisi teks keyword (label dinamis dari BE)
      await expect(displayWallPage.keywordHeading).toBeVisible();
      const heading = (await displayWallPage.keywordHeading.innerText()).trim();
      expect(heading.length).toBeGreaterThan(0);
    });

    test('Top Engagement menampilkan auto-refresh countdown', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');

      await displayWallPage.expectRefreshButtonVisible();
    });

    test('Top Engagement menampilkan SIP Insight branding', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');

      await displayWallPage.expectSipInsightBranding();
    });

    test('Top Engagement minimal 6 chart SVG terrender', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');

      await displayWallPage.expectChartsVisible(6);
    });

    test('Top Engagement menampilkan top posts dengan link', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');

      // Assert penuh: minimal 1 link post ke source platform. BE asli (yang
      // dipakai FE deployed) memiliki data top-posts untuk keyword populer,
      // jadi link kosong = regresi render, bukan kondisi wajar.
      await expect(displayWallPage.postLinks.first()).toBeVisible();
      const postLinkCount = await displayWallPage.postLinks.count();
      expect(postLinkCount).toBeGreaterThan(0);
    });

    test('Top Engagement tidak memiliki navbar utama (full-screen mode)', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/top-engagement');

      // Tunggu wall ter-render dulu agar tidak false-pass sebelum render
      await displayWallPage.expectRefreshButtonVisible();
      const navLinks = displayWallPage.page.getByRole('navigation').getByRole('link', { name: 'Dashboard' });
      await expect(navLinks).toHaveCount(0);
    });
  });

  // ── Conversation Overview ───────────────────────────────────────────

  test.describe('Conversation Overview', () => {
    test('halaman Conversation Overview dapat diakses client', async ({ page }) => {
      await page.goto('/display/conversation-overview');

      // Page title mengandung "Conversation Overview"
      await expect(page).toHaveTitle(/Conversation Overview/);
    });

    test('Conversation Overview menampilkan heading keyword', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/conversation-overview');

      // Struktural (BE asli — label keyword dinamis): h1 terisi teks keyword
      await expect(displayWallPage.keywordHeading).toBeVisible();
      const heading = (await displayWallPage.keywordHeading.innerText()).trim();
      expect(heading.length).toBeGreaterThan(0);
    });

    test('Conversation Overview menampilkan auto-refresh countdown', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/conversation-overview');

      await displayWallPage.expectRefreshButtonVisible();
    });

    test('Conversation Overview menampilkan SIP Insight branding', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/conversation-overview');

      await displayWallPage.expectSipInsightBranding();
    });

    test('Conversation Overview tidak memiliki navbar utama (full-screen mode)', async ({ displayWallPage }) => {
      await displayWallPage.goto('/display/conversation-overview');

      // Tunggu wall ter-render dulu agar tidak false-pass sebelum render
      await displayWallPage.expectRefreshButtonVisible();
      const navLinks = displayWallPage.page.getByRole('navigation').getByRole('link', { name: 'Dashboard' });
      await expect(navLinks).toHaveCount(0);
    });
  });
});
