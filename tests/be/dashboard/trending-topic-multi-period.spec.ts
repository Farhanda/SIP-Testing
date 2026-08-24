import { test, expect, apiUrl } from '../fixtures';

/**
 * Test GET /v1/dashboard/trending-topic-multi-period — trending topics
 * dengan delta per periode (24h / 7d / 1mo) untuk display wall
 * Conversation Overview.
 *
 * Struktur respons (diverifikasi live 2026-08-24):
 *   { data: [{ id, label, value, pct, deltas: [{label, value, up, primary?}] }],
 *     meta: {...} }
 *
 * Catatan: Swagger menandai endpoint ini "placeholder data" — assertion
 * fokus pada KONTRAK struktur (bukan nilai bisnis), supaya tidak rapuh.
 */
const DELTA_LABELS = ['24h', '7d', '1mo'];

test.describe('GET /v1/dashboard/trending-topic-multi-period', () => {
  test('tanpa filter → 200 & data terisi dengan kontrak item lengkap', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic-multi-period'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    for (const topic of body.data) {
      expect(typeof topic.id).toBe('string');
      expect(typeof topic.label).toBe('string');
      expect(topic.label.length).toBeGreaterThan(0);
      // value berupa string ringkas ("1.726 posts")
      expect(typeof topic.value).toBe('string');
      expect(topic.value.length).toBeGreaterThan(0);
      expect(typeof topic.pct).toBe('number');
      expect(topic.pct).toBeGreaterThanOrEqual(0);
      expect(topic.pct).toBeLessThanOrEqual(100);
      expect(Array.isArray(topic.deltas)).toBe(true);
    }
  });

  test('tiap topik punya delta 24h/7d/1mo dengan flag up boolean & tepat satu primary', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/trending-topic-multi-period'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const topic of body.data) {
      const labels = topic.deltas.map((d: { label: string }) => d.label);
      for (const expected of DELTA_LABELS) {
        expect(labels).toContain(expected);
      }
      for (const d of topic.deltas) {
        expect(typeof d.value).toBe('string');
        expect(typeof d.up).toBe('boolean');
      }
      // Tepat satu delta ditandai primary per topik
      const primaries = topic.deltas.filter((d: { primary?: boolean }) => d.primary === true);
      expect(primaries.length).toBe(1);
    }
  });

  test('parameter keyword diterima → tetap 200 dengan kontrak sama', async ({ api }) => {
    const res = await api.get(
      apiUrl('/v1/dashboard/trending-topic-multi-period?keyword=RUU%20Digital'),
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
