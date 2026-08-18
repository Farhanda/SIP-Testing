import { test, expect, apiUrl } from '../fixtures';
import { loadJsonData } from '../../../src/helpers/data';

// Kombinasi keyword x platform (data-driven, port dari eksplorasi 2026-08-18)
const combos = loadJsonData<{ keyword: string; platform: string }[]>('be-dashboard-combos.json');

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

test.describe('Dashboard Summary — parameter lanjutan (data-driven & varian period)', () => {
  // KPI lengkap: 4 kartu metrik + active_platforms + generated_at ISO UTC.
  function expectKpis(body: DashboardSummaryResponse) {
    for (const key of METRIC_KEYS) {
      expect(body.data[key], `data.${key} harus ada`).toBeTruthy();
    }
    expect(body.data.active_platforms).toBeTruthy();
    expect(body.data.active_platforms.total).toBe(3); // x, instagram, tiktok
    expect(body.meta.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
  }

  // Data-driven: satu test per kombinasi keyword x platform (test-data/be-dashboard-combos.json)
  for (const data of combos) {
    test(`summary keyword "${data.keyword}" platform ${data.platform} → 200 & total_post >= 1`, async ({ api }) => {
      const res = await api.get(
        apiUrl(`${SUMMARY_PATH}?keyword=${encodeURIComponent(data.keyword)}&platform=${data.platform}`),
      );
      expect(res.status()).toBe(200);

      const body = (await res.json()) as DashboardSummaryResponse;
      expectKpis(body);
      // Setiap (keyword, platform) di seed dev punya minimal 1 post
      expect(body.data.total_post.value).toBeGreaterThanOrEqual(1);
    });
  }

  test('summary period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${SUMMARY_PATH}?period=7d`));
    expect(res.status()).toBe(200);
    expectKpis((await res.json()) as DashboardSummaryResponse);
  });

  test('summary period=3d → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${SUMMARY_PATH}?period=3d`));
    expect(res.status()).toBe(200);
    expectKpis((await res.json()) as DashboardSummaryResponse);
  });

  test('summary period=1y → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${SUMMARY_PATH}?period=1y`));
    expect(res.status()).toBe(200);
    expectKpis((await res.json()) as DashboardSummaryResponse);
  });

  test('summary period=2026-08-12 (date tunggal) → 200 & ada data', async ({ api }) => {
    // Period tanggal tunggal = window 1 hari [2026-08-12, 2026-08-13)
    const res = await api.get(apiUrl(`${SUMMARY_PATH}?period=2026-08-12`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as DashboardSummaryResponse;
    expectKpis(body);
    expect(body.data.total_post.value).toBeGreaterThanOrEqual(1);
  });

  test('summary period=2026-08-01/2026-08-18 (range) → 200', async ({ api }) => {
    // Custom range [from, to) — setengah terbuka: post di to tidak dihitung
    const res = await api.get(apiUrl(`${SUMMARY_PATH}?period=2026-08-01/2026-08-18`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as DashboardSummaryResponse;
    expectKpis(body);
    expect(body.data.total_post.value).toBeGreaterThanOrEqual(10);
  });

  test('summary platform multi (comma-separated) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${SUMMARY_PATH}?platform=instagram,x`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as DashboardSummaryResponse;
    expectKpis(body);
    expect(body.data.total_post.value).toBeGreaterThanOrEqual(10);
  });

  test('summary period tidak valid → 200 (fallback default 1m)', async ({ api }) => {
    // Kontrak: period malformed fallback ke "1m", BUKAN error 400
    const res = await api.get(apiUrl(`${SUMMARY_PATH}?period=999d`));
    expect(res.status()).toBe(200);
    expectKpis((await res.json()) as DashboardSummaryResponse);
  });

  test('summary platform tidak dikenal → 200 (lenient, tanpa error)', async ({ api }) => {
    // Platform tidak divalidasi: filter tidak cocok → 200 dengan nilai nol
    const res = await api.get(apiUrl(`${SUMMARY_PATH}?platform=facebook`));
    expect(res.status()).toBe(200);
    expectKpis((await res.json()) as DashboardSummaryResponse);
  });

  test('summary keyword tanpa data → 200 dengan nilai nol (bukan 404)', async ({ api }) => {
    // Beda dari mock service lama (yang 404): dashboard-service balas 200 + nol
    const res = await api.get(apiUrl(`${SUMMARY_PATH}?keyword=query_tidak_ada`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as DashboardSummaryResponse;
    expect(body.data.total_post.value).toBe(0);
  });

  test('summary format label KPI konsisten (value ↔ label)', async ({ api }) => {
    const res = await api.get(apiUrl(SUMMARY_PATH));
    expect(res.status()).toBe(200);

    const d = (await res.json() as DashboardSummaryResponse).data;
    // label total_post = integer thousand-grouped ("18", "2,846")
    expect(d.total_post.label).toMatch(/^[\d,]+$/);
    // label views = count / K / M ("2.17M", "1,240")
    expect(d.views.label).toMatch(/^[\d.,]+[KM]?$/);
    // label engagement_rate = persen 2 desimal ("2.78%")
    expect(d.engagement_rate.label).toMatch(/^\d+\.\d{2}%$/);
    // arah delta selalu salah satu dari up/down/flat
    for (const m of [d.total_post, d.total_engagement, d.views, d.engagement_rate]) {
      expect(['up', 'down', 'flat']).toContain(m.delta_direction);
      expect(typeof m.delta_pct).toBe('number');
    }
  });
});
