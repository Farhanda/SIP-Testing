import { test, expect, apiUrl } from '../fixtures';

/**
 * Test GET /v2/dashboard/keywords — Data Collection Monitor (v2).
 *
 * Query Parameters:
 * - search: Filter teks kata kunci (case-insensitive).
 * - status: Filter status keyword ('ACTIVE' | 'INACTIVE').
 * - platform: Filter platform yang dipantau ('x' | 'instagram' | 'tiktok').
 * - page: Nomor halaman (1-based, out-of-range di-clamp, meta.page melaporkan halaman aktual).
 * - limit: Batas keyword per halaman (default 10).
 *
 * Kontrak Swagger:
 *   200: {
 *     data: [
 *       {
 *         id: string,
 *         keyword: string,
 *         status: 'ACTIVE' | 'INACTIVE',
 *         schedule: { enabled, value, unit, label, next_run_at },
 *         last_run_at: string | null,
 *         platforms: [
 *           {
 *             platform: 'instagram' | 'tiktok' | 'x',
 *             status: 'COMPLETED' | 'FAILED' | '',
 *             last_run_at: string | null,
 *             posts: { value, label, change, change_pct },
 *             views: { value, label, change, change_pct },
 *             engagement: { value, label, change, change_pct },
 *             recent_runs: [{ run_at, status, posts }]
 *           }
 *         ]
 *       }
 *     ],
 *     meta: { generated_at, total, page, limit, total_pages }
 *   }
 */
test.describe('GET /v2/dashboard/keywords (v2)', () => {
  test('TC-V2-KW-01: request default mengembalikan HTTP 200 dengan struktur keyword monitor lengkap', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/keywords'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.length).toBeLessThanOrEqual(10);

    // Validasi metadata paginasi
    expect(typeof body.meta.total).toBe('number');
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(10);
    expect(body.meta.total_pages).toBeGreaterThanOrEqual(1);

    // Validasi struktur item keyword
    const item = body.data[0];
    expect(typeof item.id).toBe('string');
    expect(typeof item.keyword).toBe('string');
    expect(['ACTIVE', 'INACTIVE']).toContain(item.status);
    expect(item).toHaveProperty('schedule');
    expect(typeof item.schedule.enabled).toBe('boolean');
    expect(item).toHaveProperty('platforms');
    expect(Array.isArray(item.platforms)).toBe(true);
  });

  test('TC-V2-KW-02: filter status=ACTIVE hanya mengembalikan keyword berstatus ACTIVE', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/keywords'), {
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

  test('TC-V2-KW-03: filter status=INACTIVE hanya mengembalikan keyword berstatus INACTIVE', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/keywords'), {
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

  test('TC-V2-KW-04: filter status case-insensitive (misal "active" huruf kecil)', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/keywords'), {
      params: { status: 'active' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const item of body.data) {
      expect(item.status).toBe('ACTIVE');
    }
  });

  test('TC-V2-KW-05: filter platform menyaring keyword yang memantau platform terkait (tiktok, x, instagram)', async ({ api }) => {
    for (const plat of ['tiktok', 'x', 'instagram']) {
      const res = await api.get(apiUrl('/v2/dashboard/keywords'), {
        params: { platform: plat },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.meta.total).toBeGreaterThan(0);
      expect(body.data.length).toBeGreaterThan(0);
    }
  });

  test('TC-V2-KW-06: parameter search mencari keyword teks secara case-insensitive', async ({ api }) => {
    const resUpper = await api.get(apiUrl('/v2/dashboard/keywords'), {
      params: { search: 'APBN' },
    });
    expect(resUpper.status()).toBe(200);
    const bodyUpper = await resUpper.json();
    expect(bodyUpper.meta.total).toBe(1);
    expect(bodyUpper.data[0].keyword).toBe('APBN');

    const resLower = await api.get(apiUrl('/v2/dashboard/keywords'), {
      params: { search: 'apbn' },
    });
    expect(resLower.status()).toBe(200);
    const bodyLower = await resLower.json();
    expect(bodyLower.meta.total).toBe(1);
    expect(bodyLower.data[0].keyword).toBe('APBN');
  });

  test('TC-V2-KW-07: paginasi page dan limit berfungsi serta out-of-range page di-clamp', async ({ api }) => {
    const resPage2 = await api.get(apiUrl('/v2/dashboard/keywords'), {
      params: { page: 2, limit: 5 },
    });
    expect(resPage2.status()).toBe(200);
    const bodyPage2 = await resPage2.json();
    expect(bodyPage2.meta.page).toBe(2);
    expect(bodyPage2.meta.limit).toBe(5);
    expect(bodyPage2.data.length).toBe(5);

    // Clamping: jika page jauh melampaui batas (misal 999), page di-clamp ke total_pages
    const resHugePage = await api.get(apiUrl('/v2/dashboard/keywords'), {
      params: { page: 999, limit: 10 },
    });
    expect(resHugePage.status()).toBe(200);
    const bodyHuge = await resHugePage.json();
    expect(bodyHuge.meta.page).toBe(bodyHuge.meta.total_pages);
  });

  test('TC-V2-KW-08: struktur schedule keyword memiliki properti enabled, value, unit, dan label', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/keywords'), {
      params: { limit: 10 },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    for (const item of body.data) {
      expect(typeof item.schedule.enabled).toBe('boolean');
      expect(typeof item.schedule.label).toBe('string');
      if (item.schedule.enabled) {
        expect(typeof item.schedule.value).toBe('number');
        expect(typeof item.schedule.unit).toBe('string');
      }
    }
  });

  test('TC-V2-KW-09: struktur metrics platform (posts, views, engagement) memuat value, label, change, change_pct', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/keywords'), {
      params: { search: 'APBN' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);

    const apbn = body.data[0];
    expect(apbn.platforms.length).toBeGreaterThanOrEqual(1);

    for (const p of apbn.platforms) {
      expect(['instagram', 'tiktok', 'x']).toContain(p.platform);
      expect(typeof p.posts.value).toBe('number');
      expect(typeof p.posts.label).toBe('string');
      expect(typeof p.posts.change).toBe('number');

      expect(typeof p.views.value).toBe('number');
      expect(typeof p.views.label).toBe('string');
      expect(typeof p.views.change).toBe('number');

      expect(typeof p.engagement.value).toBe('number');
      expect(typeof p.engagement.label).toBe('string');
      expect(typeof p.engagement.change).toBe('number');

      expect(Array.isArray(p.recent_runs)).toBe(true);
      for (const run of p.recent_runs) {
        expect(typeof run.run_at).toBe('string');
        expect(typeof run.status).toBe('string');
        expect(typeof run.posts).toBe('number');
      }
    }
  });

  test('TC-V2-KW-10: query parameter dengan null byte (%00) menghasilkan HTTP 400 Bad Request', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/keywords?search=%00'));
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error.code).toBe('invalid_request');
    expect(body.error.message).toContain('null');
  });

  test('TC-V2-KW-11: filter status invalid menghasilkan HTTP 200 dengan data kosong (total 0)', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/keywords'), {
      params: { status: 'INVALID_STATUS_XYZ' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.total).toBe(0);
    expect(body.data).toEqual([]);
  });

  test('TC-V2-KW-12: method tidak didukung (POST) ditolak dengan 404/405', async ({ api }) => {
    const res = await api.post(apiUrl('/v2/dashboard/keywords'));
    expect([404, 405]).toContain(res.status());
  });

  test('TC-V2-KW-13: filter overall_status (COMPLETED, FAILED, PARTIALLY COMPLETED) menyaring hasil run gabungan platform', async ({ api }) => {
    for (const st of ['COMPLETED', 'FAILED', 'PARTIALLY COMPLETED', 'PARTIALLY_COMPLETED']) {
      const res = await api.get(apiUrl('/v2/dashboard/keywords'), {
        params: { overall_status: st },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('meta');
      expect(typeof body.meta.total).toBe('number');
      expect(body.meta.total).toBeGreaterThan(0);
      expect(Array.isArray(body.data)).toBe(true);
    }
  });
});

