import { test, expect, apiUrl } from '../fixtures';
import { loadJsonData } from '../../../src/helpers/data';

// Kombinasi keyword x platform (data-driven, port dari eksplorasi 2026-08-18)
const combos = loadJsonData<{ keyword: string; platform: string }[]>('be-dashboard-combos.json');

/**
 * Test API Backend — endpoint baru (ditemukan saat eksplorasi ulang 2026-08-14):
 *
 *   GET {BASE_URL_BE}/v1/dashboard/conversation-trend
 *     ?keyword=<keyword>&platform=<comma-separated>&period=<24h|3d|7d|1m|1y|YYYY-MM-DD|YYYY-MM-DD/YYYY-MM-DD>
 *     → 200 { data: [{ date, label, volume, engagement }], meta: { generated_at } }
 *     → period hilang/salah format → fallback last 1 month (200)
 *
 *   GET {BASE_URL_BE}/v1/dashboard/conversation-trend-hourly
 *     ?keyword=<keyword>&platform=<comma-separated>&date=YYYY-MM-DD (wajib)
 *     → 200 { data: [{ hour, label, volume, engagement }], meta: { generated_at, date } }
 *     → date hilang/salah format → 400 invalid_request
 *
 * Struktur & perilaku diverifikasi langsung ke BE lokal 2026-08-14.
 */

interface TrendPoint {
  date?: string;
  hour?: string;
  label: string;
  volume: number;
  engagement: number;
}

interface TrendResponse {
  data: TrendPoint[];
  meta: { generated_at: string; date?: string };
}

const TREND_PATH = '/v1/dashboard/conversation-trend';
const HOURLY_PATH = '/v1/dashboard/conversation-trend-hourly';
const KNOWN_KEYWORD = 'RUU Digital'; // keyword dengan data di BE (9 post)

/** Validasi poin data trend harian — selalu punya date, label, volume, engagement. */
function expectTrendPoint(point: TrendPoint, index: number) {
  expect(point.date, `data[${index}].date harus ada`).toEqual(expect.any(String));
  expect(point.label, `data[${index}].label harus ada`).toEqual(expect.any(String));
  expect(typeof point.volume, `data[${index}].volume harus number`).toBe('number');
  expect(typeof point.engagement, `data[${index}].engagement harus number`).toBe('number');
}

/** Validasi poin data trend per jam — selalu punya hour, label, volume, engagement. */
function expectHourlyPoint(point: TrendPoint, index: number) {
  expect(point.hour, `data[${index}].hour harus ada`).toEqual(expect.any(String));
  expect(point.label, `data[${index}].label harus ada`).toEqual(expect.any(String));
  expect(typeof point.volume, `data[${index}].volume harus number`).toBe('number');
  expect(typeof point.engagement, `data[${index}].engagement harus number`).toBe('number');
}

test.describe('Dashboard Conversation Trend API', () => {
  test('GET /v1/dashboard/conversation-trend tanpa filter → 200, data terisi & meta.generated_at valid', async ({
    api,
  }) => {
    const res = await api.get(apiUrl(TREND_PATH));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length, 'data harus berisi minimal 1 poin trend').toBeGreaterThan(0);
    expect(body.meta.generated_at).toEqual(expect.any(String));
    expect(Number.isNaN(new Date(body.meta.generated_at).getTime())).toBe(false);

    // Format tanggal poin: YYYY-MM-DD (urutan kronologis tidak diwajibkan,
    // tapi formatnya harus konsisten).
    for (let i = 0; i < body.data.length; i++) {
      expectTrendPoint(body.data[i], i);
      expect(body.data[i].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('GET /v1/dashboard/conversation-trend dengan keyword & period=7d → 200, volume sesuai data BE', async ({
    api,
  }) => {
    const res = await api.get(apiUrl(`${TREND_PATH}?keyword=${KNOWN_KEYWORD}&period=7d`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    // 7d → 7 poin harian (boleh lebih jika boundary tanggal ikut terhitung).
    expect(body.data.length).toBeGreaterThanOrEqual(7);
    expect(body.data.length).toBeLessThanOrEqual(8);

    // Keyword dengan data → setidaknya ada 1 hari bervolume > 0 (diverifikasi
    // 2026-08-08 s/d 2026-08-12 punya volume > 0).
    const totalVolume = body.data.reduce((sum, p) => sum + p.volume, 0);
    expect(totalVolume, `total volume untuk ${KNOWN_KEYWORD} harus > 0`).toBeGreaterThan(0);
  });

  test('GET /v1/dashboard/conversation-trend dengan period tidak valid → 200 (fallback 1 bulan)', async ({ api }) => {
    // Mismatch BE vs Swagger? Swagger tidak menyebut perilaku period invalid.
    // Implementasi aktual: malformed → fallback last 1 month (tetap 200).
    const res = await api.get(apiUrl(`${TREND_PATH}?period=abc`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    // Fallback 1 bulan ≈ 30-31 poin harian.
    expect(body.data.length).toBeGreaterThanOrEqual(28);
    expect(body.data.length).toBeLessThanOrEqual(32);
  });

  test('GET /v1/dashboard/conversation-trend dengan keyword tanpa data → 200, data tetap valid (volume 0)', async ({
    api,
  }) => {
    const res = await api.get(apiUrl(`${TREND_PATH}?keyword=keyword-tidak-ada&period=7d`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    expect(body.data.length).toBeGreaterThan(0);
    // Kontrak tetap valid: semua poin punya volume = 0 (tidak ada data).
    for (let i = 0; i < body.data.length; i++) {
      expectTrendPoint(body.data[i], i);
      expect(body.data[i].volume, `data[${i}].volume harus 0 untuk keyword tanpa data`).toBe(0);
    }
  });

  test('GET /v1/dashboard/conversation-trend dengan platform filter → 200, struktur valid', async ({ api }) => {
    const res = await api.get(apiUrl(`${TREND_PATH}?platform=x&period=7d`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    expect(body.data.length).toBeGreaterThan(0);
    for (let i = 0; i < body.data.length; i++) {
      expectTrendPoint(body.data[i], i);
    }
  });

  test('GET /v1/dashboard/conversation-trend-hourly dengan date → 200, 24 jam & meta.date cocok', async ({ api }) => {
    const date = '2026-08-14';
    const res = await api.get(apiUrl(`${HOURLY_PATH}?date=${date}`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    expect(body.meta.date).toBe(date);
    expect(body.meta.generated_at).toEqual(expect.any(String));

    // Breakdown harian = 24 poin per jam (00:00 s/d 23:00).
    expect(body.data.length, 'harus ada 24 poin per jam').toBe(24);
    for (let i = 0; i < body.data.length; i++) {
      expectHourlyPoint(body.data[i], i);
      expect(body.data[i].hour).toMatch(/^\d{2}$/);
    }
  });

  test('GET /v1/dashboard/conversation-trend-hourly dengan keyword & platform → 200, struktur valid', async ({
    api,
  }) => {
    const res = await api.get(apiUrl(`${HOURLY_PATH}?keyword=${KNOWN_KEYWORD}&platform=x&date=2026-08-11`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    expect(body.data.length).toBe(24);
    for (let i = 0; i < body.data.length; i++) {
      expectHourlyPoint(body.data[i], i);
    }
  });

  test('GET /v1/dashboard/conversation-trend-hourly tanpa date → 400 invalid_request', async ({ api }) => {
    const res = await api.get(apiUrl(HOURLY_PATH));
    expect(res.status()).toBe(400);

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('invalid_request');
    expect(body.error.message).toContain('date is required');
  });

  test('GET /v1/dashboard/conversation-trend-hourly dengan date tidak valid → 400 invalid_request', async ({ api }) => {
    const res = await api.get(apiUrl(`${HOURLY_PATH}?date=abc`));
    expect(res.status()).toBe(400);

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('invalid_request');
    expect(body.error.message).toContain('YYYY-MM-DD');
  });
});

test.describe('Dashboard Conversation Trend — parameter lanjutan (data-driven & varian period)', () => {
  // Data-driven: satu test per kombinasi keyword x platform (test-data/be-dashboard-combos.json)
  for (const data of combos) {
    test(`conversation-trend keyword "${data.keyword}" platform ${data.platform} → 200`, async ({ api }) => {
      const res = await api.get(
        apiUrl(`${TREND_PATH}?keyword=${encodeURIComponent(data.keyword)}&platform=${data.platform}&period=7d`),
      );
      expect(res.status()).toBe(200);

      const body = (await res.json()) as TrendResponse;
      expect(Array.isArray(body.data)).toBe(true);
      for (const point of body.data) expectTrendPoint(point, 0);
    });
  }

  test('conversation-trend period=24h → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TREND_PATH}?period=24h`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    // Window 24 jam selalu menghasilkan 1-2 point (kemarin & hari ini)
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data.length).toBeLessThanOrEqual(2);
  });

  test('conversation-trend period=3d → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TREND_PATH}?period=3d`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data.length).toBeLessThanOrEqual(4);
  });

  test('conversation-trend period=1y → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TREND_PATH}?period=1y`));
    expect(res.status()).toBe(200);

    // Window setahun → deret harian panjang (>= 31 hari)
    expect((await res.json() as TrendResponse).data.length).toBeGreaterThanOrEqual(31);
  });

  test('conversation-trend period=2026-08-12 (date tunggal) → 200 & tepat 1 point', async ({ api }) => {
    // Tanggal tunggal = window 1 hari → deret tepat 1 bucket
    const res = await api.get(apiUrl(`${TREND_PATH}?period=2026-08-12`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].date).toBe('2026-08-12');
    // Seed dev punya 5 post pada 2026-08-12
    expect(body.data[0].volume).toBeGreaterThanOrEqual(1);
  });

  test('conversation-trend period=2026-08-01/2026-08-18 (range) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TREND_PATH}?period=2026-08-01/2026-08-18`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    expect(body.data.length).toBeGreaterThanOrEqual(15);
    for (const point of body.data) expectTrendPoint(point, 0);
  });

  test('conversation-trend platform multi (comma-separated) → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TREND_PATH}?platform=instagram,x`));
    expect(res.status()).toBe(200);
    expect((await res.json() as TrendResponse).data.length).toBeGreaterThan(0);
  });

  test('conversation-trend period=24h + keyword → 200', async ({ api }) => {
    const res = await api.get(apiUrl(`${TREND_PATH}?period=24h&keyword=${KNOWN_KEYWORD}`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data.length).toBeLessThanOrEqual(2);
  });
});

test.describe('Dashboard Conversation Trend Hourly — validasi lanjutan', () => {
  test('conversation-trend-hourly date=7d (relative token) → 400', async ({ api }) => {
    // date wajib SATU tanggal YYYY-MM-DD — token relatif ditolak
    const res = await api.get(apiUrl(`${HOURLY_PATH}?date=7d`));
    expect(res.status()).toBe(400);

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('invalid_request');
  });

  test('conversation-trend-hourly date range → 400', async ({ api }) => {
    // date range (A/B) bukan tanggal tunggal → ditolak
    const res = await api.get(apiUrl(`${HOURLY_PATH}?date=2026-08-01/2026-08-02`));
    expect(res.status()).toBe(400);

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('invalid_request');
  });

  test('conversation-trend-hourly date tanpa data → 200 & 24 point nol', async ({ api }) => {
    // 2026-01-01 jauh sebelum seed → semua bucket 0 (tetap 24 point)
    const res = await api.get(apiUrl(`${HOURLY_PATH}?date=2026-01-01`));
    expect(res.status()).toBe(200);

    const body = (await res.json()) as TrendResponse;
    expect(body.data).toHaveLength(24);
    for (const point of body.data) {
      expect(point.volume).toBe(0);
      expect(point.engagement).toBe(0);
    }
  });
});
