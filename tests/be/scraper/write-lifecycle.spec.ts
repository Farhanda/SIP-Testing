import { test, expect, scraperUrl } from '../fixtures';

/**
 * Write lifecycle Scraper Service API (BASE_URL_SCRAPER :8090).
 *
 * Audit write lifecycle 2026-09-02 (probe langsung):
 *
 *   ▸ POST /v1/keyword-management  → 201 SELALU (tanpa unique constraint;
 *     POST duplikat "RUU Digital" pun 201 + insert baris baru)
 *   ▸ POST /v1/credential          → 201 (sama, tanpa dedupe)
 *   ▸ DELETE                        → TIDAK ADA di service manapun (8090
 *     maupun gateway 8080; DELETE langsung → 404 page not found)
 *
 * Konsekuensi: **test create sukses sengaja TIDAK ditulis** — tanpa DELETE,
 * tiap create mencemari staging secara PERMANEN dan tidak bisa dibersihkan
 * via API (terbukti nyata saat audit: duplikat "RUU Digital" + 1 credential
 * qa-write-probe tertinggal di staging, sudah di-deactivate untuk
 * mengendalikan efek samping scraper).
 *
 * Yang DIUJI di sini hanyalah pola yang aman & reversibel:
 *   1. PUT id tak dikenal → 404 (tanpa efek samping)
 *   2. PUT keyword-management round-trip — simpan state asli, modifikasi
 *      (period), verifikasi perubahan, lalu RESTORE persis di finally
 *   3. PATCH activate/deactivate round-trip — toggle state lalu restore
 *      di finally (pola identik dengan toggle credential TC-BE-SR11)
 */

const UNKNOWN_UUID = '00000000-0000-0000-0000-000000000000';

test.describe('Write lifecycle (aman & reversibel) — Scraper Service API', () => {
  test('PUT keyword-management id tak dikenal → 404 keyword_not_found', async ({ scraperApi }) => {
    const res = await scraperApi.put(scraperUrl(`/v1/keyword-management/${UNKNOWN_UUID}`), {
      data: { keyword: 'X', platforms: ['instagram'] },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('keyword_not_found');
    expect(typeof body.error.message).toBe('string');
  });

  test('PUT credential id tak dikenal → 404 credential_not_found', async ({ scraperApi }) => {
    const res = await scraperApi.put(scraperUrl(`/v1/credential/${UNKNOWN_UUID}`), {
      data: { name: 'x', platform: 'tiktok', mode: 'live', priority: 1, req_per_second: 1, req_per_month: 10, enabled: false },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('credential_not_found');
    expect(typeof body.error.message).toBe('string');
  });

  test('PUT keyword-management round-trip: modifikasi period lalu restore persis', async ({ scraperApi }) => {
    // Pilih keyword on-demand (schedule_enabled=false) — tanpa jadwal,
    // jadi modifikasi konfigurasi tidak memicu job scraping.
    const listRes = await scraperApi.get(scraperUrl('/v1/keyword-management?schedule_enabled=false&page=1&size=10'));
    expect(listRes.status()).toBe(200);
    const items = (await listRes.json()).data;
    expect(items.length).toBeGreaterThan(0);
    const id = items[0].id;

    // State asli (period + schedule) yang harus dikembalikan
    const getRes = await scraperApi.get(scraperUrl(`/v1/keyword-management/${id}`));
    expect(getRes.status()).toBe(200);
    const original = (await getRes.json()).data;
    expect(original.period).toBeTruthy();

    const mutatePeriod = original.period === 'ALL' ? '7d' : 'ALL';
    const payload = (period: string) => ({
      keyword: original.keyword,
      platforms: original.platforms,
      period,
      schedule_enabled: original.schedule_enabled,
      schedule: original.schedule,
    });

    try {
      // Modifikasi → period harus berubah & tercermin di GET berikutnya
      const putRes = await scraperApi.put(scraperUrl(`/v1/keyword-management/${id}`), { data: payload(mutatePeriod) });
      expect(putRes.status()).toBe(200);

      const after = (await (await scraperApi.get(scraperUrl(`/v1/keyword-management/${id}`))).json()).data;
      expect(after.period.toUpperCase()).toBe(mutatePeriod.toUpperCase());
      // Field lain tidak boleh berubah
      expect(after.keyword).toBe(original.keyword);
      expect(after.schedule_enabled).toBe(original.schedule_enabled);
      expect(after.platforms.sort()).toEqual([...original.platforms].sort());
    } finally {
      // RESTORE — selalu dieksekusi walau assertion di atas gagal
      const restore = await scraperApi.put(scraperUrl(`/v1/keyword-management/${id}`), { data: payload(original.period) });
      expect(restore.status()).toBe(200);
      const restored = (await (await scraperApi.get(scraperUrl(`/v1/keyword-management/${id}`))).json()).data;
      expect(restored.period.toUpperCase()).toBe(original.period.toUpperCase());
    }
  });

  test('PATCH keyword activate/deactivate round-trip: state berubah lalu dikembalikan', async ({ scraperApi }) => {
    // Pilih keyword schedule_enabled=false; toggle statusnya lalu restore
    // di finally (mirip pola toggle credential TC-BE-SR11).
    const listRes = await scraperApi.get(scraperUrl('/v1/keyword-management?schedule_enabled=false&page=1&size=10'));
    expect(listRes.status()).toBe(200);
    const items = (await listRes.json()).data;
    expect(items.length).toBeGreaterThan(0);
    const id = items[0].id;
    const original = items[0].status; // ACTIVE | INACTIVE
    const flip = original === 'ACTIVE' ? 'deactivate' : 'activate';
    const restoreAction = original === 'ACTIVE' ? 'activate' : 'deactivate';

    try {
      const res = await scraperApi.patch(scraperUrl(`/v1/keyword-management/${id}/${flip}`));
      expect(res.status()).toBe(200);
      const flipped = (await (await scraperApi.get(scraperUrl(`/v1/keyword-management/${id}`))).json()).data;
      expect(flipped.status).not.toBe(original);
    } finally {
      const restore = await scraperApi.patch(scraperUrl(`/v1/keyword-management/${id}/${restoreAction}`));
      expect(restore.status()).toBe(200);
      const restored = (await (await scraperApi.get(scraperUrl(`/v1/keyword-management/${id}`))).json()).data;
      expect(restored.status).toBe(original);
    }
  });
});