import { test, expect, scrapeUrl } from '../fixtures';

/**
 * Test POST /v1/scrape — create keyword on-demand (dipakai tab On Demand
 * di halaman Monitoring Keyword FE).
 *
 * Hanya skenario VALIDASI yang diuji langsung ke BE: payload valid akan
 * MENJALANKAN job scraping nyata (kuota provider terpakai) sehingga tidak
 * aman untuk staging. Alur sukses sudah ter-cover via mock di FE.
 */
test.describe('POST /v1/scrape', () => {
  test('body kosong → 400 "platform and keyword are required"', async ({ scrapeApi }) => {
    const res = await scrapeApi.post(scrapeUrl('/v1/scrape'), { data: {} });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.message).toContain('platform and keyword are required');
  });

  test('tanpa body sama sekali → tetap ditolak (bukan 5xx)', async ({ scrapeApi }) => {
    const res = await scrapeApi.post(scrapeUrl('/v1/scrape'));
    // BE wajib menangani payload hilang secara elegan (4xx), bukan crash.
    const status = res.status();
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });
});
