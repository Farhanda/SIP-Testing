import { test, expect, apiUrl } from '../fixtures';

/**
 * Test GET /v2/dashboard/conversation-trend — tren percakapan dashboard v2.
 *
 * Logika interval:
 * - Periode <= 24h: hourly breakdown (meta.interval = "hour", 24 titik)
 * - Periode > 24h: daily breakdown (meta.interval = "day")
 *
 * Kontrak Swagger:
 *   200: { data: [{ date, timestamp, label, count }], meta: { generated_at, interval } }
 */
test.describe('GET /v2/dashboard/conversation-trend (v2)', () => {
  test('TC-V2-TRD-01: request default menghasilkan tren harian (meta.interval = "day")', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/conversation-trend'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    expect(body.meta.interval).toBe('day');
    expect(typeof body.meta.generated_at).toBe('string');

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('TC-V2-TRD-02: validasi skema data pada setiap titik tren', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/conversation-trend'));
    const body = await res.json();

    for (const point of body.data) {
      expect(typeof point.date).toBe('string');
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      expect(typeof point.timestamp).toBe('string');
      expect(new Date(point.timestamp).toString()).not.toBe('Invalid Date');

      expect(typeof point.label).toBe('string');
      expect(point.label.length).toBeGreaterThan(0);

      expect(typeof point.count).toBe('number');
      expect(point.count).toBeGreaterThanOrEqual(0);
    }
  });

  test('TC-V2-TRD-03: periode 24h menghasilkan breakdown per jam (meta.interval = "hour", 24 titik)', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/conversation-trend'), {
      params: { period: '24h' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.interval).toBe('hour');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(24);

    // Label berupa format jam seperti "08:00"
    expect(body.data[0].label).toMatch(/^\d{2}:\d{2}$/);
  });

  test('TC-V2-TRD-04: periode 7d menghasilkan breakdown harian (meta.interval = "day")', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/conversation-trend'), {
      params: { period: '7d' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.interval).toBe('day');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(7);
  });

  test('TC-V2-TRD-05: custom date range (2026-09-01/2026-09-07) mengembalikan tepat 7 hari', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/conversation-trend'), {
      params: { period: '2026-09-01/2026-09-07' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.interval).toBe('day');
    expect(body.data.length).toBe(7);

    expect(body.data[0].date).toBe('2026-09-01');
    expect(body.data[body.data.length - 1].date).toBe('2026-09-07');
  });

  test('TC-V2-TRD-06: filter platform mengembalikan tren spesifik platform', async ({ api }) => {
    for (const plat of ['x', 'tiktok', 'instagram']) {
      const res = await api.get(apiUrl('/v2/dashboard/conversation-trend'), {
        params: { platform: plat, period: '7d' },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.length).toBeGreaterThan(0);
      for (const p of body.data) {
        expect(p.count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('TC-V2-TRD-07: format periode tidak valid jatuh ke fallback default 1 bulan secara aman', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/conversation-trend'), {
      params: { period: 'format_salah_tidak_dikenal' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.interval).toBe('day');
    expect(body.data.length).toBeGreaterThanOrEqual(28);
  });
});

