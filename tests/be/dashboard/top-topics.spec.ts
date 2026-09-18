import { test, expect, apiUrl } from '../fixtures';

/**
 * Test GET /v2/dashboard/top-topics — topik teratas v2.
 *
 * Query Parameters:
 * - keyword: filter discovered keyword
 * - platform: filter platform
 * - period: relative token, date, custom range, atau "all" (bila "all", trend kosong)
 * - search: pencarian substring label topik
 * - page: nomor halaman (1-based)
 * - limit: jumlah topik per halaman (default 10)
 *
 * Kontrak Swagger:
 *   200: {
 *     data: [{ id, label, rank, count, count_label, sentiment, trend }],
 *     meta: { generated_at: string, total: number, page: number, limit: number, total_pages: number, interval: string }
 *   }
 */
test.describe('GET /v2/dashboard/top-topics (v2)', () => {
  test('TC-V2-TOP-01: request default mengembalikan daftar topik teratas dengan meta lengkap', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-topics'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    const { total, page, limit, total_pages, interval } = body.meta;
    expect(page).toBe(1);
    expect(limit).toBe(10);
    expect(typeof total).toBe('number');
    expect(total).toBeGreaterThan(0);
    expect(total_pages).toBe(Math.ceil(total / limit));
    expect(['day', 'hour']).toContain(interval);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(10);
  });

  test('TC-V2-TOP-02: validasi skema dan invariant sentimen internal pada setiap topik', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-topics'));
    const body = await res.json();

    for (const topic of body.data) {
      expect(typeof topic.id).toBe('string');
      expect(typeof topic.label).toBe('string');
      expect(typeof topic.rank).toBe('number');
      expect(typeof topic.count).toBe('number');
      expect(topic.count).toBeGreaterThanOrEqual(0);
      expect(typeof topic.count_label).toBe('string');

      // Validasi struktur sentimen internal
      const { positive, neutral, negative, classified_total } = topic.sentiment;
      expect(typeof classified_total).toBe('number');

      // Invariant penjumlahan total sentimen = classified_total
      const sumTotal = positive.total + neutral.total + negative.total;
      expect(sumTotal).toBe(classified_total);

      // Invariant penjumlahan persentase sentimen = 100% (±1%)
      if (classified_total > 0) {
        const sumPct = positive.pct + neutral.pct + negative.pct;
        expect(sumPct).toBeGreaterThanOrEqual(99);
        expect(sumPct).toBeLessThanOrEqual(101);
      }
    }
  });

  test('TC-V2-TOP-03: validasi array tren titik waktu di dalam setiap topik', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-topics'));
    const body = await res.json();

    const firstTopic = body.data[0];
    expect(Array.isArray(firstTopic.trend)).toBe(true);
    expect(firstTopic.trend.length).toBeGreaterThan(0);

    for (const point of firstTopic.trend) {
      expect(typeof point.date).toBe('string');
      expect(typeof point.timestamp).toBe('string');
      expect(new Date(point.timestamp).toString()).not.toBe('Invalid Date');
      expect(typeof point.count).toBe('number');
      expect(point.count).toBeGreaterThanOrEqual(0);
    }
  });

  test('TC-V2-TOP-04: kasus khusus period=all menghasilkan array trend kosong sesuai spesifikasi', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-topics'), {
      params: { period: 'all' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const topic of body.data) {
      // Sesuai dokumentasi Swagger: "With all, trend is empty."
      expect(topic.trend).toEqual([]);
    }
  });

  test('TC-V2-TOP-05: pencarian topik dengan search memfilter label topik secara case-insensitive', async ({ api }) => {
    const searchTerm = 'Ekonomi';
    const res = await api.get(apiUrl('/v2/dashboard/top-topics'), {
      params: { search: searchTerm },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    for (const topic of body.data) {
      expect(topic.label.toLowerCase()).toContain(searchTerm.toLowerCase());
      // Rank tetap merupakan rank global distribusi topik
      expect(topic.rank).toBeGreaterThanOrEqual(1);
    }
  });

  test('TC-V2-TOP-06: paginasi topik (page & limit)', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/top-topics'), {
      params: { page: 1, limit: 3 },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(3);
    expect(body.data.length).toBeLessThanOrEqual(3);
  });
});

