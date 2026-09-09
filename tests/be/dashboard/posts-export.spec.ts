import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — GET /v1/dashboard/posts-export
 *
 * Endpoint meng-export data post dashboard sebagai file Excel (.xlsx).
 * Ditambahkan saat eksplorasi ulang dashboard-service 2026-09-09 —
 * sebelumnya NOL coverage (endpoint baru di swagger live).
 *
 * Kontrak aktual (diverifikasi live 2026-09-09, BASE_URL_BE :8091):
 *   GET /v1/dashboard/posts-export?keyword=&platform=&period=
 *   → 200 binary xlsx
 *     Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *     Content-Disposition: attachment; filename="post-<keyword?>-<period>-<YYYYMMDD>.xlsx"
 *     Magic bytes ZIP ("PK") — xlsx adalah zip archive.
 *
 * Perilaku period sama dengan endpoint dashboard lain: token relatif
 * (24h/3d/7d/1m/1y), date tunggal, range, malformed → fallback 1m.
 * Filter keyword/platform mempersempit isi file (ukuran file mengecil).
 *
 * ⚠️ Test ini hanya GET (read-only) — tidak mengubah state service.
 *    Body file TIDAK disimpan ke artefak repo; hanya diverifikasi in-memory.
 */

const EXPORT_PATH = '/v1/dashboard/posts-export';
const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

test.describe('GET /v1/dashboard/posts-export', () => {
  test('tanpa filter → 200 file xlsx (content-type, attachment, magic bytes PK)', async ({ api }) => {
    const res = await api.get(apiUrl(EXPORT_PATH));
    expect(res.status()).toBe(200);

    expect(res.headers()['content-type']).toContain(XLSX_CONTENT_TYPE);
    const disposition = res.headers()['content-disposition'] ?? '';
    expect(disposition).toContain('attachment');
    expect(disposition).toMatch(/filename="post-.*\.xlsx"/);

    // xlsx = zip archive → 2 byte pertama "PK"
    const buf = await res.body();
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 2).toString('ascii')).toBe('PK');
  });

  test('filename default memuat period fallback 1m & tanggal hari ini', async ({ api }) => {
    const res = await api.get(apiUrl(EXPORT_PATH));
    expect(res.status()).toBe(200);

    const disposition = res.headers()['content-disposition'] ?? '';
    // Tanpa period → fallback 1m (kontrak period dashboard-service)
    expect(disposition).toContain('post-1m-');
    // Tanggal generate = hari ini (YYYYMMDD)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    expect(disposition).toContain(today);
  });

  test('keyword + period → 200 & filename memuat keduanya', async ({ api }) => {
    const res = await api.get(apiUrl(`${EXPORT_PATH}?keyword=prabowo&period=7d`));
    expect(res.status()).toBe(200);

    const disposition = res.headers()['content-disposition'] ?? '';
    expect(disposition).toContain('post-prabowo-7d-');
    expect(res.headers()['content-type']).toContain(XLSX_CONTENT_TYPE);
  });

  test('period=24h → 200 & filename memuat 24h', async ({ api }) => {
    const res = await api.get(apiUrl(`${EXPORT_PATH}?period=24h`));
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toContain('post-24h-');
  });

  test('period malformed → 200 & fallback 1m (bukan 400)', async ({ api }) => {
    const res = await api.get(apiUrl(`${EXPORT_PATH}?period=999x`));
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toContain('post-1m-');
  });

  test('platform filter → 200 & file lebih kecil dari tanpa filter', async ({ api }) => {
    const all = await api.get(apiUrl(EXPORT_PATH));
    expect(all.status()).toBe(200);
    const filtered = await api.get(apiUrl(`${EXPORT_PATH}?platform=tiktok`));
    expect(filtered.status()).toBe(200);

    const allBuf = await all.body();
    const filteredBuf = await filtered.body();
    // Filter platform mempersempit data → ukuran file harus lebih kecil
    expect(filteredBuf.length).toBeLessThan(allBuf.length);
    expect(filteredBuf.subarray(0, 2).toString('ascii')).toBe('PK');
  });

  test('keyword tanpa data → 200 file xlsx valid (bukan 404/500)', async ({ api }) => {
    const res = await api.get(apiUrl(`${EXPORT_PATH}?keyword=xyz_tidak_ada`));
    expect(res.status()).toBe(200);

    const buf = await res.body();
    expect(buf.subarray(0, 2).toString('ascii')).toBe('PK');
  });

  test('platform tidak dikenal → 200 (lenient, konsisten endpoint dashboard lain)', async ({ api }) => {
    const res = await api.get(apiUrl(`${EXPORT_PATH}?platform=notexist`));
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain(XLSX_CONTENT_TYPE);
  });
});
