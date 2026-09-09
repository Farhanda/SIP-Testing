# Testing API Backend — `tests/be/`

Test **API backend** (platform BE) dengan Playwright `APIRequestContext`
(fixture `api`). Terpisah dari test UI (FE) dan generator hasil (AI).

> ℹ️ **Kanonik untuk Dashboard Service (2026-09-09):** suite ini adalah
> **satu-satunya** tempat test API dashboard-service (env `BASE_URL_BE`,
> default `http://10.200.101.13:8091`). Case unik dari eksplorasi sebelumnya
> (data-driven keyword×platform, varian period, validasi hourly) sudah
> di-port ke sini (`summary.spec.ts`, `conversation-trend.spec.ts`, data
> `test-data/be-dashboard-combos.json`). Project test mock service terpisah
> sudah dihapus — jangan menambah test dashboard di luar project ini.

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
| `BASE_URL_BE` | `http://10.200.101.13:8091` | Base URL API backend (dashboard-service) |
| `BE_API_PREFIX` | `/v1` | Prefiks versi API |
| `BASE_URL_SCRAPER` | `http://10.200.101.13:8090` | Base URL Scraper Service API (folder `tests/be/scraper/`) |

## Sumber kebenaran: Swagger BE

Spec OpenAPI live ada di **`{BASE_URL_BE}/swagger/`**
(UI: `/swagger/index.html`, spec JSON: `/swagger/doc.json`).

### Status endpoint (diverifikasi 2026-09-09 — eksplorasi ulang dashboard-service)

Dashboard-service kini memiliki **21 endpoint** (audit `swagger/doc.json` live
2026-09-09). Semua sudah di-cover test di `tests/be/dashboard/`. Endpoint yang
ditambahkan/ditemukan sejak audit 2026-08-18: **posts/{id}, posts-export,
top-keywords, top-posts-list, trending-topic-multi-period, protocol-status**,
serta 5 ex-GAP (trending-topic, emotion-map, sentiment-map, sentiment-trend,
sentiment-trend-hourly) yang kini **sudah diimplementasikan** (200).

| Endpoint | Status | Spec Swagger |
|---|---|---|
| `GET /health/live` | ✅ 200 | `{ status: "live" }` |
| `GET /health/ready` | ✅ 200 | `{ status: "ready" }` (503 bila belum siap) |
| `GET /v1/dashboard/summary` | ✅ 200 | query opsional: keyword, platform, date_from, date_to |
| `GET /v1/dashboard/conversation-trend` | ✅ 200 | query opsional: keyword, platform, period (`24h`/`3d`/`7d`/`1m`/`1y`/`YYYY-MM-DD`/range) — malformed → fallback 1 bulan |
| `GET /v1/dashboard/conversation-trend-hourly` | ✅ 200 · 400 | query: date (`YYYY-MM-DD`, **wajib**) + keyword/platform opsional — tanpa date / format salah → 400 `invalid_request` |
| `GET /v1/dashboard/top-accounts` | ✅ 200 | `{ data: [{ id, handle, platform, posts }] }` — id = slug lowercase, handle = display name; urut posts desc; maks 5 |
| `GET /v1/dashboard/top-hashtags` | ✅ 200 | `{ data: [{ id, tag, count }] }` — tag `#Xxx`; urut count desc; maks 5 |
| `GET /v1/dashboard/top-posts` | ✅ 200 | `{ data: [{ id, platform, post, emotion, topic, engagement }] }` — urut engagement desc; maks 5 |
| `GET /v1/dashboard/top-posts-list` | ✅ 200 | `{ data: { stats, posts }, meta: { page,size,total,totalPages } }` — paginated; filter: keyword/platform/period/search/emotion/**actor/hashtag/topic/sentiment**; sort: `sort_by=view\|engagement\|published_at`, `sort_order=asc\|desc` |
| `GET /v1/dashboard/top-keywords` | ✅ 200 | `{ data: [{ id, keyword, count }], meta }` — urut count desc; `limit` 1-50 (default 10, clamp) |
| `GET /v1/dashboard/posts/{id}` | ✅ 200 · 404 | detail satu post (metrics lengkap, hashtags[], keywords[]); id tak dikenal → 404 `not_found` |
| `GET /v1/dashboard/posts-export` | ✅ 200 | export **xlsx** (Content-Type spreadsheetml.sheet, attachment `post-<kw?>-<period>-<YYYYMMDD>.xlsx`); filter keyword/platform/period; malformed period → fallback 1m |
| `GET /v1/dashboard/topic-intelligence` | ✅ 200 | `{ data: [{ id, label, pct, count }], meta: { total } }` — id = label; pct = round(count/total*100); `limit` memotong `data` tapi `meta.total` tetap distribusi penuh |
| `GET /v1/dashboard/topic-intelligence-detail` | ✅ 200 · 400 · 404 | query: `topic` (**wajib**, exact) + keyword/search/sentiment/emotion/page/size/`sort_by` — tanpa topic → 400; topic/keyword tidak cocok → 404; page/size di-clamp (size max 50, default 6) |
| `GET /v1/dashboard/trending-topic` | ✅ 200 | `{ data: [{ id, topic, volume, delta }], meta: { period, total } }` — period `24H`/`7D` (lowercase di-uppercase) |
| `GET /v1/dashboard/trending-topic-multi-period` | ✅ 200 | trending topic lintas beberapa period sekaligus |
| `GET /v1/dashboard/emotion-map` | ✅ 200 | `{ data: [{ emotion, pct, color }], meta }` |
| `GET /v1/dashboard/sentiment-map` | ✅ 200 | `{ data: [{ sentiment, pct, color }], meta }` |
| `GET /v1/dashboard/sentiment-trend` | ✅ 200 | `{ data: [{ date, label, positive, negative }], meta }` |
| `GET /v1/dashboard/sentiment-trend-hourly` | ✅ 200 | `{ data: [{ hour, label, positive, negative }], meta: { date } }` |
| `GET /v1/dashboard/protocol-status` | ✅ 200 | status protokol/health internal dashboard-service |

> 💡 **Quirk kontrak** (terdokumentasi sebagai test):
> - `stats` di topic-intelligence-detail **mengabaikan** filter
>   search/sentiment/emotion — hanya keyword/topic/platform/period yang
>   memengaruhi scope stats, jadi nilai yang tidak cocok pun tetap 200
>   (posts kosong), bukan 404.
> - **`actor` di top-posts-list mencocokkan field `handle` (display name),
>   case-sensitive — BUKAN `id` (slug).** `actor=SudutTakKasat` → 22 post,
>   `actor=suduttakkasat` → 0. Swagger menyebut "values come from
>   top-accounts"; yang cocok hanya `handle` persis (TC-BE-D248/D249).
> - **`hashtag` ditulis tanpa `#` dan case-sensitive** (`hashtag=prabowo`
>   → 116, `hashtag=Prabowo` → 0). `sentiment`/`emotion` case-insensitive dan
>   menerima label Indonesia maupun Inggris (netral==neutral, positif==positive).
> - **emotion-map `pct` dapat berjumlah 99** (bukan 100) karena pembulatan
>   per-item; sentiment-map berjumlah 100. Quirk minor, bukan bug keras.

> ✅ **Coverage parameter Swagger (2026-09-09):** audit ulang `swagger/doc.json`
> — 21 endpoint aktif, semua sudah di-test. Kekosongan yang ditutup di sesi ini:
> **posts/{id}** & **posts-export** (sebelumnya NOL coverage) — 14 test baru
> (TC-BE-D232–D245); parameter baru **top-posts-list** (actor/hashtag/topic/
> sentiment/sort_order/sort_by=published_at) — 8 test (TC-BE-D246–D253);
> **top-keywords limit** — 5 test (TC-BE-D254–D258); **topic-intelligence
> limit** & **detail sort_by** — 4 test (TC-BE-D259–D262).

### ✅ Ex-GAP endpoints (sudah diimplementasikan di Go — regression guard)

Audit integrasi FE↔BE 2026-08-18 menemukan 5 endpoint dipanggil FE tapi tidak
ada di router Go (semua 404). Sejak 2026-08-20 kelimanya **sudah aktif** (200).
`missing-endpoints.spec.ts` kini menjadi **regression guard** (ekspektasi 200 +
struktur), bukan lagi dokumentasi gap:

| Endpoint (dipanggil `src/services/dashboard.ts`) | Status | Kontrak |
|---|---|---|
| `GET /v1/dashboard/trending-topic?period=24H\|7D` | ✅ 200 | `{ data: [{ id, topic, volume, delta }], meta: { period, total, generated_at } }` |
| `GET /v1/dashboard/emotion-map` | ✅ 200 | `{ data: [{ emotion, pct, color }], meta }` |
| `GET /v1/dashboard/sentiment-map` | ✅ 200 | `{ data: [{ sentiment, pct, color }], meta }` |
| `GET /v1/dashboard/sentiment-trend` | ✅ 200 | `{ data: [{ date, label, positive, negative }], meta }` |
| `GET /v1/dashboard/sentiment-trend-hourly` | ✅ 200 | `{ data: [{ hour, label, positive, negative }], meta: { date } }` |

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

## Scraper Service API — `tests/be/scraper/` (port 8090, service ganda)

Selain api-gateway (`BASE_URL_SCRAPE`, 8080), ada **Scraper Service API**
terpisah di **`http://10.200.101.13:8090`** (env `BASE_URL_SCRAPER`,
Swagger: `/swagger/` — ditemukan & di-cover 2026-09-02):

- **Tanpa prefix `/scrape/`** di path (mis. `GET /v1/keyword-management`,
  `GET /v1/credential`, `GET /v1/platform`, `GET /v1/keyword`,
  `POST /v1/scrape`) dan **tanpa autentikasi**.
- Data & kontrak identik dengan gateway 8080 (endpoint `/v1/scrape/*` di
  gateway = `/v1/*` di sini) — test di folder ini memverifikasi kontrak
  service langsung, termasuk `GET /v1/keyword-management/summary`,
  `scheduled-holds`, dan perilaku `GET /v1/scrape/{id}` (unknown → 404).
- Pola write lifecycle sama: **create sukses sengaja tidak diuji** (tanpa
  DELETE → berisiko mencemari staging); yang diuji hanya validasi negatif
  (POST body kosong → 400) yang aman.
- **Audit write lifecycle 2026-09-02** (`write-lifecycle.spec.ts`):
  `POST /v1/keyword-management` & `POST /v1/credential` → **201 tanpa
  unique constraint** (duplikat pun 201 + insert baris baru) dan **tidak ada
  DELETE di service manapun** — create = cipratan staging permanen yang tak
  bisa dibersihkan via API (terbukti nyata saat audit). Karena itu create
  TIDAK diuji; yang diuji hanya pola aman & reversibel: PUT id tak dikenal
  → 404, **PUT round-trip** (modifikasi period lalu restore persis di
  `finally`), dan **PATCH activate/deactivate round-trip** (pola sama dengan
  toggle credential TC-BE-SR11).
- 24 case (TC-BE-SR01–SR24) di sheet **Scraper** Excel BE.

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
  ⚠️ **Tidak disarankan mengisi angka** untuk DB live yang terus bertambah
  (data drift: run 2026-09-07 dataset 17 vs live 15). Konsistensi
  top-keywords ↔ summary kini diverifikasi LIVE per run di
  `top-keywords.spec.ts`, tanpa angka terkunci.

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

   Khusus service di `tests/be/scraper/`, pakai fixture `scraperApi` dari
   `../fixtures` (base URL `BASE_URL_SCRAPER`) — lihat spec yang ada.
