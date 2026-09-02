import { test, expect, scraperUrl } from '../fixtures';

/**
 * Test GET /v1/platform — daftar platform scraper service RAW (8090).
 * Path polos (tanpa prefix /scrape/ yang dipakai api-gateway 8080).
 *
 * Struktur respons (diverifikasi live 2026-09-02):
 *   { data: [{ platform: "instagram", platform_name: "Instagram" }, ...],
 *     meta: null }
 */
test.describe('GET /v1/platform (scraper raw)', () => {
  test('→ 200 dengan minimal Instagram/TikTok/Twitter-X & nama labelnya', async ({ scraperApi }) => {
    const res = await scraperApi.get(scraperUrl('/v1/platform'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(3);

    const slugs = body.data.map((p: { platform: string }) => p.platform);
    for (const expected of ['instagram', 'tiktok', 'twitter_x']) {
      expect(slugs).toContain(expected);
    }

    for (const p of body.data) {
      expect(typeof p.platform_name).toBe('string');
      expect(p.platform_name.length).toBeGreaterThan(0);
    }
  });
});