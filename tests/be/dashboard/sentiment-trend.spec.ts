import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — /v1/dashboard/sentiment-trend & sentiment-trend-hourly
 *
 * sentiment-trend: data harian positive/negative sentiment volume.
 * sentiment-trend-hourly: breakdown per jam untuk satu hari (24 points).
 *
 * Kontrak Swagger:
 *   GET /v1/dashboard/sentiment-trend?keyword=&platform=&period=
 *   Response: { data: [{ date, label, positive, negative }], meta: { generated_at } }
 *
 *   GET /v1/dashboard/sentiment-trend-hourly?date=YYYY-MM-DD&keyword=&platform=
 *   Response: { data: [{ hour, label, positive, negative }], meta: { generated_at, date } }
 */

test.describe('GET /v1/dashboard/sentiment-trend', () => {
  test('tanpa filter → 200, data berupa array of daily points', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('tiap point punya date, label, positive, negative', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    if (body.data.length > 0) {
      const p = body.data[0];
      expect(typeof p.date).toBe('string');
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof p.label).toBe('string');
      expect(typeof p.positive).toBe('number');
      expect(typeof p.negative).toBe('number');
      expect(p.positive).toBeGreaterThanOrEqual(0);
      expect(p.negative).toBeGreaterThanOrEqual(0);
    }
  });

  test('filter keyword → 200 & struktur valid', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend?keyword=RUU+Digital'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('filter keyword+period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend?keyword=RUU+Digital&period=7d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('filter platform → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend?platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('platform multi (comma-separated) → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend?platform=tiktok,x'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('filter period=7d → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend?period=7d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('filter period=3d → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend?period=3d'));
    expect(res.status()).toBe(200);
  });

  test('filter period=1y → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend?period=1y'));
    expect(res.status()).toBe(200);
  });

  test('period date tunggal (2026-08-12) → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend?period=2026-08-12'));
    expect(res.status()).toBe(200);
  });

  test('period range (2026-08-01/2026-08-18) → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend?period=2026-08-01/2026-08-18'));
    expect(res.status()).toBe(200);
  });

  test('period tidak valid → 200 (fallback default)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend?period=XYZ'));
    expect(res.status()).toBe(200);
  });

  test('keyword tanpa data → 200 dengan data array (bisa kosong)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend?keyword=keyword_tidak_ada_xyz'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

test.describe('GET /v1/dashboard/sentiment-trend-hourly', () => {
  test('date valid → 200, tepat 24 points (jam 00-23)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend-hourly?date=2026-08-20'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(24);
    expect(body.meta.date).toBe('2026-08-20');
    expect(body.meta.generated_at).toBeTruthy();
  });

  test('tiap point punya hour, label, positive, negative', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend-hourly?date=2026-08-20'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const p of body.data) {
      expect(typeof p.hour).toBe('string');
      expect(p.hour).toMatch(/^\d{2}$/);
      expect(typeof p.label).toBe('string');
      expect(p.label).toMatch(/^\d{2}:00$/);
      expect(typeof p.positive).toBe('number');
      expect(typeof p.negative).toBe('number');
    }
  });

  test('tanpa date → 400 (validasi)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend-hourly'));
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('invalid_request');
  });

  test('date tidak valid → 400', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend-hourly?date=abc'));
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('invalid_request');
  });

  test('date format salah (DD-MM-YYYY) → 400', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend-hourly?date=20-08-2026'));
    expect(res.status()).toBe(400);
  });

  test('filter keyword → 200, 24 points', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend-hourly?date=2026-08-20&keyword=RUU+Digital'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(24);
  });

  test('filter platform → 200, 24 points', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend-hourly?date=2026-08-20&platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(24);
  });

  test('date tanpa data → 200 & 24 point nol', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/sentiment-trend-hourly?date=2026-01-01'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(24);
    // Semua point nol
    const totalPosNeg = body.data.reduce((s: number, p: any) => s + p.positive + p.negative, 0);
    expect(totalPosNeg).toBe(0);
  });
});
