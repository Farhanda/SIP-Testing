import { test, expect, scraperUrl } from '../fixtures';

/**
 * Test GET /v1/keyword — daftar keyword option (scraper service RAW, 8090).
 *
 * Struktur respons (diverifikasi live 2026-09-02):
 *   { data: ["Tes Keyword", ...], meta: { latest: "Tes Keyword" } }
 * `latest` dipakai FE sebagai keyword auto-select default.
 */
test.describe('GET /v1/keyword (scraper raw)', () => {
  test('→ 200 dengan daftar string & meta.latest terisi', async ({ scraperApi }) => {
    const res = await scraperApi.get(scraperUrl('/v1/keyword'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    for (const kw of body.data) {
      expect(typeof kw).toBe('string');
      expect(kw.length).toBeGreaterThan(0);
    }
    expect(typeof body.meta.latest).toBe('string');
    expect(body.meta.latest.length).toBeGreaterThan(0);
  });
});