import { test, expect, aiApiUrl, aiHeaders, uniqueKey } from '../fixtures';

/**
 * Analisis asinkron (batch) — dari spec OpenAPI:
 *   POST /v1/analyze/batch → 202 { job_id, batch_id, status: "queued",
 *                                  total_posts, poll_after_ms }
 *   - 401 tanpa token
 *   - 409 Idempotency-Key sudah dipakai dengan body berbeda
 *   - 422 request tidak valid (mis. tanpa analysis_request / post_id / text)
 *
 * Request: { batch_id, analysis_request: [{ post_id, text, platform?, created_at? }] }
 */
test.describe('AI Service — Analyze Batch (async)', () => {
  test('POST /v1/analyze/batch dengan payload valid → 202 queued', async ({ api }) => {
    const body = {
      batch_id: `qa-batch-${uniqueKey('b')}`,
      analysis_request: [
        {
          post_id: 'post-batch-1',
          text: 'Pemerintah meluncurkan kebijakan ekonomi baru untuk UMKM.',
          platform: 'twitter',
          created_at: '2026-08-14T01:00:00Z',
        },
      ],
    };
    const res = await api.post(aiApiUrl('/v1/analyze/batch'), {
      headers: aiHeaders(),
      data: body,
    });
    expect(res.status()).toBe(202);

    const json = await res.json();
    expect(json.job_id).toEqual(expect.any(String));
    expect(json.batch_id).toBe(body.batch_id);
    expect(json.status).toBe('queued');
    expect(json.total_posts).toBe(body.analysis_request.length);
    expect(typeof json.poll_after_ms).toBe('number');
  });

  test('POST /v1/analyze/batch tanpa token → 401', async ({ api }) => {
    const res = await api.post(aiApiUrl('/v1/analyze/batch'), {
      data: { batch_id: 'x', analysis_request: [] },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /v1/analyze/batch tanpa analysis_request → 422', async ({ api }) => {
    const res = await api.post(aiApiUrl('/v1/analyze/batch'), {
      headers: aiHeaders(),
      data: { batch_id: 'qa-invalid' },
    });
    expect(res.status()).toBe(422);

    const body = await res.json();
    // FastAPI error detail: array berisi lokasi field yang kurang.
    expect(Array.isArray(body.detail)).toBe(true);
  });

  test('POST /v1/analyze/batch dengan post tanpa text → 422', async ({ api }) => {
    const res = await api.post(aiApiUrl('/v1/analyze/batch'), {
      headers: aiHeaders(),
      data: {
        batch_id: 'qa-invalid-2',
        analysis_request: [{ post_id: 'p1' }],
      },
    });
    expect(res.status()).toBe(422);
  });
});
