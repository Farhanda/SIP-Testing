import { test, expect, scrapeUrl } from '../fixtures';

/**
 * Health check scrape service / api-gateway (host TERPISAH dari
 * dashboard-service — lihat BASE_URL_SCRAPE).
 *
 * Struktur respons (diverifikasi live 2026-08-24):
 *   { "status": "ok", "service": "api-gateway" }
 */
test.describe('Scrape Service — GET /health', () => {
  test('→ 200 dengan status ok & service api-gateway', async ({ scrapeApi }) => {
    const res = await scrapeApi.get(scrapeUrl('/health'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api-gateway');
  });
});
