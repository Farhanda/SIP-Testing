import { test, expect, scrapeUrl } from '../fixtures';

/**
 * Test GET /v1/scrape/platform — daftar platform yang didukung scraper.
 *
 * Struktur respons (diverifikasi live 2026-08-24):
 *   { data: [{ platform: "instagram", platform_name: "Instagram" }, ...],
 *     meta: null }
 * Slug platform inilah yang dipakai sebagai nilai filter platform di
 * endpoint lain (keyword-management, credential).
 */
test.describe('GET /v1/scrape/platform', () => {
  test('→ 200 dengan minimal Instagram/TikTok/Twitter-X & nama labelnya', async ({ scrapeApi }) => {
    const res = await scrapeApi.get(scrapeUrl('/v1/scrape/platform'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(3);

    const slugs = body.data.map((p: { platform: string }) => p.platform);
    for (const expected of ['instagram', 'tiktok', 'twitter_x']) {
      expect(slugs).toContain(expected);
    }

    // Tiap item punya label tampilan
    for (const p of body.data) {
      expect(typeof p.platform_name).toBe('string');
      expect(p.platform_name.length).toBeGreaterThan(0);
    }
  });
});
