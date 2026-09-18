import { test, expect, apiUrl } from '../fixtures';

/**
 * Test GET /v2/dashboard/sentiment — distribusi sentimen percakapan v2.
 *
 * Kontrak Swagger:
 *   200: {
 *     data: {
 *       total: number,
 *       total_label: string,
 *       classified_total: number,
 *       categories: [{ sentiment: string, pct: number, total: number, color: string }]
 *     },
 *     meta: { generated_at: string }
 *   }
 */
test.describe('GET /v2/dashboard/sentiment (v2)', () => {
  test('TC-V2-SNT-01: request default mengembalikan HTTP 200 dengan struktur sentimen lengkap', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/sentiment'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    const { total, total_label, classified_total, categories } = body.data;
    expect(typeof total).toBe('number');
    expect(total).toBeGreaterThanOrEqual(0);
    expect(typeof total_label).toBe('string');
    expect(typeof classified_total).toBe('number');
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThanOrEqual(3);
  });

  test('TC-V2-SNT-02: invariant matematika — classified_total, akumulasi total kategori, dan persentase', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/sentiment'));
    const body = await res.json();
    const { total, classified_total, categories } = body.data;

    // Post terklasifikasi tidak boleh melebihi total keseluruhan post
    expect(classified_total).toBeLessThanOrEqual(total);

    // Penjumlahan total post di ketiga kategori harus sama persis dengan classified_total
    const sumCategoriesTotal = categories.reduce((acc: number, c: { total: number }) => acc + c.total, 0);
    expect(sumCategoriesTotal).toBe(classified_total);

    // Penjumlahan persentase kategori harus bernilai 100% (dengan toleransi pembulatan integer ±1%)
    const sumCategoriesPct = categories.reduce((acc: number, c: { pct: number }) => acc + c.pct, 0);
    expect(sumCategoriesPct).toBeGreaterThanOrEqual(99);
    expect(sumCategoriesPct).toBeLessThanOrEqual(101);
  });

  test('TC-V2-SNT-03: validasi kategori sentimen standar (positive, neutral, negative) dan kode warna', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/sentiment'));
    const body = await res.json();
    const { categories } = body.data;

    const sentiments = categories.map((c: { sentiment: string }) => c.sentiment);
    for (const expected of ['positive', 'neutral', 'negative']) {
      expect(sentiments).toContain(expected);
    }

    // Setiap kategori memiliki format warna HEX yang valid
    for (const c of categories) {
      expect(typeof c.color).toBe('string');
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.pct).toBeGreaterThanOrEqual(0);
      expect(c.total).toBeGreaterThanOrEqual(0);
    }
  });

  test('TC-V2-SNT-04: filter platform mematuhi invariant sentimen', async ({ api }) => {
    for (const plat of ['x', 'tiktok', 'instagram']) {
      const res = await api.get(apiUrl('/v2/dashboard/sentiment'), {
        params: { platform: plat },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      const { classified_total, categories } = body.data;
      const sumTotal = categories.reduce((acc: number, c: { total: number }) => acc + c.total, 0);
      expect(sumTotal).toBe(classified_total);
    }
  });

  test('TC-V2-SNT-05: filter periode mematuhi struktur data sentimen', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/sentiment'), {
      params: { period: '7d' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.total).toBeGreaterThanOrEqual(0);
    expect(body.data.classified_total).toBeGreaterThanOrEqual(0);
  });
});

