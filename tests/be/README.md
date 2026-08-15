# Testing API Backend — `tests/be/`

Test **API backend** (platform BE) dengan Playwright `APIRequestContext`
(fixture `api`). Terpisah dari test UI (FE) dan generator hasil (AI).

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

### Status endpoint (diverifikasi 2026-08-14 — eksplorasi ulang)

BE kini memiliki **5 endpoint** (Users/Tasks/Files/Provider sudah **dihapus**;
2 endpoint baru **conversation-trend** & **conversation-trend-hourly** muncul
saat eksplorasi ulang):

| Endpoint | Status | Spec Swagger |
|---|---|---|
| `GET /health/live` | ✅ 200 | `{ status: "live" }` |
| `GET /health/ready` | ✅ 200 | `{ status: "ready" }` (503 bila belum siap) |
| `GET /v1/dashboard/summary` | ✅ 200 | query opsional: keyword, platform, date_from, date_to |
| `GET /v1/dashboard/conversation-trend` | ✅ 200 | query opsional: keyword, platform, period (`24h`/`3d`/`7d`/`1m`/`1y`/`YYYY-MM-DD`/range) — malformed → fallback 1 bulan |
| `GET /v1/dashboard/conversation-trend-hourly` | ✅ 200 · 400 | query: date (`YYYY-MM-DD`, **wajib**) + keyword/platform opsional — tanpa date / format salah → 400 `invalid_request` |

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
