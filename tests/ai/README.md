# Testing AI — `tests/ai/`

Platform **AI** punya dua peran:

1. **Menguji SIP AI Service** (`BASE_URL_AI`, default
   `http://10.200.102.2:8100`) — endpoint health, meta, dan analisis
   (batch/jobs/sync) dengan auth header `X-Service-Token`.
2. **Menghasilkan** output dari **data BE** — mengonsumsi data BE lalu
   memproduksi laporan (sheet Generate).

Bukan test UI (FE) dan bukan test API BE.

## Jalankan

```bash
npm run test:ai            # Semua test AI
npx playwright test -c playwright.ai.config.ts -g "health"    # Filter per judul
npx playwright test -c playwright.ai.config.ts tests/ai/analyze   # Filter per folder
```

Prasyarat: AI Service berjalan (`BASE_URL_AI`) dan BE lokal berjalan
(`BASE_URL_BE`, default `http://localhost:8080`) untuk sheet Generate.
Untuk laporan eksekusi test BE, jalankan `npm run test:be` dulu (membaca
`test-results/results-be.json` — bila belum ada, test otomatis di-skip).

## Konfigurasi

| Variabel | Default | Keterangan |
|---|---|---|
| `BASE_URL_AI` | `http://10.200.102.2:8100` | Base URL AI Service (docs: `/docs`) |
| `AI_SERVICE_TOKEN` | `dev-local-service-token` | Token header `X-Service-Token` |
| `BASE_URL_AI_INTELLIGENCE` | `http://10.200.102.2:8000` | Base URL Intelligence AI Service (folder `tests/ai/intelligence/`) |
| `AI_INTELLIGENCE_TOKEN` | *(dari env)* | Token header `X-AI-Service-Token` |

## AI Service (SIP AI Service v1.0.0)

Spec OpenAPI live: **`{BASE_URL_AI}/docs`** (spec JSON: `/openapi.json`).
Semua endpoint wajib header `X-Service-Token` (401 tanpa/salah token).

### Status endpoint (diverifikasi 2026-08-14)

| Endpoint | Status | Catatan |
|---|---|---|
| `GET /v1/health` | ✅ 200 | status ok, provider_reachable, quota_remaining, analysis_version; 503 bila provider/Redis bermasalah |
| `GET /v1/meta` | ✅ 200 | taxonomy label emosi/topik + warna + uncertain_threshold — FE/QA pakai ini, jangan hardcode |
| `POST /v1/analyze/batch` | ✅ 202 | asinkron: `{ job_id, batch_id, status: "queued", total_posts, poll_after_ms }`; 409 idempotency; 422 validasi |
| `GET /v1/analyze/jobs/{job_id}` | ✅ 200 | JobResult: status completed/partial/failed + counts + results; 404 job tidak ada; 429 polling terlalu cepat |
| `POST /v1/analyze/sync` | ✅ 200 | blocking, maks 10 post (dev & QA): langsung balas JobResult; 422 validasi |

Format error FastAPI: `{ "detail": "..." }` (404) atau
`{ "detail": [{ "type", "loc", "msg", "input" }] }` (422).

> ⚠️ **Kuota provider AI**: analisis (`batch`/`sync`) memakai kuota provider
> (lihat `quota_remaining` di `/v1/health`). Saat kuota habis, post dibalas
> `status: "pending"` dengan `reason: "quota_exhausted"` (job `partial`) —
> itu **kondisi service, bukan kegagalan kontrak**. Test sync sudah toleran:
> hanya memverifikasi topik/emosi saat post benar-benar `analyzed`; status
> `pending`/`not_analyzable`/`failed` harus punya `reason`.

## Intelligence AI Service — `tests/ai/intelligence/` (port 8000, service ganda)

Selain SIP AI Service (8100), ada **Intelligence AI Service** terpisah di
**`http://10.200.102.2:8000`** (env `BASE_URL_AI_INTELLIGENCE`, docs:
`/docs`, OpenAPI: `/openapi.json` — ditemukan & di-cover 2026-09-02):

- **Auth header `X-AI-Service-Token`** (BUKAN `X-Service-Token`) — 401 tanpa
  token; `GET /health` publik (tanpa token).
- Endpoint: `POST /v1/topic-intelligence` dan `POST /v1/actor-intelligence`
  (request: `{ request_id, keyword, period{from,to}, topic{name} |
  actor{username}, posts[] }`; respons diskriminator `status`:
  `completed`/`insufficient_evidence`/`failed` + `computed_facts`
  `{ post_count, sentiment, dominant_emotion }`). Actor result TANPA
  `recommended_action`.
- **429 + `error_code: "provider_rate_limited"`** saat Gemini daily quota
  membuka circuit breaker — **kondisi service, bukan kegagalan kontrak**
  (test menerima union `200 | 429` dan memverifikasi struktur masing-masing).
- 7 case (TC-AI-I01–I07) di sheet **Intelligence** Excel AI. Helper:
  `intelApiUrl` / `intelHeaders` / `intelAuth` dari `./fixtures`.

## Test data-driven sync (berbagai isu)

Post analisis disimpan di **`test-data/ai-sync-posts.json`** — tambah baris
untuk isu baru tanpa mengubah kode test:

```json
{ "post_id": "sync-post-014", "text": "...", "platform": "twitter", "created_at": "...", "expectedTopic": "Kesehatan" }
```

- `text` — **wajib**, isi post yang dianalisis (boleh isu politik/kesehatan/
  ekonomi/dll.).
- `expectedTopic` — topik yang terverifikasi ke AI service (label mengikuti
  `/v1/meta`, **jangan hardcode di test** — update data kalau AI berubah).
  Bisa **array** untuk post ambigu yang kadang diklasifikasikan ke 2 topik
  (mis. "kampanye kesetaraan & toleransi beragama" → Politik Pemerintahan /
  Agama Budaya).
- `platform` / `created_at` — opsional (default twitter / 2026-08-14).

Lalu jalankan:

```bash
npm run test:ai          # verifikasi post baru (topik terdeteksi)
npm run test-cases:ai    # regenerate Excel (sheet Analyze Sync)
```

> Catatan: spec sync dijalankan **serial** (`test.describe.configure({ mode: 'serial' })`)
> dan workers AI dibatasi 2 — analisis blocking itu berat; terlalu banyak
> request paralel membuat service overload dan hasil tidak konsisten.

### Struktur folder

```
tests/ai/
├── health/health.spec.ts            # liveness + kuota + 401
├── meta/meta.spec.ts                # taxonomy label emosi/topik
├── analyze/batch.spec.ts            # submit batch async (202/401/422)
├── analyze/jobs.spec.ts             # polling job sampai selesai + 404/401
├── analyze/sync.spec.ts             # analisis blocking (200/401/422)
├── intelligence/                    # Intelligence AI Service (base 8000, X-AI-Service-Token)
│   ├── health.spec.ts               #   GET /health publik → 200
│   ├── topic-intelligence.spec.ts   #   POST /v1/topic-intelligence (401/400/200|429)
│   └── actor-intelligence.spec.ts   #   POST /v1/actor-intelligence (401/400/200|429)
├── generate-report.spec.ts          # generate laporan dari data BE
├── report.ts                        # helper bangun laporan markdown
└── fixtures.ts                      # api, aiApiUrl/intelApiUrl, aiHeaders/intelHeaders, uniqueKey
```

## Hasil generate (sheet Generate)

Semua output ditulis ke **`test-results/ai/`** (gitignored), mis.:

- `dashboard-summary-<timestamp>.md` — laporan ringkasan insight dari
  `GET /v1/dashboard/summary` (data live BE).
- `be-execution-<timestamp>.md` — laporan status eksekusi test BE.

Report Playwright platform AI sendiri: HTML di `playwright-report-ai/`
(`npm run report:ai`), JSON di `test-results/results-ai.json`.

## Cara kerja & pengembangan

1. **AI Service** — fixture `api` + helper `aiApiUrl` / `aiHeaders` /
   `aiAuth` dari `./fixtures` (token otomatis terpasang).
2. **Baca data BE** — fixture `api` (request ke `BASE_URL_BE`) atau baca
   `test-results/results-be.json`.
3. **Generate** — helper di `report.ts` (bangun markdown dari data BE).
4. **Tulis output** — `writeReport(outputDir, filename, content)` →
   `test-results/ai/`.
5. **Verifikasi** — assert isi laporan berisi data BE yang benar.

> Lapisan "AI" sesungguhnya (mis. LLM untuk analisis naratif) bisa
> dicolok di `report.ts`: data BE sudah dibaca & dibentuk menjadi input,
> tinggal diteruskan ke provider AI, lalu hasilnya ditulis lewat
> `writeReport`.
