import { test, expect, scraperUrl } from '../fixtures';

/**
 * Health check SCRAPER SERVICE RAW (BASE_URL_SCRAPER, default :8090) —
 * service BE KEDUA (backend langsung tanpa prefix /scrape/; berbeda dari
 * api-gateway di BASE_URL_SCRAPE :8080 dan dashboard-service :8091).
 *
 * Struktur respons (diverifikasi live 2026-09-02):
 *   GET /health/live  → { "status": "live" }
 *   GET /health/ready → { "status": "ready" }
 */
test.describe('Scraper Service RAW — /health', () => {
  test('GET /health/live → 200 dengan status live', async ({ scraperApi }) => {
    const res = await scraperApi.get(scraperUrl('/health/live'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('live');
  });

  test('GET /health/ready → 200 dengan status ready', async ({ scraperApi }) => {
    const res = await scraperApi.get(scraperUrl('/health/ready'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ready');
  });
});