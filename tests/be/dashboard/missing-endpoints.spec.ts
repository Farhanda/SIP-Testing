import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — GAP: endpoint yang DIPANGGIL FE dashboard tapi BELUM
 * ada di dashboard-service (Go, port 8080).
 *
 * Audit integrasi FE↔BE 2026-08-18: sejak FE di-integrasikan langsung ke
 * dashboard-service (`env.dashboardApiUrl = http://localhost:8080/v1/dashboard`),
 * halaman dashboard memanggil 5 endpoint ini — tetapi TIDAK terdaftar di
 * router Go (`internal/bootstrap/http.go`) sehingga saat ini balas 404.
 *
 *   Endpoint (dipanggil src/services/dashboard.ts)   Status saat ini
 *   ----------------------------------------------------------------
 *   /v1/dashboard/trending-topic?period=24H|7D        404 (FE: trending topic gagal)
 *   /v1/dashboard/emotion-map                          404 (FE: kartu Emotion map error)
 *   /v1/dashboard/sentiment-map                        404 (FE: kartu Sentiment map error)
 *   /v1/dashboard/sentiment-trend                      404 (FE: kartu Sentiment trend error)
 *   /v1/dashboard/sentiment-trend-hourly               404 (FE: detail hourly error)
 *
 * Konsekuensi di FE: kartu tersebut menampilkan error state
 * ("Failed to load ...") — terlihat di dashboard localhost:3000.
 *
 * Test di bawah MENDOKUMENTASIKAN gap tersebut: ekspektasi saat ini 404
 * (respons wajar, bukan hang/500). Begitu endpoint diimplementasikan di Go,
 * test ini HARUS diperbarui ke ekspektasi 200 + struktur respons agar tetap
 * menjadi regression guard. Kontrak yang diharapkan FE (lihat
 * src/types/dashboard.ts di Front-End):
 *   - trending-topic     → { data: [{ id, topic, volume, delta }], meta: { period, total, generated_at } }
 *   - emotion-map        → { data: { anger, neutral, fear, joy, sadness }, meta }
 *   - sentiment-map      → { data: { positive, neutral, negative }, meta }
 *   - sentiment-trend    → { data: [{ date, label, positive, negative }], meta }
 *   - sentiment-trend-hourly → { data: [{ hour, label, positive, negative }], meta: { date } }
 */

const GAP_ENDPOINTS = [
  {
    path: '/v1/dashboard/trending-topic?period=7D',
    label: 'trending-topic',
    expectedShape: '{ data: [{ id, topic, volume, delta }], meta: { period, total, generated_at } }',
  },
  {
    path: '/v1/dashboard/emotion-map?keyword=layanan-publik&period=7d',
    label: 'emotion-map',
    expectedShape: '{ data: { anger, neutral, fear, joy, sadness }, meta: { generated_at } }',
  },
  {
    path: '/v1/dashboard/sentiment-map?keyword=layanan-publik&period=7d',
    label: 'sentiment-map',
    expectedShape: '{ data: { positive, neutral, negative }, meta: { generated_at } }',
  },
  {
    path: '/v1/dashboard/sentiment-trend?keyword=layanan-publik&period=7d',
    label: 'sentiment-trend',
    expectedShape: '{ data: [{ date, label, positive, negative }], meta: { generated_at } }',
  },
  {
    path: '/v1/dashboard/sentiment-trend-hourly?keyword=layanan-publik&period=7d&date=2026-08-18',
    label: 'sentiment-trend-hourly',
    expectedShape: '{ data: [{ hour, label, positive, negative }], meta: { generated_at, date } }',
  },
];

test.describe('Dashboard — GAP endpoint (dipanggil FE, belum ada di Go service)', () => {
  for (const ep of GAP_ENDPOINTS) {
    test(`GET ${ep.path.split('?')[0]} → 404 (endpoint belum diimplementasikan di Go)`, async ({ api }) => {
      // ⚠️ Gap dokumentasi: FE memanggil endpoint ini; Go belum punya router-nya.
      // Ekspektasi saat ini = 404 (respons wajar, bukan hang/500).
      const res = await api.get(apiUrl(ep.path));
      expect(res.status()).toBe(404);

      // Body 404 Go saat ini: plain text "404 page not found" — bukan JSON error.
      const text = await res.text();
      expect(text).toContain('404');
    });
  }

  test('semua endpoint GAP konsisten: 404 tanpa hang (respons cepat, bukan 500)', async ({ api }) => {
    // Satu test agregat sebagai smoke — memastikan 5 endpoint GAP semuanya
    // 404 dengan cepat (tidak ada yang hang / crash ke 500).
    for (const ep of GAP_ENDPOINTS) {
      const started = Date.now();
      const res = await api.get(apiUrl(ep.path));
      expect(res.status(), `${ep.label} harus 404`).toBe(404);
      expect(Date.now() - started, `${ep.label} harus merespons cepat`).toBeLessThan(5000);
    }
  });

  test('trending-topic tanpa param period → 404 (belum ada; kontrak FE: default 24H)', async ({ api }) => {
    // FE selalu mengirim period ('24H' | '7D'); tanpa param pun endpoint ini
    // belum ada di Go → tetap 404 sampai diimplementasikan.
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic'));
    expect(res.status()).toBe(404);
  });
});
