# Aturan AI Agent

Panduan ini berlaku untuk seluruh repositori. Baca sebelum mengerjakan task.
Jika ada `AGENTS.md` di subfolder, baca juga aturan yang berlaku pada file target.
Instruksi sistem/platform dan instruksi eksplisit pengguna tetap diutamakan.

## Identitas Proyek

- Ini repositori automation testing SIP Insight, BUKAN source aplikasi frontend.
- Stack: Playwright Test dan TypeScript, dengan npm dan `package-lock.json`.
- Platform pengujian: FE (UI admin/client), BE (dashboard, gateway scrape, scraper), dan AI (SIP AI serta Intelligence AI).
- `src/pages/` adalah Page Object Model (POM), bukan router atau komponen React.
- Jangan membuat komponen Next.js, server aplikasi, atau aturan state/styling berdasarkan nama repo atau teknologi aplikasi target.
- Cek versi aktual pada `package.json` dan lockfile. Jangan mengasumsikan versi Node atau dependency dari ingatan.

## Wajib Berbasis Bukti

1. Baca `git status --short`, file target, dependensi langsungnya, dan contoh implementasi terdekat sebelum mengedit.
2. Cari simbol, fixture, route, locator, endpoint, dan script yang benar-benar ada. Jangan mengarang nama atau kontrak API.
3. Bedakan fakta hasil pembacaan kode, hasil eksekusi, dan hipotesis. Sertakan referensi path saat menjelaskan temuan; gunakan nomor baris jika relevan.
4. Untuk mengetahui perilaku harness, utamakan kode/config aktif daripada komentar dan README. Untuk perilaku aplikasi yang diharapkan, gunakan requirement atau kontrak yang disetujui; respons aktual yang salah bukan kontrak baru.
5. Jangan menyimpulkan bug aplikasi hanya dari test gagal. Periksa locator, mock, auth, environment, data, dan response terlebih dahulu.
6. Jika keputusan penting tidak punya bukti, telusuri kode/dokumentasi terkait. Bila tetap tidak jelas, tanyakan satu pertanyaan spesifik, bukan mengisi kekosongan dengan asumsi.
7. Jangan mengklaim sudah membuka browser, memanggil API, menjalankan test, atau memperbaiki bug jika tindakan dan hasilnya tidak tersedia.
8. Jangan mengklaim semua test lulus dari typecheck, discovery, report lama, atau satu spec yang lulus. Test skipped bukan passed.

## Peta Sumber Acuan

| Path | Kegunaan |
| --- | --- |
| `package.json`, `package-lock.json` | Perintah dan dependency aktual |
| `tsconfig.json` | Batas pemeriksaan TypeScript |
| `playwright.config.ts` | Run gabungan FE, BE, AI |
| `playwright.fe.config.ts` | Project FE, browser, dependency auth, reporter |
| `playwright.be.config.ts`, `playwright.ai.config.ts` | Konfigurasi test API per platform |
| `src/config/env.ts` | Resolver konfigurasi runtime dan environment |
| `src/pages/` | Locator dan aksi halaman reusable |
| `src/helpers/api-mock.ts` | Mock response dan intercept API |
| `src/helpers/auth.ts`, `src/helpers/client-auth.ts` | Login dan storage state per role |
| `src/helpers/data.ts`, `test-data/` | Loader dan dataset JSON/CSV |
| `tests/fe/fixtures.ts`, `tests/fe/client/fixtures.ts` | Fixture UI admin dan client |
| `tests/be/fixtures.ts`, `tests/ai/fixtures.ts` | Request context, URL helper, header autentikasi |
| `tests/be/README.md`, `tests/ai/README.md` | Konteks suite; cocokkan dengan implementasi terkini |
| `scripts/generate-test-cases.mjs` | Mapping spec dan generator test case Excel |
| `scripts/weekly-report/` | Generator workbook laporan mingguan |

## Alur Kerja

1. Tentukan scope: FE, BE, AI, tooling, atau dokumentasi. Baca config dan fixture platform yang relevan.
2. Catat kondisi awal worktree. Pertahankan perubahan pengguna, file untracked, dan perubahan agent lain.
3. Untuk pekerjaan multilangkah, buat rencana ringkas dan beri pembaruan saat ada temuan atau blocker penting.
4. Buat perubahan terkecil yang menyelesaikan task. Jangan refactor area lain, menambah dependency, atau mengganti tooling tanpa kebutuhan konkret.
5. Verifikasi sesuai scope dan risiko menggunakan panduan di bawah.
6. Tinjau diff akhir. Laporkan perubahan, verifikasi aktual, serta hal yang belum bisa diverifikasi.

Jangan commit, push, amend, reset, atau membuang perubahan lokal tanpa permintaan pengguna. Jika commit diminta, gunakan pesan commit tanpa footer `Generated with Codebuff` dan tanpa trailer `Co-Authored-By`. Jangan membaca seluruh file besar atau folder artefak jika pencarian terarah sudah cukup.

## Konvensi Implementasi

### FE

- Gunakan `test` dan `expect` dari fixture FE yang sesuai, mengikuti spec terdekat. Jangan melewati fixture proyek tanpa alasan.
- Tempatkan locator dan aksi reusable di POM. Ikuti pola `BasePage` serta POM terkait, bukan membuat abstraksi paralel.
- Utamakan locator semantik yang stabil seperti `getByRole` dan `getByLabel`. Jangan menebak teks/selector; buktikan dari POM, markup, atau inspeksi UI yang diizinkan.
- Gunakan assertion Playwright yang menunggu kondisi. Jangan menambah `waitForTimeout`, retry, atau timeout besar untuk menyembunyikan race condition.
- Pertahankan pemisahan auth admin/client. State disimpan terpisah di `.auth/fe-state.json` dan `.auth/fe-client-state.json`; suite login tidak boleh tanpa sengaja memakai state login tersebut.
- Cek `testMatch`, `testIgnore`, dan dependency di config saat menambah spec. Mapping modul/client eksplisit, bukan semua folder otomatis menjadi project. Provider masuk project `user`.
- Nama project dapat bersuffix browser saat multi-browser aktif. Periksa discovery sebelum mengandalkan shortcut project satu browser.
- Pasang mock sebelum request dipicu. Pertahankan bentuk response sesuai kontrak dan jangan mengubah smoke/integration test menjadi mocked test hanya agar hijau.
- Adanya mock tidak menjamin isolasi jaringan: handler dapat memakai `fallback()` atau `continue()`.

### BE dan AI

- Gunakan context/helper yang sesuai di fixture. BE membedakan `api`, `scrapeApi`, dan `scraperApi`; jangan menukar base URL antarservice.
- Jangan mengasumsikan URL helper memasang `BE_API_PREFIX` otomatis. Baca implementasi helper dan endpoint spec terdekat.
- Gateway scrape dan scraper langsung berbeda: pola `/v1/scrape/...` tidak identik dengan `/v1/...`.
- SIP AI memakai `X-Service-Token`; Intelligence AI memakai `X-AI-Service-Token`. Gunakan auth/header helper yang tersedia, bukan menyalin token atau membuat header dari dugaan.
- Dispose request context tambahan sesuai pola fixture; jangan bocorkan resource.
- Verifikasi status, bentuk response, dan invariants sesuai kontrak. Jangan memperluas expected status menjadi sembarang `2xx/4xx/5xx` demi meloloskan test.

### Integritas Test

- Regression test mengharapkan perilaku yang benar dan dapat tetap merah selama bug aplikasi belum diperbaiki.
- Dilarang menghapus assertion, menambahkan `skip`/`fixme`, menangkap semua error, atau menerima response salah hanya agar suite hijau. Perubahan expected behavior memerlukan bukti perubahan kontrak/requirement.
- Bedakan perbaikan test harness dari perbaikan aplikasi target. Perubahan di repo ini tidak otomatis memperbaiki aplikasi eksternal.
- Gunakan dataset/helper yang tersedia untuk skenario data-driven. Hindari data acak tanpa kontrol atau dependency tersembunyi pada urutan test.
- Judul spec dapat dipakai sebagai `specTitle` pada generator Excel. Cari pemakaiannya sebelum mengganti judul atau menambah coverage yang harus masuk laporan.
- Helper atau probe yang tidak dimaksudkan menjadi test jangan diberi suffix `.spec.ts`. Nama `*.tmp.spec.ts` masih bisa terdiscovery.

## Environment dan Keselamatan

- Konfigurasi runtime terpusat di `src/config/env.ts`. Jangan hardcode host, kredensial, token, atau akun nyata di spec/dataset/dokumentasi.
- Jangan membuka atau mencetak `.env`, isi `.auth/`, token, cookie, password, atau storage state untuk eksplorasi umum. Untuk debugging konfigurasi, periksa nama variabel dan resolver lebih dahulu; akses nilai sensitif hanya jika benar-benar diperlukan dan diizinkan, tanpa menyalinnya ke output.
- Jangan menambahkan secret ke `.env.example`; gunakan placeholder. Jangan mengubah `.env` pengguna tanpa izin.
- `dotenv` memakai `override: true`; `UI_ENV` dan `BASE_URL_UI` diperlakukan khusus oleh resolver. Jangan mengasumsikan semua environment variable shell mengalahkan `.env`.
- Jangan mengasumsikan target localhost atau disposable. Pastikan target, role, scope, dan dampak sebelum menjalankan test yang mengakses layanan nyata.
- Test dapat mengubah password, credential, keyword, atau state scraper. AI dapat memakai kuota/provider berbayar. Minta konfirmasi bila izin untuk dampak tersebut belum jelas.
- Untuk test mutasi baru, gunakan data khusus pengujian dan cleanup/pemulihan melalui `finally` bila memungkinkan. Jika efek tidak dapat dipulihkan, jangan jalankan pada layanan bersama tanpa persetujuan eksplisit.
- Report, trace, screenshot, dan video bisa mengandung informasi sensitif. Jangan menyalin artefak mentah ke jawaban atau commit tanpa pemeriksaan/redaksi.

## Perintah dan Verifikasi

Jalankan dari root repo. Periksa `package.json` sebelum menggunakan perintah; tidak ada script `dev`, `build`, `start`, atau `lint` saat panduan ini dibuat.

| Tujuan | Perintah |
| --- | --- |
| Pemeriksaan TypeScript tanpa emit | `npm run typecheck` |
| Discovery FE tanpa eksekusi test | `npm run test:fe -- --list --reporter=list` |
| Discovery BE tanpa eksekusi test | `npm run test:be -- --list --reporter=list` |
| Discovery AI tanpa eksekusi test | `npm run test:ai -- --list --reporter=list` |
| Contoh run FE terarah setelah target aman | `npm run test:fe -- --project=dashboard --reporter=list` |
| Run seluruh FE / BE / AI secara terpisah | `npm run test:fe` / `npm run test:be` / `npm run test:ai` |
| Run gabungan seluruh platform | `npm test` |
| Membuka report yang sudah ada | `npm run report:fe` / `npm run report:be` / `npm run report:ai` |
| Membuat ulang test case Excel per platform | `npm run test-cases:fe` / `npm run test-cases:be` / `npm run test-cases:ai` |
| Mengisi workbook mingguan | `npm run report:weekly` |

- Untuk perubahan TypeScript, jalankan `npm run typecheck`, lalu discovery/run terarah yang relevan jika aman. Perubahan dokumentasi saja cukup diverifikasi terhadap sumber dan diff.
- Discovery hanya membuktikan test dapat dikumpulkan, bukan bahwa test lulus. Import top-level tetap dievaluasi; baca side effect kode baru sebelum discovery.
- `tsconfig.json` tidak mencakup script `.mjs`. Untuk perubahan script, lakukan pemeriksaan seperti `node --check <path-script>` dan verifikasi perilaku yang relevan secara aman.
- Run parsial HARUS memakai `--reporter=list` agar JSON hasil suite lengkap tidak tertimpa. Ini tidak menjamin artefak lain aman: Playwright dapat membersihkan `outputDir` saat run.
- Jangan menjalankan full suite secara otomatis sebagai pemeriksaan ringan. Pilih file/project yang terdampak dan cek dependency auth yang ikut berjalan.
- Run gabungan tidak menghasilkan JSON per-platform seperti config terpisah. Jangan mengklaim hasil generator Excel diperbarui hanya karena `npm test` selesai.
- Jika browser, credential, target, atau dependency belum tersedia, laporkan blocker dan perintah yang belum dijalankan. Jangan membuat hasil test fiktif atau otomatis memasang dependency tanpa kebutuhan.

## Artefak dan Dokumentasi

- `.auth/`, `test-results/`, `playwright-report*/`, Excel di `test-cases/`, dan workbook mingguan adalah state/hasil eksekusi, bukan sumber implementasi test.
- Jangan mengedit report/Excel secara manual untuk mengubah status. Ubah sumber/generator bila dibutuhkan, lalu regenerasi hanya sesuai scope task.
- Generator test case membaca JSON report dan menulis ulang Excel; generator mingguan memodifikasi workbook. Jangan menjalankannya sekadar untuk mengecek syntax.
- `docs/` dan `tools/` saat ini di-ignore. Jika task menambah file di sana, periksa `.gitignore` dan jelaskan statusnya; jangan mengklaim file otomatis ikut version control.
- Jangan menggunakan angka jumlah test, status bug, endpoint, atau default environment dalam README sebagai fakta abadi. Cocokkan dengan config/spec saat mengerjakan task.
- Perbarui panduan ini jika task mengubah struktur, workflow, atau konvensi yang didokumentasikan di sini. Jangan menambahkan aturan untuk teknologi yang tidak digunakan.

## Format Hasil Akhir

Jawab ringkas dalam bahasa pengguna dan cantumkan:

- Apa yang berubah dan file utama yang terdampak.
- Perintah verifikasi yang benar-benar dijalankan beserta hasilnya.
- Test yang tidak dijalankan, blocker, atau risiko yang masih tersisa jika ada.

Jangan menyebut task selesai sepenuhnya jika bagian wajib belum dikerjakan atau belum bisa diverifikasi. Jelaskan batas hasil secara eksplisit.
