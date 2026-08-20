import { test, expect, apiUrl } from '../fixtures';

/**
 * Test API Backend — /v1/dashboard/protocol-status
 *
 * Endpoint mengembalikan status protocol wall (Danger/Alert/Green)
 * berdasarkan distribusi emotion negatif, termasuk breakdown emotion,
 * sentiment, affected platforms, trigger topics, influential accounts,
 * top negative quotes, positive highlight, dan recent trend.
 *
 * Kontrak Swagger:
 *   GET /v1/dashboard/protocol-status?keyword=&platform=&period=
 *   Response: { data: { level, label, description, negative_pct, positive_pct,
 *     period, emotion, sentiment, total_post, total_engagement,
 *     affected_platforms, trigger_topics, influential_accounts,
 *     top_negative_quotes, positive_highlight, recent_trend,
 *     active_since, active_duration_label }, meta: { generated_at } }
 */

test.describe('GET /v1/dashboard/protocol-status', () => {
  test('tanpa filter → 200, data punya level, label, description', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');

    const d = body.data;
    expect(['danger', 'alert', 'green']).toContain(d.level);
    expect(typeof d.label).toBe('string');
    expect(['Danger', 'Alert', 'Green']).toContain(d.label);
    expect(typeof d.description).toBe('string');
    expect(d.description.length).toBeGreaterThan(0);
  });

  test('level konsisten dengan label', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const { level, label } = body.data;
    if (level === 'danger') expect(label).toBe('Danger');
    else if (level === 'alert') expect(label).toBe('Alert');
    else expect(label).toBe('Green');
  });

  test('negative_pct & positive_pct bertipe number', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.negative_pct).toBe('number');
    expect(typeof body.data.positive_pct).toBe('number');
    expect(body.data.negative_pct).toBeGreaterThanOrEqual(0);
    expect(body.data.positive_pct).toBeGreaterThanOrEqual(0);
  });

  test('period terisi dan bukan kosong', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.period).toBe('string');
    expect(body.data.period.length).toBeGreaterThan(0);
  });

  test('emotion punya 5 field: anger, neutral, fear, joy, sadness', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const e = body.data.emotion;
    expect(typeof e.anger).toBe('number');
    expect(typeof e.neutral).toBe('number');
    expect(typeof e.fear).toBe('number');
    expect(typeof e.joy).toBe('number');
    expect(typeof e.sadness).toBe('number');
  });

  test('sentiment punya 3 field: positive, neutral, negative', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const s = body.data.sentiment;
    expect(typeof s.positive).toBe('number');
    expect(typeof s.neutral).toBe('number');
    expect(typeof s.negative).toBe('number');
  });

  test('total_post & total_engagement bertipe number', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.data.total_post).toBe('number');
    expect(typeof body.data.total_engagement).toBe('number');
  });

  test('affected_platforms berupa array', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data.affected_platforms)).toBe(true);
    for (const p of body.data.affected_platforms) {
      expect(typeof p.platform).toBe('string');
      expect(typeof p.pct).toBe('number');
    }
  });

  test('trigger_topics berupa array', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data.trigger_topics)).toBe(true);
    for (const t of body.data.trigger_topics) {
      expect(typeof t.topic).toBe('string');
      expect(typeof t.count).toBe('number');
    }
  });

  test('influential_accounts berupa array', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data.influential_accounts)).toBe(true);
    for (const a of body.data.influential_accounts) {
      expect(typeof a.account).toBe('string');
      expect(typeof a.platform).toBe('string');
      expect(typeof a.posts).toBe('number');
    }
  });

  test('top_negative_quotes berupa array', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data.top_negative_quotes)).toBe(true);
  });

  test('positive_highlight berupa object atau null', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const h = body.data.positive_highlight;
    expect(h === null || typeof h === 'object').toBe(true);
  });

  test('recent_trend berupa array', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data.recent_trend)).toBe(true);
    for (const t of body.data.recent_trend) {
      expect(typeof t.date).toBe('string');
      expect(typeof t.volume).toBe('number');
      expect(typeof t.engagement).toBe('number');
    }
  });

  test('active_since null & active_duration_label kosong (belum diimplementasi)', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.active_since).toBeNull();
    expect(typeof body.data.active_duration_label).toBe('string');
  });

  test('filter keyword → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status?keyword=RUU+Digital'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(['danger', 'alert', 'green']).toContain(body.data.level);
  });

  test('filter platform → 200', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status?platform=tiktok'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(['danger', 'alert', 'green']).toContain(body.data.level);
  });

  test('filter period=24h → 200 & period = 24h', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status?period=24h'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.period).toBe('24h');
  });

  test('filter period=7d → 200 & period = 7d', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status?period=7d'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.period).toBe('7d');
  });

  test('period tidak valid → 200 & fallback ke 24h', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status?period=XYZ'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.period).toBe('24h');
  });

  test('generated_at berupa ISO timestamp yang valid', async ({ api }) => {
    const res = await api.get(apiUrl('/v1/dashboard/protocol-status'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    const ts = new Date(body.meta.generated_at);
    expect(ts.getTime()).not.toBeNaN();
  });
});
