import { test, expect, apiUrl } from '../fixtures';

/**
 * Contoh test API Backend (platform BE).
 *
 * Target: endpoint yang sudah berjalan di BE lokal —
 *   GET {BASE_URL_BE}/v1/dashboard/summary
 *
 * Struktur respons (dicek langsung ke BE lokal 2026-08-13):
 * {
 *   data: {
 *     total_post:        { value, label, delta_pct, delta_direction },
 *     total_engagement:  { value, label, delta_pct, delta_direction },
 *     views:             { value, label, delta_pct, delta_direction },
 *     engagement_rate:   { value, label, delta_pct, delta_direction },
 *     active_platforms:  { active, total },
 *   },
 *   meta: { generated_at: "<ISO timestamp>" }
 * }
 *
 * > Endpoint lain (di Swagger) belum aktif — saat sudah jalan, tinggal
 * > tambahkan spec baru di folder ini dengan pola yang sama.
 */

interface MetricCard {
  value: number;
  label: string;
  delta_pct: number;
  delta_direction: string;
}

interface DashboardSummaryResponse {
  data: {
    total_post: MetricCard;
    total_engagement: MetricCard;
    views: MetricCard;
    engagement_rate: MetricCard;
    active_platforms: { active: number; total: number };
  };
  meta: { generated_at: string };
}

const SUMMARY_PATH = '/v1/dashboard/summary';
const METRIC_KEYS = ['total_post', 'total_engagement', 'views', 'engagement_rate'] as const;
const DELTA_DIRECTIONS = ['flat', 'up', 'down'];

test.describe('Dashboard Summary API', () => {
  test('GET /v1/dashboard/summary mengembalikan 200 dengan struktur data & meta', async ({ api }) => {
    const res = await api.get(apiUrl(SUMMARY_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as DashboardSummaryResponse;
    expect(body.data).toBeTruthy();
    expect(body.meta).toBeTruthy();

    // Semua kartu metrik wajib ada.
    for (const key of METRIC_KEYS) {
      expect(body.data[key], `data.${key} harus ada`).toBeTruthy();
    }
    // Timestamp generasi data wajib ada.
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('tiap kartu metrik punya value, label, delta_pct & delta_direction yang valid', async ({ api }) => {
    const res = await api.get(apiUrl(SUMMARY_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as DashboardSummaryResponse;
    for (const key of METRIC_KEYS) {
      const card = body.data[key];
      expect(typeof card.value, `${key}.value harus number`).toBe('number');
      expect(card.label, `${key}.label harus string`).toEqual(expect.any(String));
      expect(typeof card.delta_pct, `${key}.delta_pct harus number`).toBe('number');
      expect(DELTA_DIRECTIONS, `${key}.delta_direction tidak dikenal: ${card.delta_direction}`).toContain(
        card.delta_direction,
      );
    }
  });

  test('active_platforms konsisten: active tidak melebihi total', async ({ api }) => {
    const res = await api.get(apiUrl(SUMMARY_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as DashboardSummaryResponse;
    const { active, total } = body.data.active_platforms;
    expect(active).toBeGreaterThanOrEqual(0);
    expect(total).toBeGreaterThanOrEqual(active);
  });

  test('meta.generated_at berupa timestamp ISO yang valid', async ({ api }) => {
    const res = await api.get(apiUrl(SUMMARY_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as DashboardSummaryResponse;
    const generatedAt = new Date(body.meta.generated_at);
    expect(Number.isNaN(generatedAt.getTime()), `generated_at bukan tanggal valid: ${body.meta.generated_at}`).toBe(
      false,
    );
  });

  test('GET /v1/dashboard/summary dengan keyword → 200 & struktur tetap valid', async ({ api }) => {
    const res = await api.get(apiUrl(`${SUMMARY_PATH}?keyword=test-keyword`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as DashboardSummaryResponse;
    // Struktur tetap sama meski datanya kosong untuk keyword yang tidak ada.
    for (const key of METRIC_KEYS) {
      expect(body.data[key], `data.${key} harus ada`).toBeTruthy();
    }
    expect(body.data.active_platforms).toBeTruthy();
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('GET /v1/dashboard/summary dengan date_from tidak valid → 200 (diabaikan; Swagger: 400)', async ({ api }) => {
    // ⚠️ Mismatch BE vs Swagger: spec mendokumentasikan 400 invalid_request
    //    untuk date_from tidak valid, tapi implementasi saat ini (BE versi
    //    dengan data seed) mengabaikannya dan tetap balas 200.
    const res = await api.get(apiUrl(`${SUMMARY_PATH}?date_from=abc`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as DashboardSummaryResponse;
    // Respons normal: struktur lengkap, bukan error.
    expect(body.data.total_post).toBeTruthy();
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('endpoint yang tidak terdaftar di Swagger mengembalikan 404 (bukan hang/500)', async ({ api }) => {
    // Pastikan path yang tidak ada di Swagger tidak merusak pipeline test
    // (respons 404 yang wajar, bukan hang / 500).
    const res = await api.get(apiUrl('/v1/endpoint-belum-ada'));
    expect(res.status()).toBe(404);
  });
});
