import { test, expect, apiUrl } from '../fixtures';
import { loadJsonData } from '../../../src/helpers/data';

/**
 * Test GET /v1/dashboard/top-keywords — daftar keyword dengan post terbanyak.
 *
 * Struktur respons (diverifikasi live 2026-08-24):
 *   { data: [{ id, keyword, count }...], meta: { generated_at } }
 * Data diurutkan count descending.
 *
 * Konsistensi lintas-endpoint: count tiap keyword yang dikenal harus sama
 * dengan total_post dari GET /summary?keyword=... (sumber: angka
 * terverifikasi di test-data/be-dashboard-keywords.json).
 */

interface KnownKeyword {
  keyword: string;
  expectedTotalPosts?: number;
}

const keywords = loadJsonData<KnownKeyword[]>('be-dashboard-keywords.json');
const known = keywords.filter((k) => k.expectedTotalPosts !== undefined);

test.describe('GET /v1/dashboard/top-keywords', () => {
  test('tanpa filter → 200, data terisi & item punya kontrak {id, keyword, count}', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-keywords'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.meta.generated_at).toBeTruthy();

    for (const item of body.data) {
      expect(typeof item.keyword).toBe('string');
      expect(item.keyword.length).toBeGreaterThan(0);
      expect(typeof item.count).toBe('number');
      expect(item.count).toBeGreaterThanOrEqual(0);
    }
  });

  test('data diurutkan count descending', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/top-keywords'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const counts = body.data.map((i: { count: number }) => i.count);
    const sorted = [...counts].sort((a: number, b: number) => b - a);
    expect(counts).toEqual(sorted);
  });

  for (const k of known) {
    test(`konsistensi: "${k.keyword}" muncul dengan count = ${k.expectedTotalPosts} (sama dgn summary)`, async ({ api }) => {
      // Tanpa limit hanya ~10 keyword teratas yang dikembalikan — keyword
      // dengan post sedikit bisa tidak masuk. Minta limit cukup besar agar
      // konsistensi lintas-endpoint tetap bisa diverifikasi (2026-09).
      const res = await api.get(apiUrl('/v1/dashboard/top-keywords?limit=100'));
      expect(res.status()).toBe(200);

      const body = await res.json();
      const hit = body.data.find(
        (i: { keyword: string }) => i.keyword.toLowerCase() === k.keyword.toLowerCase(),
      );
      // Keyword yang punya post harus masuk daftar top keywords
      expect(hit, `"${k.keyword}" harus ada di top-keywords`).toBeTruthy();
      // Count harus konsisten dengan total_post di endpoint summary
      expect(hit.count).toBe(k.expectedTotalPosts);
    });
  }
});
