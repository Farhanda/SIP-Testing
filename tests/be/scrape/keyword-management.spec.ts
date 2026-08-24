import { test, expect, scrapeUrl } from '../fixtures';

/**
 * Test GET /v1/scrape/keyword-management — daftar keyword (scheduled &
 * on-demand dalam SATU endpoint, dibedakan param schedule_enabled).
 *
 * Struktur respons (diverifikasi live 2026-08-24):
 *   { data: [{ id, keyword, platforms: ["instagram", ...], period,
 *              status: "ACTIVE"|"INACTIVE", source, schedule_enabled,
 *              schedule, created_at, updated_at }],
 *     meta: { page, size, total, total_pages, generated_at } }
 *
 * Endpoint tulis (POST create / PUT update) TIDAK diuji dengan payload
 * valid untuk menghindari pencemaran data staging — hanya skenario
 * validasi 400 yang aman. Alur sukses sudah ter-cover via mock di FE.
 */
test.describe('GET /v1/scrape/keyword-management', () => {
  test('tanpa filter → 200 dengan kontrak meta pagination & item lengkap', async ({ scrapeApi }) => {
    const res = await scrapeApi.get(scrapeUrl('/v1/scrape/keyword-management?page=1&size=10'));
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
      // Platform berupa slug lowercase dari /v1/scrape/platform
      for (const p of item.platforms) {
        expect(['instagram', 'tiktok', 'twitter_x']).toContain(p);
      }
      expect(['ACTIVE', 'INACTIVE']).toContain(item.status);
      expect(typeof item.schedule_enabled).toBe('boolean');
    }
  });

  test('schedule_enabled=true hanya mengembalikan keyword scheduled', async ({ scrapeApi }) => {
    const res = await scrapeApi.get(
      scrapeUrl('/v1/scrape/keyword-management?page=1&size=50&schedule_enabled=true'),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.schedule_enabled).toBe(true);
    }
  });

  test('schedule_enabled=false hanya mengembalikan keyword on-demand', async ({ scrapeApi }) => {
    const res = await scrapeApi.get(
      scrapeUrl('/v1/scrape/keyword-management?page=1&size=50&schedule_enabled=false'),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.schedule_enabled).toBe(false);
    }
  });

  test('filter platform=tiktok → semua item punya platform tiktok', async ({ scrapeApi }) => {
    const res = await scrapeApi.get(
      scrapeUrl('/v1/scrape/keyword-management?page=1&size=50&platform=tiktok'),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.platforms).toContain('tiktok');
    }
  });

  test('filter search memfilter berdasarkan substring keyword', async ({ scrapeApi }) => {
    const term = 'ruu';
    const res = await scrapeApi.get(
      scrapeUrl(`/v1/scrape/keyword-management?page=1&size=50&search=${term}`),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.keyword.toLowerCase()).toContain(term);
    }
  });

  test('pagination size=1&page=2 → meta mengikuti & data maksimal 1 item', async ({ scrapeApi }) => {
    const res = await scrapeApi.get(
      scrapeUrl('/v1/scrape/keyword-management?page=2&size=1'),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.meta.page).toBe(2);
    expect(body.meta.size).toBe(1);
  });

  test('POST body kosong → 400 validation_failed (tanpa membuat data)', async ({ scrapeApi }) => {
    const res = await scrapeApi.post(scrapeUrl('/v1/scrape/keyword-management'), {
      data: {},
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.message).toContain('invalid keyword request');
  });
});
