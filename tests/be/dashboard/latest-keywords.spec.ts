import { test, expect, apiUrl } from '../fixtures';

/**
 * Test GET /v2/dashboard/latest-keywords — daftar keyword terdaftar terbaru v2.
 *
 * Query Parameters:
 * - status: Filter berdasarkan status registrasi (e.g. ACTIVE, INACTIVE), case-insensitive.
 * - limit: Batas jumlah keyword (default 10, clamped 1-50).
 *
 * Kontrak Swagger:
 *   200: {
 *     data: [{ id, keyword, status, created_at }],
 *     meta: { generated_at: string }
 *   }
 */
test.describe('GET /v2/dashboard/latest-keywords (v2)', () => {
  test('TC-V2-LKW-01: request default mengembalikan HTTP 200 dengan struktur keyword terdaftar lengkap', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/latest-keywords'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.length).toBeLessThanOrEqual(10);

    for (const item of body.data) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.keyword).toBe('string');
      expect(item.keyword.length).toBeGreaterThan(0);
      expect(['ACTIVE', 'INACTIVE']).toContain(item.status);
      expect(typeof item.created_at).toBe('string');
      expect(new Date(item.created_at).toString()).not.toBe('Invalid Date');
    }
  });

  test('TC-V2-LKW-02: filter status=ACTIVE mengembalikan hanya keyword berstatus ACTIVE', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/latest-keywords'), {
      params: { status: 'ACTIVE' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    for (const item of body.data) {
      expect(item.status).toBe('ACTIVE');
    }
  });

  test('TC-V2-LKW-03: filter status=INACTIVE mengembalikan hanya keyword berstatus INACTIVE', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/latest-keywords'), {
      params: { status: 'INACTIVE' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    for (const item of body.data) {
      expect(item.status).toBe('INACTIVE');
    }
  });

  test('TC-V2-LKW-04: parameter limit mengatur jumlah keyword yang dikembalikan', async ({ api }) => {
    for (const lim of [3, 5]) {
      const res = await api.get(apiUrl('/v2/dashboard/latest-keywords'), {
        params: { limit: lim },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.length).toBeLessThanOrEqual(lim);
    }
  });

  test('TC-V2-LKW-05: filter status case-insensitive (misal "active" huruf kecil)', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/latest-keywords'), {
      params: { status: 'active' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const item of body.data) {
      expect(item.status).toBe('ACTIVE');
    }
  });
});

