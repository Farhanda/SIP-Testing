import {
  test,
  expect,
  intelApiUrl,
  intelAuth,
  uniqueKey,
} from '../fixtures';

/**
 * Test Intelligence AI Service — POST /v1/topic-intelligence
 * (BASE_URL_AI_INTELLIGENCE :8000, header X-AI-Service-Token).
 *
 * Kontrak (OpenAPI + verifikasi live 2026-09-02):
 *   Request : { request_id, keyword, period: {from,to}, topic:
 *              { name, ... }, posts: ClassifiedPost[]
 *              (status analyzed|not_analyzable|failed|pending),
 *              context_content_ids? }
 *   Response 200 : satu dari { completed (result+generation),
 *              insufficient_evidence (result null + reason),
 *              failed (error_code + message) } — diskriminator `status`;
 *              computed_facts selalu terisi bila kalkulasi sukses.
 *   Tanpa token → 401. Request tidak valid → 400 validation_error.
 *
 * ⚠️ Saat Gemini daily quota membuka circuit breaker, request valid
 *    dibalas **429** dengan body status=failed + error_code=
 *    provider_rate_limited (bukan 200). Itu kondisi service, bukan
 *    kegagalan kontrak — test menerima union `200 | 429` dan
 *    memverifikasi struktur masing-masing.
 */

const TOPIC_REQUEST = (requestId: string) => ({
  request_id: requestId,
  keyword: 'Tes Keyword',
  period: { from: '2026-08-01', to: '2026-08-31' },
  topic: { name: 'Kesehatan' },
  posts: [
    { content_id: 'p1', text: 'BPJS Kesehatan harus diperbaiki pelayanannya', status: 'analyzed', emotion: 'anger', emotion_score: 0.8, is_sarcasm: false },
    { content_id: 'p2', text: 'Pelayanan kesehatan rumah sakit sudah membaik', status: 'analyzed', emotion: 'joy', emotion_score: 0.7, is_sarcasm: false },
  ],
});

test.describe('Intelligence AI Service — POST /v1/topic-intelligence', () => {
  test('tanpa token → 401 Unauthorized', async ({ api }) => {
    const res = await api.post(intelApiUrl('/v1/topic-intelligence'), { data: {} });
    expect(res.status()).toBe(401);
  });

  test('body tidak valid ({} kosong) → 400 validation_error', async ({ api }) => {
    const res = await api.post(intelApiUrl('/v1/topic-intelligence'), intelAuth({}));
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.status).toBe('failed');
    expect(body.error_code).toBe('validation_error');
    expect(typeof body.message).toBe('string');
  });

  test('request valid → 200 (completed/insufficient_evidence/failed) atau 429 provider_rate_limited', async ({ api }) => {
    test.setTimeout(180_000);
    const requestId = uniqueKey('topic-intel');

    const res = await api.post(intelApiUrl('/v1/topic-intelligence'), intelAuth(TOPIC_REQUEST(requestId)));
    expect([200, 429]).toContain(res.status());

    const body = await res.json();
    // request_id digaungkan dari request
    expect(body.request_id).toBe(requestId);
    expect(['completed', 'insufficient_evidence', 'failed']).toContain(body.status);

    // computed_facts: post_count & sentiment dari post yang dikirim
    if (body.computed_facts) {
      expect(body.computed_facts.post_count.total).toBe(2);
      expect(body.computed_facts.post_count.analyzed).toBe(2);
      const senti = body.computed_facts.sentiment;
      expect(typeof senti.positive_pct).toBe('number');
      expect(typeof senti.negative_pct).toBe('number');
      expect(senti.positive_pct + senti.negative_pct + senti.neutral_pct).toBeGreaterThan(0);
    }

    if (res.status() === 429) {
      // Circuit breaker Gemini terbuka — kontrak 429 spesifik
      expect(body.status).toBe('failed');
      expect(body.error_code).toBe('provider_rate_limited');
      expect(typeof body.message).toBe('string');
      return;
    }

    if (body.status === 'completed') {
      // result Intelligence lengkap + metadata generasi
      expect(body.result.summary).toBeTruthy();
      expect(body.result.insight).toBeTruthy();
      expect(body.result.recommended_action).toBeTruthy();
      expect(Array.isArray(body.result.supporting_content_ids)).toBe(true);
      expect(Array.isArray(body.generation)).toBe(true);
      expect(body.generation.length).toBeGreaterThan(0);
    } else if (body.status === 'insufficient_evidence') {
      expect(body.result).toBeNull();
      expect(typeof body.reason).toBe('string');
    } else {
      // failed — error code harus dari enum yang dikenal
      expect(
        ['validation_error', 'provider_rate_limited', 'provider_unavailable', 'schema_invalid'],
      ).toContain(body.error_code);
      expect(typeof body.message).toBe('string');
    }
  });
});