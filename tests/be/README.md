# Testing API Backend — `tests/be/`

Test **API backend** (platform BE) dengan Playwright `APIRequestContext`
(fixture `api`). Terpisah dari test UI (FE) dan generator hasil (AI).

> ℹ️ **Kanonik untuk Dashboard Service (2026-08-18):** suite ini adalah
> **satu-satunya** tempat test API dashboard-service (port `8080`). Case unik
> dari eksplorasi sebelumnya (data-driven keyword×platform, varian period,
> validasi hourly) sudah di-port ke sini (`summary.spec.ts`,
> `conversation-trend.spec.ts`, data `test-data/be-dashboard-combos.json`).
> Project test mock service terpisah sudah dihapus — jangan menambah test
> dashboard di luar project ini.

## Jalankan

```bash
npm run test:be            # Semua test API BE
npx playwright test -c playwright.be.config.ts tests/be/dashboard   # Filter per folder
npx playwright test -c playwright.be.config.ts -g "health"         # Filter per judul
```

Report: HTML di `playwright-report-be/` (`npm run report:be`), JSON di
`test-results/results-be.json` (dipakai platform AI sebagai sumber data).

## Konfigurasi

| Variabel | Default | Keterangan |
|---|---|---|
| `BASE_URL_BE` | `http://localhost:8080` | Base URL API backend |
| `BE_API_PREFIX` | `/v1` | Prefiks versi API |

## Sumber kebenaran: Swagger BE

Spec OpenAPI live ada di **`http://localhost:8080/swagger/`**
(UI: `/swagger/index.html`, spec JSON: `/swagger/doc.json`).

### Status endpoint (diverifikasi 2026-08-18 — eksplorasi ulang)

BE kini memiliki **10 endpoint** (Users/Tasks/Files/Provider sudah **dihapus**;
5 endpoint terbaru **top-accounts, top-hashtags, top-posts, topic-intelligence,
topic-intelligence-detail** ditambahkan saat eksplorasi ulang):

| Endpoint | Status | Spec Swagger |
|---|---|---|
| `GET /health/live` | ✅ 200 | `{ status: "live" }` |
| `GET /health/ready` | ✅ 200 | `{ status: "ready" }` (503 bila belum siap) |
| `GET /v1/dashboard/summary` | ✅ 200 | query opsional: keyword, platform, date_from, date_to |
| `GET /v1/dashboard/conversation-trend` | ✅ 200 | query opsional: keyword, platform, period (`24h`/`3d`/`7d`/`1m`/`1y`/`YYYY-MM-DD`/range) — malformed → fallback 1 bulan |
| `GET /v1/dashboard/conversation-trend-hourly` | ✅ 200 · 400 | query: date (`YYYY-MM-DD`, **wajib**) + keyword/platform opsional — tanpa date / format salah → 400 `invalid_request` |
| `GET /v1/dashboard/top-accounts` | ✅ 200 | `{ data: [{ id, handle, platform, posts }] }` — id = handle; urut posts desc; maks 5 |
| `GET /v1/dashboard/top-hashtags` | ✅ 200 | `{ data: [{ id, tag, count }] }` — tag `#Xxx`; urut count desc; maks 5 |
| `GET /v1/dashboard/top-posts` | ✅ 200 | `{ data: [{ id, platform, post, emotion, topic, engagement }] }` — urut engagement desc; maks 5 |
| `GET /v1/dashboard/topic-intelligence` | ✅ 200 | `{ data: [{ id, label, pct, count }] }` — id = label; pct = round(count/total*100) |
| `GET /v1/dashboard/topic-intelligence-detail` | ✅ 200 · 400 · 404 | query: `topic` (**wajib**, exact) + keyword/search/sentiment/emotion/page/size — tanpa topic → 400; topic/keyword tidak cocok → 404; page/size di-clamp (size max 50, default 6) |

> 💡 **Quirk kontrak** (terdokumentasi sebagai test): `stats` di
> topic-intelligence-detail **mengabaikan** filter search/sentiment/emotion —
> hanya keyword/topic/platform/period yang memengaruhi scope stats, jadi nilai
> yang tidak cocok pun tetap 200 (posts kosong), bukan 404.

### ⚠️ GAP: endpoint dipanggil FE tapi belum ada di Go (dokumentasi audit FE↔BE 2026-08-18)

FE dashboard (`localhost:3000`) memanggil 5 endpoint ini langsung ke
dashboard-service (`env.dashboardApiUrl`), tapi **belum terdaftar di router Go**
→ saat ini balas `404`. Konsekuensi: kartu terkait di FE menampilkan error
state ("Failed to load ..."). Test di `missing-endpoints.spec.ts` (kategori **Gap**
di Excel) mendokumentasikan gap ini — ekspektasi saat ini 404; begitu endpoint
Go tersedia, update ekspektasi ke 200 + kontrak FE:

| Endpoint (dipanggil `src/services/dashboard.ts`) | Status saat ini | Kontrak yang diharapkan FE |
|---|---|---|
| `GET /v1/dashboard/trending-topic?period=24H\|7D` | ❌ 404 | `{ data: [{ id, topic, volume, delta }], meta: { period, total, generated_at } }` |
| `GET /v1/dashboard/emotion-map` | ❌ 404 | `{ data: { anger, neutral, fear, joy, sadness }, meta }` |
| `GET /v1/dashboard/sentiment-map` | ❌ 404 | `{ data: { positive, neutral, negative }, meta }` |
| `GET /v1/dashboard/sentiment-trend` | ❌ 404 | `{ data: [{ date, label, positive, negative }], meta }` |
| `GET /v1/dashboard/sentiment-trend-hourly` | ❌ 404 | `{ data: [{ hour, label, positive, negative }], meta: { date } }` |

Struktur respons `GET /v1/dashboard/summary` (dicek langsung ke BE):

```json
{
  "data": {
    "total_post":       { "value": 18, "label": "18", "delta_pct": 0, "delta_direction": "flat" },
    "total_engagement": { "value": 60315, "label": "60.31K", ... },
    "views":            { "value": 2170600, "label": "2.17M", ... },
    "engagement_rate":  { "value": 2.78, "label": "2.78%", ... },
    "active_platforms": { "active": 3, "total": 3 }
  },
  "meta": { "generated_at": "<ISO timestamp>" }
}
```

Format error terstruktur (Swagger `bootstrap.apiErrorResponse`):
`{ "error": { "code", "message", "request_id" } }`.

## Menambah keyword data dashboard (data BE bertambah)

Saat data BE bertambah keyword baru, cukup tambah baris di
**`test-data/be-dashboard-keywords.json`** — test & Excel otomatis mengikutinya
(data-driven, pola sama seperti FE):

```json
{ "keyword": "nama-keyword-baru", "expectedTotalPosts": 12 }
```

- `keyword` — **wajib**, slug keyword yang difilter ke `?keyword=`.
- `expectedTotalPosts` — **opsional**: isi jumlah post yang sudah terverifikasi
  (assert jadi presisi). Bisa dikosongkan dulu — test tetap jalan dan hanya
  memastikan data keyword terisi (`total_post > 0`).

Lalu jalankan:

```bash
npm run test:be          # verifikasi data keyword
npm run test-cases:be    # regenerate Excel (sheet Dashboard)
```

## Cara menambah test

1. Buat spec di folder ini (wajib berakhiran `.spec.ts`), mis. `tests/be/<modul>/<nama>.spec.ts`.
2. Pakai fixture `api` + helper `apiUrl` dari `../fixtures`:

```ts
import { test, expect, apiUrl } from '../fixtures';

test('contoh: GET /v1/dashboard/summary', async ({ api }) => {
  const res = await api.get(apiUrl('/v1/dashboard/summary'));
  expect(res.status()).toBe(200);
});
```

3. Tambahkan baris test case-nya di `scripts/generate-test-cases.mjs`
   (`buildBe*Cases` — `specTitle` harus **persis** sama dengan judul test)
   supaya Excel `test-cases/BE-Test-Cases.xlsx` selalu sinkron.
