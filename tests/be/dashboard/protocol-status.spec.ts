import { test, expect, apiUrl } from '../fixtures';

/**
 * Test GET /v2/dashboard/protocol-status — status protokol (posture) v2.
 *
 * Mengembalikan:
 * - overall: status keseluruhan (status, early_warning, sentimen breakdown, total)
 * - platforms: breakdown status dan share per masing-masing platform
 *
 * Kontrak Swagger:
 *   200: {
 *     data: {
 *       overall: { status, early_warning, positive, neutral, negative, classified_total, total },
 *       platforms: [{ platform, label, share_pct, status, early_warning, positive, neutral, negative, classified_total, total }]
 *     },
 *     meta: { generated_at: string }
 *   }
 */
test.describe('GET /v2/dashboard/protocol-status (v2)', () => {
  test('TC-V2-PRT-01: request default mengembalikan HTTP 200 dengan struktur posture lengkap', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    expect(body.data).toHaveProperty('overall');
    expect(body.data).toHaveProperty('platforms');
    expect(Array.isArray(body.data.platforms)).toBe(true);
    expect(body.data.platforms.length).toBeGreaterThanOrEqual(3);
  });

  test('TC-V2-PRT-02: validasi skema dan invariant pada objek overall', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/protocol-status'));
    const body = await res.json();
    const { overall } = body.data;

    expect(typeof overall.status).toBe('string');
    expect(typeof overall.early_warning).toBe('boolean');
    expect(typeof overall.total).toBe('number');
    expect(typeof overall.classified_total).toBe('number');
    expect(overall.classified_total).toBeLessThanOrEqual(overall.total);

    // Invariant sentimen pada overall
    const sumSentiments = overall.positive.total + overall.neutral.total + overall.negative.total;
    expect(sumSentiments).toBe(overall.classified_total);

    const sumPct = overall.positive.pct + overall.neutral.pct + overall.negative.pct;
    expect(sumPct).toBeGreaterThanOrEqual(99);
    expect(sumPct).toBeLessThanOrEqual(101);
  });

  test('TC-V2-PRT-03: invariant integritas cross-platform — akumulasi platform sama dengan overall', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/protocol-status'));
    const body = await res.json();
    const { overall, platforms } = body.data;

    // 1. Akumulasi total post seluruh platform = overall.total
    const sumPlatformTotal = platforms.reduce((acc: number, p: { total: number }) => acc + p.total, 0);
    expect(sumPlatformTotal).toBe(overall.total);

    // 2. Akumulasi classified_total seluruh platform = overall.classified_total
    const sumPlatformClassified = platforms.reduce((acc: number, p: { classified_total: number }) => acc + p.classified_total, 0);
    expect(sumPlatformClassified).toBe(overall.classified_total);

    // 3. Akumulasi share_pct seluruh platform = 100% (±1%)
    const sumPlatformShare = platforms.reduce((acc: number, p: { share_pct: number }) => acc + p.share_pct, 0);
    expect(sumPlatformShare).toBeGreaterThanOrEqual(99);
    expect(sumPlatformShare).toBeLessThanOrEqual(101);
  });

  test('TC-V2-PRT-04: validasi struktur dan invariant pada tiap item platform', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/protocol-status'));
    const body = await res.json();

    const expectedPlatforms = ['instagram', 'tiktok', 'x'];
    const platformCodes = body.data.platforms.map((p: { platform: string }) => p.platform);

    for (const code of expectedPlatforms) {
      expect(platformCodes).toContain(code);
    }

    for (const p of body.data.platforms) {
      expect(typeof p.label).toBe('string');
      expect(typeof p.status).toBe('string');
      expect(typeof p.early_warning).toBe('boolean');
      expect(p.share_pct).toBeGreaterThanOrEqual(0);

      // Invariant sentimen per platform
      const sumSentiments = p.positive.total + p.neutral.total + p.negative.total;
      expect(sumSentiments).toBe(p.classified_total);
    }
  });

  test('TC-V2-PRT-05: filter periode (24h, 7d) mengembalikan data posture yang valid', async ({ api }) => {
    for (const p of ['24h', '7d']) {
      const res = await api.get(apiUrl('/v2/dashboard/protocol-status'), {
        params: { period: p },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.overall.total).toBeGreaterThanOrEqual(0);
      expect(body.data.platforms.length).toBeGreaterThanOrEqual(3);
    }
  });
});

