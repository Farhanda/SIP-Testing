import {
  test,
  expect,
  intelApiUrl,
  intelAuth,
  uniqueKey,
} from '../fixtures';

/**
 * Test Intelligence AI Service — POST /v1/actor-intelligence
 * (BASE_URL_AI_INTELLIGENCE :8000, header X-AI-Service-Token).
 *
 * Kontrak sama dengan topic-intelligence, bedanya field `actor`
 * (ActorFacts: { username, top_topics? }) dan result TANPA
 * recommended_action: ActorIntelligenceResult { summary, insight,
 * supporting_content_ids }.
 *
 * ⚠️ Saat Gemini daily quota membuka circuit breaker, request valid
 *    dibalas **429** dengan body status=failed + error_code=
 *    provider_rate_limited (bukan 200). Itu kondisi service, bukan
 *    kegagalan kontrak — test menerima union `200 | 429` dan
 *    memverifikasi struktur masing-masing.
 */

const ACTOR_REQUEST = (requestId: string) => ({
  request_id: requestId,
  keyword: 'Tes Keyword',
  period: { from: '2026-08-01', to: '2026-08-31' },
  actor: { username: 'tes_akun_public' },
  posts: [
    { content_id: 'p1', text: 'Akun ini mendukung penuh program Bansos', status: 'analyzed', emotion: 'joy', emotion_score: 0.8, is_sarcasm: false },
    { content_id: 'p2', text: 'Kritik keras terhadap pelayanan publik', status: 'analyzed', emotion: 'anger', emotion_score: 0.75, is_sarcasm: false },
  ],
});

test.describe('Intelligence AI Service — POST /v1/actor-intelligence', () => {
  test('tanpa token → 401 Unauthorized', async ({ api }) => {
    const res = await api.post(intelApiUrl('/v1/actor-intelligence'), { data: {} });
    expect(res.status()).toBe(401);
  });

  test('body tidak valid ({} kosong) → 400 validation_error', async ({ api }) => {
    const res = await api.post(intelApiUrl('/v1/actor-intelligence'), intelAuth({}));
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.status).toBe('failed');
    expect(body.error_code).toBe('validation_error');
  });

  test('request valid → 200 (kontrak actor) atau 429 provider_rate_limited', async ({ api }) => {
    test.setTimeout(180_000);
    const requestId = uniqueKey('actor-intel');

    const res = await api.post(intelApiUrl('/v1/actor-intelligence'), intelAuth(ACTOR_REQUEST(requestId)));
    expect([200, 429]).toContain(res.status());

    const body = await res.json();
    expect(body.request_id).toBe(requestId);
    expect(['completed', 'insufficient_evidence', 'failed']).toContain(body.status);

    if (body.computed_facts) {
      expect(body.computed_facts.post_count.total).toBe(2);
      expect(body.computed_facts.post_count.analyzed).toBe(2);
      const senti = body.computed_facts.sentiment;
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
      expect(body.result.summary).toBeTruthy();
      expect(body.result.insight).toBeTruthy();
      expect(Array.isArray(body.result.supporting_content_ids)).toBe(true);
      // Actor intelligence: TIDAK punya recommended_action
      expect(body.result.recommended_action).toBeUndefined();
      expect(Array.isArray(body.generation)).toBe(true);
    } else if (body.status === 'insufficient_evidence') {
      expect(body.result).toBeNull();
      expect(typeof body.reason).toBe('string');
    } else {
      expect(
        ['validation_error', 'provider_rate_limited', 'provider_unavailable', 'schema_invalid'],
      ).toContain(body.error_code);
    }
  });
});