# Automation Web UI Testing — Playwright

Automation **Web UI (E2E) + API** testing dengan **Playwright + TypeScript** untuk aplikasi **SIP Insight** (Next.js). Menguji **3 platform**: FE (web app — role **admin** & role **client**), BE (**3 service backend**: dashboard-service, scrape service/api-gateway, & scraper service), dan AI (**2 service**: SIP AI Service & Intelligence AI Service) — dengan konvensi fixtures, data-driven, report HTML, dan generator Excel. Target deployment dikonfigurasi via `.env` (default staging `10.200.101.13`).

> 📖 **User Guide aplikasi** (bukan automation): lihat `docs/user-guide.md`, `docs/guide-admin.html`, & `docs/guide-client.html` (versi pdf/docx/rtf juga tersedia di `docs/`).

## Fitur

- ✅ **Test per platform** — `tests/fe/` (Web UI), `tests/be/` (API backend: dashboard-service + scrape service + scraper service), `tests/ai/` (SIP AI Service + Intelligence AI Service + generate hasil dari data BE); dijalankan terpisah via `npm run test:fe|be|ai`
- ✅ **Multi-project per modul** — `login`, `dashboard`, `keyword`, `control`, `user` (User Management **+ Provider Management**), `profile`, `smoke`, **+ suite role client** (`client-login`, `client-home`, `client-access`, `client-display`, `client-logout` — folder `tests/fe/<modul>/` otomatis masuk project-nya)
- ✅ **Page Object Model** — selector & aksi halaman terpusat di `src/pages/`
- ✅ **Deterministik** — endpoint API simulasi yang punya *random failure* di-mock (`src/helpers/api-mock.ts`) dengan bentuk respons yang sama dengan API asli; test integrasi asli ada di `smoke`
- ✅ **Data-driven test** — data dari file JSON di `test-data/`, tambah baris tanpa ubah kode test
- ✅ **Cross-browser** — Chromium default; Firefox/WebKit via env `UI_BROWSERS`
- ✅ **Mode headed & headless** — via env `UI_HEADED`
- ✅ **Report HTML** — otomatis dibuat, buka dengan `npm run report`
- ✅ **Trace, screenshot & video on failure** — memudahkan debugging
- ✅ **Ekspor test case ke Excel** — lengkap dengan status PASS/FAIL (`npm run test-cases`)
- ✅ **Test regresi bug** — `tests/fe/*/regression-bugs.spec.ts` meng-encode perilaku yang **benar** (kategori `Regression`): sengaja FAIL selama bug belum diperbaiki. Status saat ini:
  - ✅ **PASS — bug fixed**: R2 tanggal terbalik ditolak (validasi di dialog Add scheduled, deploy 2026-09), L05/A1 login redirect (auth asli sudah aktif)
  - 🔴 **Masih merah (bug terbuka)**: R9 Escape tidak menutup modal Add keyword, R10 raw error codes ter-expose di keyword list, C7/P04 change password tanpa verifikasi current password (R4/U06: test kini PASS — delete Super Admin diguard di UI dengan tidak mengirim request)
  - 🗑️ **Dihapus**: D29 protocol status badge (elemen sudah dihapus dari UI)
  - ♻️ **Dikembalikan (deploy 2026-09)**: A2/D10 Export report (kini unduh `posts-report.xlsx` via event download — verifikasi di `dashboard-features.spec.ts`), R1 (Add scheduled) & B4 (Move to scheduled) — tab Scheduled & aksi Move/Edit kembali aktif; coverage positifnya ada di `keyword-modals.spec.ts` (Add scheduled POST) & `keyword-actions.spec.ts` (Move/Edit PUT)
- ✅ **Auth asli + storageState (2026-08)** — aplikasi kini memakai login sungguhan. Project setup `auth` login via UI sekali (kredensial `UI_TEST_USERNAME` / `UI_TEST_PASSWORD` di `.env`) dan menyimpan storageState di `.auth/fe-state.json` yang dipakai semua project modul **kecuali `login`** (halaman `/login` di-redirect ke dashboard bila sudah terautentikasi). Route `/display/*` memang tanpa login (by design — wall publik).
- ✅ **Coverage modul baru** — Provider Management (`/administration/provider`, konsumsi BE langsung `/v1/scrape/credential`)
- 📌 **Di luar lingkup (2026-09-07)** — halaman Keyword Intelligence (`/monitoring/keyword-intelligence`) & Control Protocol walls (`/control/*`) TIDAK dites: fitur belum digunakan produk & tidak ada tombol/link navigasinya di UI (test lama tersedia di arsip git)
- ✅ **Perbaikan UI deploy 2026-09** — halaman Posts kini **8 kolom** (`Platform, Published, Post, Emotion, Sentiment, Topic, Views, Engagement`), teks post jadi link ke sumber asli (`source_url`, tab baru, tombol Show more), dan **Top accounts clickable** — klik akun membuka halaman posts dengan filter `platform` + `actor` terisi otomatis (di `posts-page.spec.ts` & `dashboard.spec.ts`)
- ✅ **BE scrape service** — modul `tests/be/scrape/`: health api-gateway, platform, keyword-management (filter/pagination), credential (+ toggle round-trip aman), validasi create on-demand
- ✅ **BE scraper service langsung** — modul `tests/be/scraper/` (`BASE_URL_SCRAPER`, :8090, tanpa prefix `/scrape/`): kontrak, keyword-management summary & scheduled-holds, on-demand, write lifecycle audit (PUT/PATCH round-trip reversibel — create sengaja tidak diuji)
- ✅ **AI Intelligence Service** — modul `tests/ai/intelligence/` (`BASE_URL_AI_INTELLIGENCE`, :8000, header `X-AI-Service-Token`): health publik, topic & actor intelligence (401/400/200|429 saat kuota provider habis)
- ✅ **Role client (RBAC)** — suite `tests/fe/client/`: login client, home page, display wall, access control (halaman admin redirect ke `/monitoring/home`), logout; auth state terpisah di `.auth/fe-client-state.json` (kredensial `UI_CLIENT_USERNAME`/`UI_CLIENT_PASSWORD`)
- ✅ **Dokumentasi user guide** — Admin & Client User Guide di `docs/` (html/pdf/docx/rtf) + video guide
- ✅ **Test validasi form** — P03 Change Password (3 skenario invalid + 1 valid) di `tests/fe/profile/profile.spec.ts`
- ✅ **Test positif API asli** — P05 Change password dengan current password BENAR → toast sukses & modal tertutup (pasangan C7)
- ✅ **Tidak ada secret hardcoded** — konfigurasi lewat `.env`

## Struktur Project

```
├── playwright.config.ts            # Konfigurasi DEFAULT — semua platform dalam satu run (npm test)
├── playwright.fe.config.ts         # Konfigurasi FE — project per modul admin + role client (npm run test:fe)
├── playwright.be.config.ts         # Konfigurasi BE — test API (tests/be/)
├── playwright.ai.config.ts         # Konfigurasi AI — generate hasil dari data BE
├── src/
│   ├── config/env.ts               # Baca konfigurasi dari .env
│   ├── helpers/
│   │   ├── api-mock.ts             # ⭐ Mock API simulasi (deterministik)
│   │   ├── auth.ts                 # Setup auth admin (storageState .auth/fe-state.json)
│   │   ├── client-auth.ts          # Setup auth client (storageState .auth/fe-client-state.json)
│   │   ├── data.ts                 # Load test data JSON & CSV
│   │   └── ui-assert.ts            # Assertion helper khusus UI
│   └── pages/                      # ⭐ Page Object Model (FE)
│       ├── BasePage.ts             #   + selector navbar global (getter)
│       ├── LoginPage.ts
│       ├── DashboardPage.ts
│       ├── KeywordPage.ts
│       ├── UnscheduledDetailPage.ts
│       ├── DisplayWallPage.ts      #   Display wall (conversation overview & top engagement)
│       ├── PostsPage.ts            #   Top posts list (/monitoring/dashboard/posts)
│       ├── TopicDetailPage.ts
│       ├── ProviderPage.ts         #   Provider Management (/administration/provider)
│       ├── UserManagementPage.ts
│       └── ProfilePage.ts
├── tests/                          # ⭐ Test per platform
│   ├── fe/                         #   Platform FE — Web UI testing
│   │   ├── fixtures.ts             #   Custom fixtures (POM siap pakai)
│   │   ├── auth.setup.ts           #   Setup storageState admin (login via UI sekali)
│   │   ├── smoke/                  #   Navigasi, dropdown navbar, dark mode, responsif
│   │   ├── login/
│   │   ├── dashboard/              #   Dashboard + posts page + topic detail + integrasi BE
│   │   ├── keyword/                #   Monitoring Keyword
│   │   ├── control/                #   Display wall: conversation-overview, top-engagement
│   │   ├── administration/         #   User Management + Provider Management
│   │   ├── profile/
│   │   └── client/                 #   Role client (RBAC): login, home, display-wall, access-control, logout
│   ├── be/                         #   Platform BE — 3 service backend
│   │   ├── fixtures.ts             #   api (dashboard-service) + scrapeApi (api-gateway) + scraperApi
│   │   ├── health/                 #   GET /health/live · /health/ready (dashboard-service)
│   │   ├── dashboard/              #   17 endpoint /v1/dashboard/* (incl. top-keywords, multi-period)
│   │   ├── scrape/                 #   Scrape service (api-gateway :8080): health, platform, keyword-management, credential, on-demand
│   │   ├── scraper/                #   Scraper service langsung (:8090): kontrak, on-demand, write lifecycle
│   │   └── README.md
│   └── ai/                         #   Platform AI — SIP AI Service + Intelligence + generate hasil dari data BE
│       ├── fixtures.ts             #   api, aiApiUrl/intelApiUrl, aiHeaders/intelHeaders, uniqueKey
│       ├── health/                 #   GET /v1/health (liveness + kuota + 401)
│       ├── meta/                   #   GET /v1/meta (taxonomy label)
│       ├── analyze/                #   batch · jobs (polling) · sync
│       ├── intelligence/           #   Intelligence AI Service (:8000): health, topic- & actor-intelligence
│       ├── report.ts               #   Helper bangun laporan dari data BE
│       ├── generate-report.spec.ts
│       └── README.md
├── docs/                           # User guide aplikasi (Admin & Client: html/pdf/docx/rtf + video)
├── test-data/                      # ⭐ Data test (JSON)
│   ├── ai-sync-posts.json
│   ├── be-dashboard-combos.json
│   ├── be-dashboard-keywords.json
│   ├── dashboard-keywords.json
│   ├── keyword-filters.json
│   └── user-filters.json
└── scripts/
    ├── generate-test-cases.mjs     # Ekspor test case ke Excel
    ├── open-reports.mjs            # Buka semua report HTML (npm run report)
    └── weekly-report/
        ├── fill-weekly-report.mjs  # Isi SIP_Weekly_Developer_Report.xlsx dari data JSON
        └── data/
            └── current.json        # Data laporan minggu berjalan (edit tiap minggu)
```

## Setup

```bash
npm install
# (opsional) copy & sesuaikan env
cp .env.example .env
```

Install browser Playwright (sekali saja):

```bash
npx playwright install chromium
# alternatif: pakai Google Chrome yang sudah ter-install
# set UI_BROWSER_CHANNEL=chrome di .env (tanpa perlu install browser)
```

> ⚠️ **Prasyarat**: aplikasi target harus berjalan dan dapat diakses — FE (`BASE_URL_UI`), dashboard-service (`BASE_URL_BE`), scrape service/api-gateway (`BASE_URL_SCRAPE`), scraper service (`BASE_URL_SCRAPER`), AI Service (`BASE_URL_AI`), & Intelligence AI Service (`BASE_URL_AI_INTELLIGENCE`) sesuai platform yang mau diuji. Smoke test & beberapa spec memakai API asli, jadi BE juga harus hidup.

## Menjalankan Test

```bash
npm test                   # SEMUA platform (FE + BE + AI) dalam satu run
npm run test:fe            # Test Web UI (semua project: auth + 7 modul admin + 5 modul client)
npm run test:be            # Test API backend
npm run test:ai            # Generate hasil dari data BE
npm run test:smoke         # FE: Navigasi & smoke
npm run test:login         # FE: Hanya Login
npm run test:dashboard     # FE: Hanya Dashboard
npm run test:keyword       # FE: Hanya Monitoring Keyword
npm run test:control       # FE: Hanya Display Wall (conversation overview & top engagement)
npm run test:user          # FE: Hanya User Management
npm run test:profile       # FE: Hanya Profile
npm run test:client        # FE: Suite role client (login/home/display/access/logout)
npm run test:headed        # FE: mode headed (lihat browser, debug)
npm run report:fe          # Buka report HTML FE
npm run report:be          # Buka report HTML BE
npm run report:ai          # Buka report HTML AI
npm run report             # Buka SEMUA report (FE + BE + AI + gabungan) sekaligus
```

**Cross-browser** (FE, semua modul × browser):

```bash
UI_BROWSERS=chromium,firefox,webkit npm run test:fe
```

## Platform — Folder Test Per Platform

Test dipisah per platform di folder `tests/<platform>/` — masing-masing punya
konfigurasi Playwright sendiri sehingga bisa dijalankan **terpisah** sesuai
platform yang mau diuji:

| Platform | Folder | Config | Command | Report HTML |
|---|---|---|---|---|
| **Gabungan** (semua platform) | `tests/` | `playwright.config.ts` (default) | `npm test` | `playwright-report/` |
| **FE** (Web UI, admin + client) | `tests/fe/` | `playwright.fe.config.ts` | `npm run test:fe` | `playwright-report-fe/` |
| **BE** (API) | `tests/be/` | `playwright.be.config.ts` | `npm run test:be` | `playwright-report-be/` |
| **AI** (SIP AI + Intelligence + generate dari data BE) | `tests/ai/` | `playwright.ai.config.ts` | `npm run test:ai` | `playwright-report-ai/` |

Filter lebih spesifik saat menjalankan (nama folder / judul test):

```bash
npx playwright test                                          # Semua platform (config default)
npx playwright test -c playwright.fe.config.ts tests/fe/keyword    # FE: hanya modul keyword
npx playwright test -c playwright.be.config.ts tests/be/dashboard  # BE: hanya folder dashboard
npx playwright test -c playwright.ai.config.ts -g "insight"        # AI: hanya judul tertentu
```

Hasil JSON tiap platform terpisah: `test-results/results.json` (FE, dipakai
generator Excel), `test-results/results-be.json` (BE, dibaca platform AI),
dan `test-results/results-ai.json` (AI). Untuk Excel test case, jalankan run
per platform (`npm run test:fe|be|ai`) lalu `npm run test-cases` agar kolom
eksekusi terisi per platform-nya.

> ⚠️ **`results.json` hanya ditulis oleh run FE lengkap (`npm run test:fe`).**
> Run per project (`npm run test:smoke|login|dashboard|keyword|control|user|profile|client|headed`)
> memakai `--reporter=list` sehingga **tidak menimpa** report FE — kalau tertimpa
> run partial, generator Excel kehilangan status test case lain (warning
> "TIDAK ter-map ke report"). Cukup jalankan `npm run test:fe` lalu
> `npm run test-cases` untuk memulihkannya.

## Test Case dalam Format Excel

Test case diekspor ke Excel per platform, lengkap dengan status hasil eksekusi:

```bash
# 1. Jalankan test (hasil → test-results/results.json · results-be.json · results-ai.json)
npm run test:fe
npm run test:be
npm run test:ai

# 2. Generate Excel
npm run test-cases        # Semua platform: FE + BE + AI
npm run test-cases:fe     # Hanya FE  → test-cases/UI-Test-Cases.xlsx
npm run test-cases:be     # Hanya BE  → test-cases/BE-Test-Cases.xlsx
npm run test-cases:ai     # Hanya AI  → test-cases/AI-Test-Cases.xlsx
```

Format Excel (template **test case management 21 kolom**): sheet **Ringkasan** (info project, rincian jumlah test per modul, HASIL TEST TERAKHIR, LEGENDA, CATATAN), sheet **Coverage TC-UI** (FE saja — mapping 12 test case TC-UI dari `TEST_PLAN_SIP_SPRINT_1.md` §7.5 ke test otomasi + status coverage), lalu satu sheet per modul (FE: Smoke, Login, Dashboard, Keyword, Control, User, Provider, Profile, **Client** · BE: Health, Dashboard, Scrape, **Scraper** · AI: Health, Meta, Analyze Batch/Jobs/Sync, Generate, **Intelligence**) dengan kolom:

| No | Test Case ID | Nama Test Case | Kategori | Priority | Method | Endpoint | Headers | Parameter/Query | Request Body | Precondition | Expected Status | Expected Response | Assertions Utama | Sumber Data | Actual Result | Status | Environment | Executed By | Tanggal Eksekusi | Notes/Bug Link |

— lengkap dengan badge kategori & status berwarna, zebra, border, frozen header, autofilter, dan page setup landscape. Kolom **Kategori** & **Status** (dan **Status Coverage** di sheet Coverage) memakai **dropdown (data validation)** — nilainya dipilih dari daftar, bukan diketik manual.

Kolom eksekusi diisi otomatis: **Actual Result** & **Status** dari file report platform-nya (`test-results/results.json` untuk FE, `results-be.json` untuk BE, `results-ai.json` untuk AI), **Tanggal Eksekusi** dari mtime report, **Environment** & **Executed By** dari env (`TEST_ENV`, `TEST_EXECUTED_BY`).

> Kolom `Method` = jenis interaksi UI utama (Navigate / View / Form / Filter / Modal / Toggle); `Endpoint` = halaman aplikasi yang diuji (path URL); `Request Body` = input form / payload yang dikirim user di UI. Data-driven otomatis dibaca dari `test-data/`.

> Jika test belum pernah dijalankan, kolom "Hasil Test" berisi strip (`—`).

## Menambah Test Baru

1. **Buat/update POM di `src/pages/`** — semua selector halaman tinggal di sini:

   ```ts
   export class SamplePage extends BasePage {
     readonly heading = this.page.getByRole('heading', { name: 'Sample' });
     async goto() { await this.page.goto('/sample'); }
   }
   ```

2. **Daftarkan fixture** di `tests/fe/fixtures.ts` (pola sama dengan project API):

   ```ts
   samplePage: async ({ page }, use) => use(new SamplePage(page)),
   ```

3. **Tulis spec** di `tests/fe/<modul>/` (folder menentukan project):

   ```ts
   import { test, expect } from '../fixtures';

   test.describe('Sample', () => {
     test('halaman sample terbuka', async ({ samplePage }) => {
       await samplePage.goto();
       await expect(samplePage.heading).toBeVisible();
     });
   });
   ```

4. **Data-driven** — tambahkan data di `test-data/` lalu loop (lihat `tests/fe/dashboard/dashboard.spec.ts`).

5. **Mock API bila halaman mengonsumsi endpoint dengan random failure** — pakai helper di `src/helpers/api-mock.ts` (bentuk respons mengikuti `src/pages/api/*` di aplikasi).

> 💡 Jika menambah test case, tambahkan juga barisnya di `scripts/generate-test-cases.mjs` (`specTitle` harus **persis** sama dengan judul test) supaya Excel selalu sinkron.

## Ganti Environment FE (dev / staging / prod)

URL aplikasi FE per environment — dev & staging hanya bisa diakses dari **wifi kantor**, prod bisa diakses **di mana saja**:

| UI_ENV | URL | Akses |
|---|---|---|
| `dev` | `http://10.200.101.13:3000` | WiFi kantor |
| `staging` | `http://10.200.101.6:3000` | WiFi kantor |
| `prod` | `https://sip.c2signals.com` | Di mana saja |

Cara pakai — pilih **satu** saja:

```bash
# Opsi 1 — via UI_ENV di .env (paling praktis):
#   UI_ENV=dev | staging | prod

# Opsi 2 — sekali jalan via env var (tanpa mengubah .env):
UI_ENV=staging npm run test:fe
UI_ENV=prod    npm run test:smoke

# Opsi 3 — URL custom via CLI (env var CLI selalu menang atas isi .env,
# jadi Opsi 3 tetap bekerja walau .env sudah berisi UI_ENV=staging):
BASE_URL_UI=http://localhost:3000 npm run test:fe
```

Prioritas: **env var CLI > `.env` > default `dev`**; di dalam sumber yang sama,
`UI_ENV` dipakai sebelum `BASE_URL_UI`. Nilai `UI_ENV` yang tidak dikenal
langsung menghentikan run dengan pesan error yang jelas.
Kolom **Environment** di Excel test case mengikuti URL otomatis
(`Dev`/`Staging`/`Production`) — atau paksa via env `TEST_ENV`.

> ⚠️ **HATI-HATI saat `UI_ENV=prod`**: test menulis data (login, change
> password, dsb.) — pastikan environment & kredensial test sudah benar sebelum
> menjalankan suite ke production.

## Konfigurasi Environment (`.env`)

| Variabel | Default | Keterangan |
|---|---|---|
| `UI_ENV` | `dev` | Profil environment FE: `dev` / `staging` / `prod` — dipakai sebelum `BASE_URL_UI` bila dari sumber yang sama (lihat tabel di atas) |
| `BASE_URL_UI` | URL sesuai `UI_ENV` | URL aplikasi web target eksplisit — env var CLI selalu menang atas isi `.env` |
| `UI_HEADED` | (kosong = headless) | `1` untuk mode browser terlihat |
| `UI_BROWSERS` | `chromium` | Daftar browser, pisah koma |
| `UI_BROWSER_CHANNEL` | (kosong) | `chrome` untuk pakai Google Chrome sistem |
| `UI_TIMEOUT` | `15000` | Timeout assertion (ms) |
| `BASE_URL_BE` | `http://10.200.101.13:8091` | Base URL **dashboard-service** (platform BE) |
| `BE_API_PREFIX` | `/v1` | Prefiks versi API backend |
| `BASE_URL_SCRAPE` | `http://10.200.101.13:8080` | Base URL **scrape service / api-gateway** (keyword-management, credential, platform) |
| `BASE_URL_AI` | `http://10.200.102.2:8100` | Base URL AI Service (docs: `/docs`) |
| `AI_SERVICE_TOKEN` | `dev-local-service-token` | Token header `X-Service-Token` (AI Service) |
| `TEST_ENV` | `Local`/`Staging` | Environment di kolom Excel test case |
| `TEST_EXECUTED_BY` | `—` | Nama eksekutor di kolom Excel test case |
| `UI_TEST_USERNAME` | `admin` | Username user test untuk login UI (setup auth & test case login) |
| `UI_TEST_PASSWORD` | *(dari env)* | Password user test untuk login UI (setup auth & test case login) |
| `UI_CLIENT_USERNAME` | `client` | Username role client (suite `tests/fe/client/`, auth state terpisah) |
| `UI_CLIENT_PASSWORD` | *(dari env)* | Password role client (suite `tests/fe/client/`) |
| `UI_ADMIN_CURRENT_PASSWORD` | *(dari env)* | Password admin saat ini — regression change-password P05 (`tests/fe/profile/regression-bugs.spec.ts`) |
| `BASE_URL_SCRAPER` | `http://10.200.101.13:8090` | Base URL **scraper service langsung** (tanpa prefix `/scrape/`; Swagger `/swagger/`) — folder `tests/be/scraper/` |
| `BASE_URL_AI_INTELLIGENCE` | `http://10.200.102.2:8000` | Base URL **Intelligence AI Service** (docs: `/docs`) — folder `tests/ai/intelligence/` |
| `AI_INTELLIGENCE_TOKEN` | *(dari env)* | Token header `X-AI-Service-Token` (Intelligence AI Service — **beda** dari `AI_SERVICE_TOKEN`) |

## Catatan Penting

- **Aplikasi target**: auth **asli sudah aktif** — login memanggil API auth; route selain `/login` & `/display/*` wajib login (guard redirect ke `/login?redirect=...`, dan sukses login redirect balik). Sebagian data datang dari API route Next.js (`/api/*`) yang mensimulasikan latensi & kegagalan acak, sebagian lagi memanggil BE langsung. Karena itu test fungsional utama memakai **mock API** agar deterministik; validasi integrasi dengan API asli ada di `tests/fe/smoke/`, `tests/fe/dashboard/api-integration.spec.ts` (KPI dari `GET /v1/dashboard/summary`), `tests/fe/dashboard/be-widgets.spec.ts` (chart & Top accounts/hashtags dari BE), dan display wall (chart endpoints BE asli; hanya daftar keyword yang di-mock). Display wall (`/display/*`) **sengaja tanpa login** (by design) dan branding "SIP Insight" di wall **sengaja bukan link** (by design, konfirmasi owner).
- **Arsitektur backend = 3 service**:
  - **dashboard-service** (`BASE_URL_BE`, default `:8091`) — 17 endpoint `/v1/dashboard/*` + `/health/live|ready` (Swagger di `/swagger/doc.json`). Semua dites di `tests/be/dashboard/`.
  - **scrape service / api-gateway** (`BASE_URL_SCRAPE`, default `:8080`) — `/health`, `/v1/scrape/platform`, `/v1/scrape/keyword-management` (GET/POST/PUT), `/v1/scrape` (create on-demand), `/v1/scrape/credential` (CRUD + PATCH enable/disable). Dites di `tests/be/scrape/`. Write lifecycle valid sengaja tidak diuji langsung ke staging (tidak ada endpoint DELETE → tak bisa bersih-bersih); alur sukses ter-cover via mock FE.
  - **scraper service langsung** (`BASE_URL_SCRAPER`, default `:8090`) — backend scraper tanpa prefix `/scrape/` & tanpa autentikasi (`/v1/keyword-management`, `/v1/credential`, `/v1/platform`, `/v1/scrape`, dst.; Swagger `/swagger/`). Kontrak identik dengan gateway — dites di `tests/be/scraper/` (24 case TC-BE-SR01–SR24, termasuk audit write lifecycle: create sukses sengaja tidak diuji karena tanpa unique constraint & tanpa DELETE → cipratan staging permanen).
- **Perubahan besar UI (deploy 2026-08 → 2026-09)** yang sudah diadaptasi suite:
  - Halaman Keyword memakai endpoint baru `/v1/scrape/keyword-management` (satu endpoint untuk tab Scheduled & On Demand via `schedule_enabled=true|false`); default landing tab = **On Demand**; Reprocess menggantikan Retry/Cancel/Run history.
  - **Tab Scheduled kembali aktif (deploy 2026-09)**: aksi **Add scheduled** (`+ Add keyword`, POST `schedule_enabled=true`), **Edit** & **Move to scheduled / to on-demand** (PUT `/keyword-management/:id`) — ketiganya memakai dialog jadwal berisi keyword + checkbox platform + start/end datetime-local + frequency value/unit.
  - Modal Add On Demand kini memakai **checkbox platform** (bukan dropdown) dan **selector period dihapus** dari modal; validasi urutan tanggal (start ≤ end) hidup di dialog jadwal → regression R2 kini PASS.
  - Display wall mengambil keyword dari `top-keywords?limit=5` dan berotasi tiap ~20 detik (label "20 seconds" = label interval statis).
  - Halaman **Keyword Intelligence** (`/monitoring/keyword-intelligence`) & **Control Protocol walls** (`/control/*`) ada di aplikasi tapi DI LUAR LINGKUP testing (fitur belum digunakan, tanpa tombol navigasi — keputusan 2026-09-07).
  - Tombol Export report **masih ada** di dashboard (diverifikasi 2026-08-31).
- **Bug aplikasi yang diketahui (hasil bug-hunt BE 2026-08)** — dipantau test regresi / belum ada guard-nya:
  - Endpoint scrape **tidak memiliki autentikasi** — mutasi (PATCH provider, POST keyword) bisa dipanggil tanpa token (perlu konfirmasi: internal-only atau bug).
  - `GET /v1/scrape/openapi.json` → **500 internal_error**.
  - `trending-topic-multi-period` masih **placeholder** — label topik statis untuk keyword apa pun.
  - Filter `top-keywords?keyword=` hanya **exact-match penuh** (inkonsisten dengan semantik contains di endpoint lain).
  - Pagination scrape service: `page` overflow → rows kosong (dashboard-service clamp); `size=0/negatif` mengembalikan semua baris.
  - POST create keyword on-demand kadang **menggantung tanpa respons** (intermiten) — alasan test FE tidak men-assert penutupan modal.
  - Menu user navbar: item "Profile2" (typo label) & Logout **disabled by design** (konfirmasi owner) — dikunci assertion (REGRESI R8).
  - **REGRESI R9** (2026-08-31): Escape key **tidak menutup** modal Add keyword — hanya Close/Cancel yang berfungsi (a11y issue).
  - **REGRESI R10** (2026-08-31): Raw error codes (PROVIDER_PERMANENT_ERROR, dll) **ter-expose** ke user di keyword list — harusnya user-friendly.
- **AI Service = 2 service**:
  - **SIP AI Service** (`BASE_URL_AI`, default `:8100`) — 5 endpoint di `{BASE_URL_AI}` (health, meta, analyze batch/jobs/sync), semua wajib header `X-Service-Token`. Taxonomy di `/v1/meta` jangan di-hardcode (label bisa berubah).
  - **Intelligence AI Service** (`BASE_URL_AI_INTELLIGENCE`, default `:8000`) — `GET /health` publik + `POST /v1/topic-intelligence` & `POST /v1/actor-intelligence` (auth header `X-AI-Service-Token`, 429 saat kuota Gemini habis). Dites di `tests/ai/intelligence/`.
- **Stabilitas (NFR-02)**: test dijalankan dengan 1 retry lokal / 2 retry di CI untuk menahan kegagalan acak aplikasi.
- Chrome bawaan sistem bisa dipakai tanpa `npx playwright install` lewat `UI_BROWSER_CHANNEL=chrome`.
