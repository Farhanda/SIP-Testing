import { test, expect, scraperUrl } from '../fixtures';

/**
 * Test /v1/keyword-management pada SCRAPER SERVICE RAW (8090) — path polos
 * (api-gateway 8080 memakai /v1/scrape/keyword-management; kontrak data sama).
 *
 * Struktur list (diverifikasi live 2026-09-02):
 *   { data: [{ id, keyword, platforms[], period, status ACTIVE|INACTIVE,
 *              source, schedule_enabled, schedule, last_execution_status,
 *              last_execution {status, phase, failure_reason, ...} }],
 *     meta: { page, size, total, total_pages, generated_at } }
 *
 * Skenario tulis hanya diuji 400 (tanpa pencemaran data staging);
 * alur sukses sudah ter-cover via mock FE.
 */
test.describe('GET /v1/keyword-management (scraper raw)', () => {
  test('tanpa filter → 200 dengan kontrak meta pagination & item lengkap', async ({ scraperApi }) => {
    const res = await scraperApi.get(scraperUrl('/v1/keyword-management?page=1&size=10'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.page).toBe(1);
    expect(body.meta.size).toBe(10);
    expect(body.meta.total).toBeGreaterThanOrEqual(0);
    expect(body.meta.total_pages).toBeGreaterThanOrEqual(1);
    expect(body.meta.generated_at).toBeTruthy();

    for (const item of body.data) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.keyword).toBe('string');
      expect(item.keyword.length).toBeGreaterThan(0);
      expect(Array.isArray(item.platforms)).toBe(true);
      expect(['ACTIVE', 'INACTIVE']).toContain(item.status);
      expect(typeof item.schedule_enabled).toBe('boolean');
    }
  });

  test('schedule_enabled=true hanya mengembalikan keyword scheduled', async ({ scraperApi }) => {
    const res = await scraperApi.get(
      scraperUrl('/v1/keyword-management?page=1&size=50&schedule_enabled=true'),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.schedule_enabled).toBe(true);
      expect(item.schedule).toBeTruthy();
    }
  });

  test('schedule_enabled=false hanya mengembalikan keyword on-demand', async ({ scraperApi }) => {
    const res = await scraperApi.get(
      scraperUrl('/v1/keyword-management?page=1&size=50&schedule_enabled=false'),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.schedule_enabled).toBe(false);
    }
  });

  test('filter platform=tiktok → semua item punya platform tiktok', async ({ scraperApi }) => {
    const res = await scraperApi.get(
      scraperUrl('/v1/keyword-management?page=1&size=50&platform=tiktok'),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.platforms).toContain('tiktok');
    }
  });

  test('filter search memfilter berdasarkan substring keyword', async ({ scraperApi }) => {
    const term = 'ruu';
    const res = await scraperApi.get(
      scraperUrl(`/v1/keyword-management?page=1&size=50&search=${term}`),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.keyword.toLowerCase()).toContain(term);
    }
  });

  test('pagination size=1&page=2 → meta mengikuti & data maksimal 1 item', async ({ scraperApi }) => {
    const res = await scraperApi.get(scraperUrl('/v1/keyword-management?page=2&size=1'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.meta.page).toBe(2);
    expect(body.meta.size).toBe(1);
  });

  test('GET /v1/keyword-management/summary → kontrak ringkasan statistik', async ({ scraperApi }) => {
    const res = await scraperApi.get(scraperUrl('/v1/keyword-management/summary'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const d = body.data;
    expect(typeof d.total_keywords).toBe('number');
    expect(typeof d.currently_processing).toBe('number');
    expect(typeof d.completed).toBe('number');
    expect(typeof d.failed_cancelled).toBe('number');
    expect(typeof d.scheduler.enabled).toBe('boolean');
  });

  test('GET /v1/keyword-management/scheduled-holds → 200 & kontrak daftar hold', async ({ scraperApi }) => {
    const res = await scraperApi.get(scraperUrl('/v1/keyword-management/scheduled-holds'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.meta.total).toBe('number');
    expect(body.meta.total).toBeGreaterThanOrEqual(0);
  });

  test('POST body kosong → 400 validation_failed (tanpa membuat data)', async ({ scraperApi }) => {
    const res = await scraperApi.post(scraperUrl('/v1/keyword-management'), { data: {} });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('validation_failed');
  });
});