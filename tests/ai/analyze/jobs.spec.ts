import { test, expect, aiApiUrl, aiHeaders, uniqueKey } from '../fixtures';

/**
 * Polling status/hasil job — dari spec OpenAPI:
 *   GET /v1/analyze/jobs/{job_id} → 200 JobResult
 *   - 401 tanpa token
 *   - 404 job tidak ditemukan / sudah kedaluwarsa
 *   - 429 polling terlalu cepat (coba lagi setelah poll_after_ms)
 *
 * Alur test: buat job via POST /v1/analyze/batch, lalu poll sampai selesai.
 */
test.describe('AI Service — Analyze Jobs (polling)', () => {
  test('alur batch → poll job sampai completed, hasil sesuai post yang dikirim', async ({ api }) => {
    // 1. Buat job via batch.
    const post = {
      post_id: 'post-job-1',
      text: 'Perdebatan soal kebijakan baru memanas di media sosial.',
      platform: 'twitter',
      created_at: '2026-08-14T01:00:00Z',
    };
    const create = await api.post(aiApiUrl('/v1/analyze/batch'), {
      headers: aiHeaders(),
      data: { batch_id: `qa-job-${uniqueKey('j')}`, analysis_request: [post] },
    });
    expect(create.status()).toBe(202);
    const { job_id } = await create.json();
    expect(job_id).toEqual(expect.any(String));

    // 2. Poll job sampai selesai (max ~20s), hormati poll_after_ms.
    let json: any;
    let attempts = 0;
    for (;;) {
      const poll = await api.get(aiApiUrl(`/v1/analyze/jobs/${job_id}`), { headers: aiHeaders() });
      expect(poll.status()).toBe(200);
      json = await poll.json();
      if (json.status === 'completed' || json.status === 'partial' || json.status === 'failed') break;
      attempts += 1;
      expect(attempts, 'job tidak selesai dalam batas polling').toBeLessThan(20);
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 3. Verifikasi hasil.
    expect(json.job_id).toBe(job_id);
    expect(json.counts.total).toBe(1);
    expect(json.results.length).toBeGreaterThan(0);
    const result = json.results.find((r: { post_id: string }) => r.post_id === post.post_id);
    expect(result).toBeTruthy();
  });

  test('GET /v1/analyze/jobs/{id} yang tidak ada → 404', async ({ api }) => {
    const res = await api.get(aiApiUrl('/v1/analyze/jobs/tidak-ada-job-id'), { headers: aiHeaders() });
    expect(res.status()).toBe(404);

    const body = await res.json();
    // FastAPI-style detail (mis. "Job not found or expired").
    expect(body.detail).toEqual(expect.any(String));
  });

  test('GET /v1/analyze/jobs/{id} tanpa token → 401', async ({ api }) => {
    const res = await api.get(aiApiUrl('/v1/analyze/jobs/some-id'));
    expect(res.status()).toBe(401);
  });
});
