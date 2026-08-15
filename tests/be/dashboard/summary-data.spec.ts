import { test, expect, apiUrl } from '../fixtures';
import { loadJsonData } from '../../../src/helpers/data';

/**
 * Data-driven test untuk data DASHBOARD SUMMARY yang SUDAH TERISI di BE.
 *
 * Data keyword ada di `test-data/be-dashboard-keywords.json` — tambah/ubah
 * baris di sana tanpa mengubah kode test (pola sama dengan FE):
 *   { "keyword": "nama-keyword", "expectedTotalPosts": 9 }
 * - `keyword`            : WAJIB (slug keyword yang difilter ke ?keyword=).
 * - `expectedTotalPosts` : OPSIONAL — jumlah post yang sudah terverifikasi.
 *   Kosongkan bila belum tahu jumlahnya; test hanya memastikan data terisi
 *   (total_post > 0). Isi angkanya setelah diverifikasi untuk assert presisi.
 */
interface BeDashboardKeyword {
  keyword: string;
  expectedTotalPosts?: number;
}

const keywords = loadJsonData<BeDashboardKeyword[]>('be-dashboard-keywords.json');
// Total post keyword yang sudah terverifikasi (angka pasti).
const knownTotal = keywords.reduce((sum, k) => sum + (k.expectedTotalPosts ?? 0), 0);
// True bila semua keyword punya angka pasti → bisa assert kesetaraan agregat.
const allKnown = keywords.length > 0 && keywords.every((k) => k.expectedTotalPosts !== undefined);

test.describe('Dashboard Summary — data BE (data-driven)', () => {
  test('GET /v1/dashboard/summary tanpa filter → total_post sesuai jumlah seluruh keyword di data', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/summary'));
    expect(res.status()).toBe(200);
    const body = await res.json();

    // Konsistensi agregat: total tanpa filter ≥ jumlah post keyword yang
    // terverifikasi; == bila semua keyword punya angka pasti.
    expect(body.data.total_post.value).toBeGreaterThanOrEqual(knownTotal);
    if (allKnown) {
      expect(body.data.total_post.value).toBe(knownTotal);
      expect(body.data.total_post.label).toBe(String(knownTotal));
    }

    // Data benar-benar terisi (bukan nol semua).
    expect(body.data.total_engagement.value).toBeGreaterThan(0);
    expect(body.data.views.value).toBeGreaterThan(0);
    expect(body.data.active_platforms.active).toBeGreaterThan(0);
    expect(body.meta.generated_at).toBeTruthy();
  });

  for (const d of keywords) {
    const suffix = d.expectedTotalPosts !== undefined ? ` & total_post = ${d.expectedTotalPosts}` : '';

    test(`GET /v1/dashboard/summary?keyword=${d.keyword} → 200, data terisi${suffix}`, async ({ api }) => {
      const res = await api.get(apiUrl(`/v1/dashboard/summary?keyword=${encodeURIComponent(d.keyword)}`));
      expect(res.status()).toBe(200);

      const body = await res.json();
      // Data keyword benar-benar terisi di BE (bukan nol).
      expect(body.data.total_post.value).toBeGreaterThan(0);
      expect(body.data.active_platforms.active).toBeGreaterThan(0);

      // Bila angka terverifikasi disediakan → assert presisi.
      if (d.expectedTotalPosts !== undefined) {
        expect(body.data.total_post.value).toBe(d.expectedTotalPosts);
        expect(body.data.total_post.label).toBe(String(d.expectedTotalPosts));
      }
      expect(body.meta.generated_at).toBeTruthy();
    });
  }
});
