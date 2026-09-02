import { test, expect, scraperUrl } from '../fixtures';

/**
 * Test /v1/credential pada SCRAPER SERVICE RAW (8090) — path polos
 * (api-gateway 8080 memakai /v1/scrape/credential; kontrak data sama).
 *
 * Struktur list (diverifikasi live 2026-09-02):
 *   { data: [{ id, platform, platform_name, name, mode, secret_configured,
 *              enabled, priority, req_per_second, req_per_month, period,
 *              request_count, req_usage, req_usage_percent }],
 *     meta: { page, size, total, total_pages, generated_at } }
 *
 * Tanpa mutasi staging (tulis diuji hanya 400).
 */
test.describe('GET /v1/credential (scraper raw)', () => {
  test('tanpa filter → 200 dengan kontrak item lengkap & meta pagination', async ({ scraperApi }) => {
    const res = await scraperApi.get(scraperUrl('/v1/credential?page=1&size=10'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.page).toBe(1);
    expect(body.meta.total).toBeGreaterThanOrEqual(0);
    expect(body.meta.total_pages).toBeGreaterThanOrEqual(1);

    for (const item of body.data) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.platform).toBe('string');
      expect(typeof item.platform_name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(typeof item.enabled).toBe('boolean');
      expect(typeof item.secret_configured).toBe('boolean');
      expect(typeof item.priority).toBe('number');
      expect(item.req_per_second).toBeGreaterThanOrEqual(0);
      expect(item.req_per_month).toBeGreaterThanOrEqual(0);
      expect(item.req_usage_percent).toBeGreaterThanOrEqual(0);
    }
  });

  test('filter platform=tiktok → semua item platform tiktok', async ({ scraperApi }) => {
    const res = await scraperApi.get(scraperUrl('/v1/credential?page=1&size=50&platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.platform).toBe('tiktok');
    }
  });

  test('filter enabled=true/false → semua item sesuai state', async ({ scraperApi }) => {
    for (const enabled of ['true', 'false']) {
      const res = await scraperApi.get(
        scraperUrl(`/v1/credential?page=1&size=50&enabled=${enabled}`),
      );
      expect(res.status()).toBe(200);

      const body = await res.json();
      for (const item of body.data) {
        expect(String(item.enabled)).toBe(enabled);
      }
    }
  });

  test('filter keyword memfilter berdasarkan substring nama', async ({ scraperApi }) => {
    const res = await scraperApi.get(scraperUrl('/v1/credential?page=1&size=50&keyword=primary'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.name.toLowerCase()).toContain('primary');
    }
  });

  test('POST body kosong → 400 validation_failed (tanpa membuat data)', async ({ scraperApi }) => {
    const res = await scraperApi.post(scraperUrl('/v1/credential'), { data: {} });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('validation_failed');
  });
});