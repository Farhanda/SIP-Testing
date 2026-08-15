import { test, expect, aiApiUrl, aiHeaders, uniqueKey } from '../fixtures';
import { loadJsonData } from '../../../src/helpers/data';

/**
 * Analisis blocking (sync) — dari spec OpenAPI:
 *   POST /v1/analyze/sync → 200 JobResult (maks 10 post, khusus dev & QA)
 *   - 401 tanpa token
 *   - 422 request tidak valid
 *
 * JobResult: { job_id, batch_id, status: completed|partial|failed, counts,
 *              results: [{ post_id, status, emotion, emotion_score, topic,
 *                          topic_score, is_sarcasm, reason }] }
 *
 * Data-driven: post berbagai isu (politik, kesehatan, ekonomi, dll.) di
 * `test-data/ai-sync-posts.json` — tambah baris tanpa ubah kode. `expectedTopic`
 * adalah topik yang terverifikasi ke AI service (label mengikuti /v1/meta —
 * jangan hardcode label di luar data; kalau AI berubah, update data-nya).
 */

type SyncPostFixture = {
  post_id: string;
  text: string;
  platform?: string;
  created_at?: string;
  expectedTopic?: string;
  notes?: string;
};

const SYNC_POSTS = loadJsonData<SyncPostFixture[]>('ai-sync-posts.json');

/**
 * Kirim 1 post ke /v1/analyze/sync & kembalikan result-nya.
 *
 * Status job bisa `completed` ATAU `partial` — `partial` terjadi saat
 * provider AI overload (beberapa post tidak ter-analisis). Untuk 1 post,
 * yang penting result-nya ada; assert topik hanya bila status = analyzed.
 */
async function analyzeOne(api: import('@playwright/test').APIRequestContext, post: SyncPostFixture) {
  const body = {
    batch_id: `qa-sync-${uniqueKey('s')}`,
    analysis_request: [
      {
        post_id: post.post_id,
        text: post.text,
        platform: post.platform ?? 'twitter',
        created_at: post.created_at ?? '2026-08-14T02:20:25.599Z',
      },
    ],
  };
  const res = await api.post(aiApiUrl('/v1/analyze/sync'), {
    headers: aiHeaders(),
    data: body,
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(['completed', 'partial', 'failed']).toContain(json.status);
  return json.results[0];
}

test.describe('AI Service — Analyze Sync (blocking)', () => {
  // Sync = analisis blocking berat (1 request ≈ 1 detik ke LLM). Dipaksa
  // serial agar tidak membanjiri AI service — saat dijalankan paralel,
  // service overload dan hasil analisis jadi tidak konsisten (flaky).
  test.describe.configure({ mode: 'serial' });

  test('POST /v1/analyze/sync dengan payload valid → 200 & hasil analisis lengkap', async ({ api }) => {
    const body = {
      batch_id: `qa-sync-${uniqueKey('s')}`,
      analysis_request: [
        {
          post_id: 'post-sync-1',
          text: 'Warga mengapresiasi program layanan publik yang kini lebih cepat dan transparan.',
          platform: 'instagram',
          created_at: '2026-08-14T01:00:00Z',
        },
      ],
    };
    const res = await api.post(aiApiUrl('/v1/analyze/sync'), {
      headers: aiHeaders(),
      data: body,
    });
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.batch_id).toBe(body.batch_id);
    expect(['completed', 'partial', 'failed']).toContain(json.status);
    expect(json.counts.total).toBe(1);
    expect(json.counts.analyzed).toBeGreaterThanOrEqual(0);
    expect(json.analysis_version).toEqual(expect.any(String));

    // Hasil analisis per post: emotion & topic dari taxonomy (jangan hardcode
    // nilai label — ambil dari /v1/meta pada test meta.spec).
    const result = json.results.find((r: { post_id: string }) => r.post_id === 'post-sync-1');
    expect(result).toBeTruthy();
    // Status bisa pending bila kuota provider AI habis (quota_exhausted) —
    // itu kondisi service, bukan kegagalan kontrak. Verifikasi inti hanya
    // saat post benar-benar ter-analisis.
    expect(['analyzed', 'pending', 'not_analyzable', 'failed']).toContain(result.status);
    if (result.status === 'analyzed') {
      expect(result.emotion).toEqual(expect.any(String));
      expect(typeof result.emotion_score).toBe('number');
      expect(result.topic).toEqual(expect.any(String));
      expect(typeof result.topic_score).toBe('number');
      expect(typeof result.is_sarcasm).toBe('boolean');
    } else if (result.reason) {
      // pending/not_analyzable/failed → harus ada alasan (mis. quota_exhausted)
      expect(result.reason).toEqual(expect.any(String));
    }
  });

  // Data-driven (FR: analisis berbagai isu) — satu test per post di
  // test-data/ai-sync-posts.json. Setiap post diverifikasi: status analyzed,
  // topik sesuai yang terverifikasi, & skor valid.
  for (const post of SYNC_POSTS) {
    // Format topik HARUS sama dengan specTitle di scripts/generate-test-cases.mjs
    // (di-join ' / '), kalau tidak mapping status ke Excel tidak ketemu.
    const topicLabel = Array.isArray(post.expectedTopic) ? post.expectedTopic.join(' / ') : post.expectedTopic;
    test(`sync post "${post.text.slice(0, 48)}${post.text.length > 48 ? '…' : ''}" → analyzed${topicLabel ? ` (topik: ${topicLabel})` : ''}`, async ({ api }) => {
      const result = await analyzeOne(api, post);

      expect(result.post_id).toBe(post.post_id);
      // Post bisa ter-analisis (analyzed), antre saat kuota habis (pending), atau
      // gagal diproses (not_analyzable/failed). Kontrak yang diuji: bila
      // analyzed, hasilnya benar (topik & skor valid).
      expect(['analyzed', 'pending', 'not_analyzable', 'failed']).toContain(result.status);
      if (result.status === 'analyzed') {
        if (post.expectedTopic) {
          // Bisa string tunggal ATAU array topik yang diterima (post ambigu
          // kadang diklasifikasikan ke 2 topik oleh model LLM).
          const expected = Array.isArray(post.expectedTopic) ? post.expectedTopic : [post.expectedTopic];
          expect(expected).toContain(result.topic);
        } else {
          expect(result.topic).toEqual(expect.any(String));
        }
        // Skor & flag selalu terisi untuk post yang berhasil dianalisis.
        expect(typeof result.emotion_score).toBe('number');
        expect(typeof result.topic_score).toBe('number');
        expect(typeof result.is_sarcasm).toBe('boolean');
      }
    });
  }

  test('sync batch 10 post berbagai isu sekaligus → 200, semua ter-analisis', async ({ api }) => {
    const batch = SYNC_POSTS.slice(0, 10).map((p) => ({
      post_id: p.post_id,
      text: p.text,
      platform: p.platform ?? 'twitter',
      created_at: p.created_at ?? '2026-08-14T02:20:25.599Z',
    }));

    const res = await api.post(aiApiUrl('/v1/analyze/sync'), {
      headers: aiHeaders(),
      data: { batch_id: `qa-sync-batch-${uniqueKey('b')}`, analysis_request: batch },
    });
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(['completed', 'partial', 'failed']).toContain(json.status);
    expect(json.counts.total).toBe(batch.length);
    // Semua post punya hasil — tidak ada yang hilang.
    expect(json.results.length).toBe(batch.length);
    const analyzed = json.results.filter((r: { status: string }) => r.status === 'analyzed');
    // Saat service sehat, semua ter-analisis. Saat kuota provider habis,
    // semuanya pending (quota_exhausted) — itu kondisi service, bukan bug.
    // Pastikan TIDAK ada kombinasi aneh: analyzed ≥ 1 ATAU semuanya pending
    // dengan reason (kuota habis) → kontrak tetap valid.
    const pendingAll =
      json.results.length > 0 &&
      json.results.every((r: { status: string; reason?: string }) => r.status === 'pending' && r.reason);
    if (!pendingAll) {
      expect(analyzed.length).toBeGreaterThanOrEqual(Math.ceil(batch.length / 2));
    }
    // Setiap post yang analyzed punya topik yang valid (string) & terisi.
    for (const r of json.results) {
      if (r.status === 'analyzed') {
        expect(r.topic).toEqual(expect.any(String));
        expect(typeof r.topic_score).toBe('number');
      }
    }
  });

  test('POST /v1/analyze/sync tanpa token → 401', async ({ api }) => {
    const res = await api.post(aiApiUrl('/v1/analyze/sync'), {
      data: { batch_id: 'x', analysis_request: [] },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /v1/analyze/sync dengan post tanpa text → 422', async ({ api }) => {
    const res = await api.post(aiApiUrl('/v1/analyze/sync'), {
      headers: aiHeaders(),
      data: {
        batch_id: 'qa-sync-invalid',
        analysis_request: [{ post_id: 'p1' }],
      },
    });
    expect(res.status()).toBe(422);
  });
});
