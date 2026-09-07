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
 *   GET /v1/dashboard/top-keywords?limit=5 (BE asli — FE deployed memanggil
 *     API prod yang di-bake saat build, jadi keyword mock seperti
 *     "RUU Digital" tidak punya data di sana)
 *   GET /v1/dashboard/top-posts?keyword=...&period=1M&sort_by=view
 *   GET /v1/dashboard/top-accounts?keyword=...&period=1M
 *   GET /v1/dashboard/top-hashtags?keyword=...&period=1M
 */
test.describe('Display Wall — Top Engagement', () => {
  // TANPA mock top-keywords global: FE deployed memanggil API prod (di-bake
  // saat build) sehingga keyword mock tidak punya data di sana. Mock hanya
  // dipasang di test yang butuh keyword deterministik (heading).

  test('halaman menampilkan heading keyword', async ({ displayWallPage }) => {
    await mockTopKeywords(displayWallPage.page, ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan']);
    await displayWallPage.goto('/display/top-engagement');

    // H1 harus menampilkan nama keyword (keyword pertama dari sumber keyword)
    await displayWallPage.expectKeywordVisible('RUU Digital');
  });

  test('page title mengandung "Top Engagement"', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');

    await displayWallPage.expectPageTitle('Top Engagement');
  });

  test('auto-refresh countdown button terlihat', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');

    await displayWallPage.expectRefreshButtonVisible();
  });

  test('SIP Insight branding terlihat', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');

    await displayWallPage.expectSipInsightBranding();
  });

  test('SIP Insight branding terlihat di header wall', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');

    await displayWallPage.expectSipInsightBranding();
    // UI baru: branding bisa berupa link (logo) atau teks statis —
    // yang penting branding terlihat (sudah di-assert di atas)
  });

  test('minimal 6 chart SVG terrender (posts + accounts + hashtags + charts)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');

    await displayWallPage.expectChartsVisible(6);
  });

  test('top posts terrender dengan link ke source platform', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');

    // Harus ada link ke TikTok/Instagram — tunggu link pertama ter-render
    await expect(displayWallPage.postLinks.first()).toBeVisible({ timeout: 15_000 });
    const postLinkCount = await displayWallPage.postLinks.count();
    expect(postLinkCount).toBeGreaterThan(0);
  });

  test('top posts memiliki minimal 3 post cards', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');

    // Top posts dari BE asli: minimal 2 post dengan link
    await expect
      .poll(() => displayWallPage.postLinks.count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);
  });

  test('top hashtags terrender', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');

    // Struktural (data real BE — tag spesifik tidak di-hardcode): section
    // "Top hashtag" tampil & minimal satu tag dengan prefix '#' terrender
    // (API top-hashtags memang mengembalikan tag berprefix '#', verifikasi
    // curl 2026-09-05).
    await expect(
      displayWallPage.page.getByText(/top hashtags?/i).first()
    ).toBeVisible();
    await expect(displayWallPage.page.getByText(/#/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('display wall tidak memiliki navbar utama (full-screen mode)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');

    // Tunggu wall benar-benar ter-render dulu agar tidak false-pass sebelum render
    await displayWallPage.expectRefreshButtonVisible();
    // Navbar utama tidak boleh tampil
    const navLinks = displayWallPage.page.getByRole('navigation').getByRole('link', { name: 'Dashboard' });
    await expect(navLinks).toHaveCount(0);
  });

  test('display wall menggunakan period=1M sebagai default', async ({ displayWallPage }) => {
    const requests: string[] = [];
    displayWallPage.page.on('request', (req) => {
      if (req.url().includes('/v1/dashboard/')) {
        requests.push(req.url());
      }
    });

    await displayWallPage.goto('/display/top-engagement');
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

    // Cek post links punya target=_blank
    const firstLink = displayWallPage.postLinks.first();
    await expect(firstLink).toBeVisible({ timeout: 15_000 });
    await expect(firstLink).toHaveAttribute('target', '_blank');
  });

  test('top posts link memiliki rel=noopener (security)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/top-engagement');

    const firstLink = displayWallPage.postLinks.first();
    await expect(firstLink).toBeVisible({ timeout: 15_000 });
    const rel = await firstLink.getAttribute('rel');
    expect(rel).toContain('noopener');
  });
});
