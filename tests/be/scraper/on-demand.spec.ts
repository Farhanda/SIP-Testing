import { test, expect, scraperUrl } from '../fixtures';

/**
 * Test /v1/scrape (create on-demand) & /v1/scrape/{id} pada SCRAPER
 * SERVICE RAW (8090) — path polos (api-gateway 8080 memakai /v1/scrape
 * yang sama; host berbeda).
 *
 * Skenario tulis hanya diuji 400/404 (tanpa pencemaran data staging);
 * alur sukses sudah ter-cover via mock FE.
 */
test.describe('POST /v1/scrape (scraper raw)', () => {
  test('POST body kosong → 400 validation_failed (platform & keyword wajib)', async ({ scraperApi }) => {
    const res = await scraperApi.post(scraperUrl('/v1/scrape'), { data: {} });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.message.toLowerCase()).toContain('platform');
    expect(body.error.message.toLowerCase()).toContain('keyword');
  });

  test('GET /v1/scrape/{id} dengan UUID tidak dikenal → 404 (bukan 200/500)', async ({ scraperApi }) => {
    // UUID dengan format valid tapi tidak terdaftar
    const res = await scraperApi.get(scraperUrl('/v1/scrape/00000000-0000-4000-8000-000000000000'));
    expect(res.status()).toBe(404);
  });
});