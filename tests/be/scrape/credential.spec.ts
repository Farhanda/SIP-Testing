import { test, expect, scrapeUrl } from '../fixtures';

/**
 * Test /v1/scrape/credential — manajemen provider scraping (halaman
 * Provider Management di FE; konsumsi BE langsung).
 *
 * Struktur respons list (diverifikasi live 2026-08-24):
 *   { data: [{ id, platform: "instagram", platform_name, name, mode,
 *              secret_configured, enabled, priority, req_per_second,
 *              req_per_month, period, request_count, req_usage,
 *              req_usage_percent }],
 *     meta: { page, size, total, total_pages, generated_at } }
 *
 * Toggle enable/disable (PATCH /{id}/enable|disable) diuji sebagai
 * ROUND-TRIP: baca state awal → flip → verifikasi → kembalikan ke state
 * awal — aman untuk data staging karena state akhir = state awal.
 */
test.describe('GET /v1/scrape/credential', () => {
  test('tanpa filter → 200 dengan kontrak item lengkap & meta pagination', async ({ scrapeApi }) => {
    const res = await scrapeApi.get(scrapeUrl('/v1/scrape/credential?page=1&size=10'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.page).toBe(1);
    expect(body.meta.total).toBeGreaterThanOrEqual(0);
    expect(body.meta.total_pages).toBeGreaterThanOrEqual(1);

    for (const item of body.data) {
      expect(typeof item.id).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(['instagram', 'tiktok', 'twitter_x']).toContain(item.platform);
      expect(typeof item.enabled).toBe('boolean');
      expect(typeof item.secret_configured).toBe('boolean');
      expect(typeof item.priority).toBe('number');
      expect(item.req_per_second).toBeGreaterThanOrEqual(0);
      expect(item.req_per_month).toBeGreaterThanOrEqual(0);
      expect(item.req_usage_percent).toBeGreaterThanOrEqual(0);
    }
  });

  test('filter platform=tiktok → semua item platform tiktok', async ({ scrapeApi }) => {
    const res = await scrapeApi.get(
      scrapeUrl('/v1/scrape/credential?page=1&size=50&platform=tiktok'),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.platform).toBe('tiktok');
    }
  });

  test('filter enabled=true → semua item aktif; enabled=false → semua nonaktif', async ({ scrapeApi }) => {
    for (const enabled of ['true', 'false']) {
      const res = await scrapeApi.get(
        scrapeUrl(`/v1/scrape/credential?page=1&size=50&enabled=${enabled}`),
      );
      expect(res.status()).toBe(200);

      const body = await res.json();
      for (const item of body.data) {
        expect(String(item.enabled)).toBe(enabled);
      }
    }
  });

  test('filter gabungan platform+enabled konsisten', async ({ scrapeApi }) => {
    const res = await scrapeApi.get(
      scrapeUrl('/v1/scrape/credential?page=1&size=50&platform=tiktok&enabled=true'),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.platform).toBe('tiktok');
      expect(item.enabled).toBe(true);
    }
  });

  test('filter keyword memfilter berdasarkan substring nama', async ({ scrapeApi }) => {
    const res = await scrapeApi.get(scrapeUrl('/v1/scrape/credential?page=1&size=50&keyword=dev'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const item of body.data) {
      expect(item.name.toLowerCase()).toContain('dev');
    }
  });

  test('POST body kosong → 400 validation_failed (tanpa membuat data)', async ({ scrapeApi }) => {
    const res = await scrapeApi.post(scrapeUrl('/v1/scrape/credential'), { data: {} });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.message).toContain('invalid credential request');
  });
});

test.describe('PATCH /v1/scrape/credential/:id/enable|disable', () => {
  test('toggle round-trip: state berubah lalu dikembalikan ke semula', async ({ scrapeApi }) => {
    // Ambil satu provider sebagai target
    const listRes = await scrapeApi.get(scrapeUrl('/v1/scrape/credential?page=1&size=1'));
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    const target = listBody.data[0];
    expect(target).toBeTruthy();

    const original = target.enabled;
    const flipAction = original ? 'disable' : 'enable';

    try {
      // Flip state
      const patchRes = await scrapeApi.patch(
        scrapeUrl(`/v1/scrape/credential/${target.id}/${flipAction}`),
      );
      expect(patchRes.status()).toBe(200);

      // Refetch → state harus sudah berubah
      const afterRes = await scrapeApi.get(scrapeUrl('/v1/scrape/credential?page=1&size=50'));
      const afterBody = await afterRes.json();
      const after = afterBody.data.find((i: { id: string }) => i.id === target.id);
      expect(after.enabled).toBe(!original);
    } finally {
      // SELALU kembalikan ke state awal
      const restoreAction = original ? 'enable' : 'disable';
      const restoreRes = await scrapeApi.patch(
        scrapeUrl(`/v1/scrape/credential/${target.id}/${restoreAction}`),
      );
      expect(restoreRes.status()).toBe(200);

      const verifyRes = await scrapeApi.get(scrapeUrl('/v1/scrape/credential?page=1&size=50'));
      const verifyBody = await verifyRes.json();
      const restored = verifyBody.data.find((i: { id: string }) => i.id === target.id);
      expect(restored.enabled).toBe(original);
    }
  });
});
