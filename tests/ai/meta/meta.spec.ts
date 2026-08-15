import { test, expect, aiApiUrl, aiHeaders } from '../fixtures';

/**
 * Taxonomy & versi AI Service — dari spec OpenAPI:
 *   GET /v1/meta → 200 { emotion_labels[], topic_labels[],
 *                        emotion_label_colors{}, uncertain_threshold,
 *                        analysis_version }
 *   - 401 bila token tidak valid
 *
 * FE & QA memakai endpoint ini sebagai sumber label — jangan hardcode.
 */
test.describe('AI Service — Meta (taxonomy)', () => {
  test('GET /v1/meta dengan token valid → 200 & taxonomy lengkap', async ({ api }) => {
    const res = await api.get(aiApiUrl('/v1/meta'), { headers: aiHeaders() });
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Label emosi wajib ada & tidak kosong.
    expect(Array.isArray(body.emotion_labels)).toBe(true);
    expect(body.emotion_labels.length).toBeGreaterThan(0);

    // Label topik wajib ada & tidak kosong.
    expect(Array.isArray(body.topic_labels)).toBe(true);
    expect(body.topic_labels.length).toBeGreaterThan(0);

    // Warna per label emosi & threshold — set lengkap (tidak hardcode label
    // spesifik: taxonomy bisa berubah, mis. format label topik pernah berubah
    // dari snake_case → Title Case; sumber kebenaran tetap /v1/meta).
    expect(body.emotion_label_colors).toBeTruthy();
    for (const label of body.emotion_labels) {
      expect(body.emotion_label_colors[label], `warna untuk ${label}`).toEqual(expect.any(String));
    }
    expect(typeof body.uncertain_threshold).toBe('number');
    expect(typeof body.analysis_version).toBe('string');
  });

  test('GET /v1/meta tanpa token → 401', async ({ api }) => {
    const res = await api.get(aiApiUrl('/v1/meta'));
    expect(res.status()).toBe(401);
  });
});
