// scripts/generate-test-cases.mjs
// ---------------------------------------------------------------------------
// Menghasilkan file Excel berisi daftar test case project ini, lengkap dengan
// status hasil eksekusi (PASS/FAIL) yang dibaca dari report Playwright.
//
//   Cara pakai : npm run test-cases           → semua platform (FE + BE + AI)
//                npm run test-cases:fe        → hanya FE (test-cases/UI-Test-Cases.xlsx)
//                npm run test-cases:be        → hanya BE (test-cases/BE-Test-Cases.xlsx)
//                npm run test-cases:ai        → hanya AI (test-cases/AI-Test-Cases.xlsx)
//
// Alur kerja (per platform) :
//   1) npm run test:fe|be|ai  → menghasilkan test-results/results.json | results-be.json | results-ai.json
//   2) npm run test-cases[:fe|:be|:ai] → file Excel di-regenerate dengan status hasil
//
// Template kolom (21 kolom, format test case management standar):
//   No | Test Case ID | Nama Test Case | Kategori | Priority | Method |
//   Endpoint | Headers | Parameter/Query | Request Body | Precondition |
//   Expected Status | Expected Response | Assertions Utama | Sumber Data |
//   Actual Result | Status | Environment | Executed By | Tanggal Eksekusi |
//   Notes/Bug Link
//
// Adaptasi untuk UI testing:
//   - Method      = jenis interaksi UI utama (Navigate / View / Form / Filter / Modal / Toggle)
//   - Endpoint    = halaman aplikasi yang diuji (path URL)
//   - Request Body= input form yang dikirim (payload formulir / data modal)
//   - Expected Status / Expected Response = kondisi UI yang diharapkan
//
// Kolom eksekusi diisi otomatis:
//   - Actual Result / Status      → dari test-results/results.json
//   - Environment                 → dari env TEST_ENV (default: Local bila base URL localhost)
//   - Executed By                 → dari env TEST_EXECUTED_BY (default: "—")
//   - Tanggal Eksekusi            → tanggal mtime report (hasil run terakhir)
//
// Data-driven (baris JSON di test-data/) dibaca langsung supaya selalu sinkron
// dengan test. Test case "hardcoded" didaftarkan manual di bawah dengan
// `specTitle` yang PERSIS sama dengan judul test di spec — jika ada perubahan
// di spec, sesuaikan juga di sini.
// ---------------------------------------------------------------------------

import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ quiet: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'test-cases');
const EXECUTED_BY = process.env.TEST_EXECUTED_BY || '—';

// Base URL tiap platform (sama seperti src/config/env.ts)
const BASE_URL_UI = process.env.BASE_URL_UI || 'http://localhost:3000';
const BASE_URL_BE = process.env.BASE_URL_BE || 'http://localhost:8080';
const BE_API_PREFIX = process.env.BE_API_PREFIX || '/v1';
const BASE_URL_SCRAPE = process.env.BASE_URL_SCRAPE || 'http://10.200.101.13:8080';
const BASE_URL_AI = process.env.BASE_URL_AI || 'http://10.200.102.2:8100';

// Environment kolom eksekusi (bisa di-override lewat env; default dari base URL)
function environmentFor(baseUrl) {
  return (
    process.env.TEST_ENV ||
    (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
      ? 'Local'
      : 'Staging')
  );
}

// ---------- helpers baca test-data ----------
const loadJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'test-data', name), 'utf-8'));

// ---------- baca hasil test dari report Playwright ----------
// Format JSON report (list mode): { suites: [{ suites: [...], specs: [{ title, tests: [{ projectName, results: [{ status }] }] }] }] }
function loadTestResults(reportFile) {
  if (!fs.existsSync(reportFile)) return null;
  try {
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
    const statusMap = new Map(); // key: `${projectName}::${specTitle}` → 'PASS' | 'FAIL' | 'SKIP'
    const counts = { passed: 0, failed: 0, skipped: 0 };

    const walk = (suite) => {
      for (const child of suite.suites || []) walk(child);
      for (const spec of suite.specs || []) {
        for (const t of spec.tests || []) {
          const raw = t.results?.length
            ? t.results[t.results.length - 1].status
            : 'skipped';
          const status =
            raw === 'passed' ? 'PASS' : raw === 'skipped' ? 'SKIP' : 'FAIL';
          const bucket =
            status === 'PASS' ? 'passed' : status === 'SKIP' ? 'skipped' : 'failed';
          // Nama project bisa "dashboard" (single browser) atau
          // "dashboard-firefox" (cross-browser) — buang suffix browser.
          const projectName = (t.projectName || '').replace(/-(chromium|firefox|webkit)$/i, '');
          const key = `${projectName.toLowerCase()}::${spec.title.toLowerCase()}`;
          statusMap.set(key, status);
          counts[bucket]++;
        }
      }
    };
    for (const suite of report.suites || []) walk(suite);

    if (counts.passed + counts.failed + counts.skipped === 0) {
      console.warn('⚠️  Report test kosong (tidak ada test dijalankan) — kolom Actual Result/Status akan kosong.');
      return null;
    }
    return { statusMap, counts, total: counts.passed + counts.failed + counts.skipped };
  } catch (err) {
    console.warn(`⚠️  Report test tidak bisa dibaca (${reportFile}): ${err.message}`);
    return null;
  }
}

// Tanggal eksekusi = tanggal mtime report hasil run terakhir (format YYYY-MM-DD,
// pakai komponen tanggal lokal supaya tidak off-by-one di zona waktu non-UTC).
function executionDate(reportFile) {
  try {
    if (fs.existsSync(reportFile)) {
      const d = fs.statSync(reportFile).mtime;
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  } catch {
    /* abaikan */
  }
  return '—';
}

// ---------- daftar test case per modul ----------
// Kolom test case:
//   id, name, specTitle, category, priority, method, endpoint, headers,
//   params, requestBody, precondition, expectedStatus, expectedResponse,
//   assertions, source, notes
function buildSmokeCases() {
  return [
    {
      id: 'TC-UI-S01', name: 'Root "/" redirect ke halaman dashboard', category: 'Smoke', priority: 'High',
      method: 'Navigate', endpoint: '/', headers: '—', params: '—', requestBody: '—',
      precondition: 'Aplikasi berjalan di localhost:3000; user membuka URL root',
      expectedStatus: 'Sukses — redirect otomatis', expectedResponse: 'URL berubah ke /monitoring/dashboard; heading "Dashboard Overview" tampil',
      specTitle: 'root / redirect ke halaman dashboard',
      assertions: 'expectUrlPath(page, "/monitoring/dashboard"); heading "Dashboard Overview" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S02', name: 'Navbar menampilkan menu utama & identitas user', category: 'Smoke', priority: 'High',
      method: 'Navigate', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User sudah berada di halaman dashboard',
      expectedStatus: 'Sukses — elemen navbar tampil', expectedResponse: 'Menu Dashboard, Keyword, ikon notifikasi, dan nama "Admin SIP" tampil',
      specTitle: 'navbar menampilkan menu Dashboard & Keyword dan identitas user',
      assertions: 'header: link Dashboard & Keyword visible; button Notifications visible; getByText("Admin SIP")',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S03', name: 'Navigasi navbar ke halaman Keyword', category: 'Smoke', priority: 'High',
      method: 'Navigate', endpoint: '/monitoring/keyword', headers: '—', params: '—', requestBody: '—',
      precondition: 'User berada di halaman dashboard',
      expectedStatus: 'Sukses — pindah halaman', expectedResponse: 'URL /monitoring/keyword; heading "Monitoring Keyword" tampil',
      specTitle: 'navigasi navbar ke halaman Keyword Intelligence berhasil',
      assertions: 'click link Keyword di header; expectUrlPath; heading "Monitoring Keyword" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S04', name: 'Tab Scheduled & On Demand di halaman keyword', category: 'Smoke', priority: 'Medium',
      method: 'Navigate', endpoint: '/monitoring/keyword', headers: '—', params: '—', requestBody: '—',
      precondition: 'User berada di halaman Monitoring Keyword',
      expectedStatus: 'Sukses — tab berpindah (URL tidak sinkron, lihat Notes)', expectedResponse: 'Tab aktif berpindah ke On Demand (assert URL dikecualikan karena Bug A3)',
      specTitle: 'tab Scheduled & On Demand di halaman keyword dapat dipindahkan',
      assertions: 'aria-selected tab Scheduled; click On Demand → tab aktif berubah',
      source: 'Hardcoded di spec', notes: 'Bug A3: URL tidak berubah (router.replace shallow pada static export) — hanya tab yang di-assert',
    },
    {
      id: 'TC-UI-S05', name: 'Ketiga control protocol wall dapat diakses', category: 'Smoke', priority: 'Medium',
      method: 'Navigate', endpoint: '/control/alert-protocol · /control/danger-protocol · /control/green-protocol', headers: '—', params: '3 URL wall', requestBody: '—',
      precondition: 'User membuka tiap URL wall control protocol',
      expectedStatus: 'Sukses — tiap wall tampil', expectedResponse: 'Tiap wall menampilkan "Active Protocol" dan judul wall masing-masing',
      specTitle: 'halaman control protocol (alert, danger, green) dapat diakses',
      assertions: 'getByText("Active Protocol") visible; heading judul wall (Alert / Danger / Green — Under Control)',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S06', name: 'Halaman profile menampilkan informasi user', category: 'Smoke', priority: 'Medium',
      method: 'Navigate', endpoint: '/profile', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman /profile',
      expectedStatus: 'Sukses — info user tampil', expectedResponse: 'Nama "Admin SIP", @admin, role "Super Admin" tampil',
      specTitle: 'halaman profile menampilkan informasi user saat ini',
      assertions: 'main: getByText("Admin SIP") & "@admin" & "Super Admin" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S07', name: 'Halaman user management dapat diakses', category: 'Smoke', priority: 'Medium',
      method: 'Navigate', endpoint: '/administration/user', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman /administration/user',
      expectedStatus: 'Sukses — halaman tampil', expectedResponse: 'Heading "User Management", tombol "+ Add user", heading "User list" tampil',
      specTitle: 'halaman user management dapat diakses',
      assertions: 'heading "User Management" & "User list" visible; button "+ Add user" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S08', name: 'Menu hamburger & navigasi di viewport mobile', category: 'Responsive', priority: 'Low',
      method: 'Navigate', endpoint: '/monitoring/keyword', headers: 'Viewport 390x844 (Mobile)', params: 'viewport 390x844', requestBody: '—',
      precondition: 'Browser diemulasi sebagai perangkat mobile (390x844); user membuka halaman keyword',
      expectedStatus: 'Sukses — menu hamburger & navigasi berfungsi', expectedResponse: 'Menu hamburger tampil; navigasi ke dashboard berhasil (FR-15)',
      specTitle: 'menu hamburger muncul & navigasi berfungsi pada viewport mobile (390x844)',
      assertions: 'button "Open menu" visible; mobile nav link Dashboard → expectUrlPath /monitoring/dashboard',
      source: 'Hardcoded di spec', notes: '—',
    },
    // ---- Navigasi Mendalam — Navbar & Provider (2026-08-22) ----
    {
      id: 'TC-UI-S09', name: 'Navbar "Display Wall" button membuka dropdown menu', category: 'Smoke', priority: 'Medium',
      method: 'Navigate', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard; tombol Display Wall ada di navbar',
      expectedStatus: 'Sukses — dropdown terbuka', expectedResponse: 'Klik Display Wall → dropdown dengan link ke halaman display wall muncul',
      specTitle: 'navbar "Display Wall" button membuka dropdown menu',
      assertions: 'displayWallBtn click → link visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S10', name: 'Navigasi dari Display Wall dropdown ke Conversation Overview', category: 'Smoke', priority: 'Low',
      method: 'Navigate', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard; Display Wall dropdown terbuka',
      expectedStatus: 'Sukses — navigasi ke halaman display wall', expectedResponse: 'Klik Conversation Overview → URL berubah ke /display/conversation-overview',
      specTitle: 'navigasi dari Display Wall dropdown ke Conversation Overview',
      assertions: 'link Conversation Overview click → expectUrlPath /display/conversation-overview',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S11', name: 'Navigasi dari Display Wall dropdown ke Top Engagement', category: 'Smoke', priority: 'Low',
      method: 'Navigate', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard; Display Wall dropdown terbuka',
      expectedStatus: 'Sukses — navigasi ke halaman display wall', expectedResponse: 'Klik Top Engagement → URL berubah ke /display/top-engagement',
      specTitle: 'navigasi dari Display Wall dropdown ke Top Engagement',
      assertions: 'link Top Engagement click → expectUrlPath /display/top-engagement',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S12', name: 'Navbar "Management" button membuka dropdown menu', category: 'Smoke', priority: 'Medium',
      method: 'Navigate', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard',
      expectedStatus: 'Sukses — dropdown terbuka', expectedResponse: 'Klik Management → dropdown dengan link ke halaman management muncul',
      specTitle: 'navbar "Management" button membuka dropdown menu',
      assertions: 'mgmtBtn click → link visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S13', name: 'Navigasi dari Management dropdown ke Keyword Management', category: 'Smoke', priority: 'Medium',
      method: 'Navigate', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard; Management dropdown terbuka',
      expectedStatus: 'Sukses — navigasi ke halaman keyword', expectedResponse: 'Klik Keyword → URL berubah ke /monitoring/keyword',
      specTitle: 'navigasi dari Management dropdown ke Keyword Management',
      assertions: 'keywordLink click → expectUrlPath /monitoring/keyword',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S14', name: 'Tombol Notifications terlihat di navbar', category: 'Smoke', priority: 'Low',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard',
      expectedStatus: 'Sukses — tombol tampil', expectedResponse: 'Tombol "Notifications" visible di navbar',
      specTitle: 'tombol Notifications terlihat di navbar',
      assertions: 'button "Notifications" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S15', name: 'Tombol user menu (AS Admin SIP) terlihat di navbar', category: 'Smoke', priority: 'Low',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard',
      expectedStatus: 'Sukses — tombol tampil', expectedResponse: 'Tombol user menu "AS Admin SIP" visible di navbar',
      specTitle: 'tombol user menu (AS Admin SIP) terlihat di navbar',
      assertions: 'button /Admin SIP/ visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S16', name: 'Dark mode toggle berfungsi di halaman dashboard', category: 'Smoke', priority: 'Low',
      method: 'Toggle', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard (tema default light)',
      expectedStatus: 'Sukses — tema berubah', expectedResponse: 'Klik toggle dark mode → tombol berubah "Enable light mode"',
      specTitle: 'dark mode toggle berfungsi di halaman dashboard',
      assertions: 'button "Enable dark mode" visible; click → button "Enable light mode" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S17', name: 'Dark mode toggle berfungsi di halaman keyword', category: 'Smoke', priority: 'Low',
      method: 'Toggle', endpoint: '/monitoring/keyword', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di halaman keyword (tema default light)',
      expectedStatus: 'Sukses — tema berubah', expectedResponse: 'Klik toggle dark mode → tombol berubah "Enable light mode"',
      specTitle: 'dark mode toggle berfungsi di halaman keyword',
      assertions: 'button "Enable dark mode" visible; click → button "Enable light mode" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S18', name: 'Dark mode toggle berfungsi di halaman profile', category: 'Smoke', priority: 'Low',
      method: 'Toggle', endpoint: '/profile', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di halaman profile (tema default light)',
      expectedStatus: 'Sukses — tema berubah', expectedResponse: 'Klik toggle dark mode → tombol berubah "Enable light mode"',
      specTitle: 'dark mode toggle berfungsi di halaman profile',
      assertions: 'button "Enable dark mode" visible; click → button "Enable light mode" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S19', name: 'Navigasi dari dashboard ke profile dan kembali via navbar', category: 'Smoke', priority: 'Medium',
      method: 'Navigate', endpoint: '/monitoring/dashboard → /profile → /monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard',
      expectedStatus: 'Sukses — navigasi bolak-balik berhasil', expectedResponse: 'Dashboard → Profile (heading visible) → kembali ke Dashboard via navbar link',
      specTitle: 'navigasi dari dashboard ke profile dan kembali via navbar',
      assertions: 'dashboard heading visible → goto profile → profile heading visible → click Dashboard link → expectUrlPath /monitoring/dashboard',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S20', name: 'Navigasi dari dashboard ke user management dan kembali via navbar', category: 'Smoke', priority: 'Medium',
      method: 'Navigate', endpoint: '/monitoring/dashboard → /administration/user → /monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard',
      expectedStatus: 'Sukses — navigasi bolak-balik berhasil', expectedResponse: 'Dashboard → User Management (heading visible) → kembali ke Dashboard via navbar link',
      specTitle: 'navigasi dari dashboard ke user management dan kembali via navbar',
      assertions: 'dashboard heading visible → goto user mgmt → User Management heading visible → click Dashboard link → expectUrlPath /monitoring/dashboard',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S21', name: 'Dropdown Notifications menampilkan panel dengan empty state', category: 'Smoke', priority: 'Low',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard (navbar tampil)',
      expectedStatus: 'Sukses — panel notifikasi terbuka', expectedResponse: 'Panel Notifications terbuka dengan pesan "No notifications yet."',
      specTitle: 'dropdown Notifications menampilkan panel dengan empty state',
      assertions: 'click tombol Notifications → getByText("No notifications yet.") visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-S22', name: 'User menu menampilkan opsi Profile & Logout saat dibuka', category: 'Smoke', priority: 'Low',
      method: 'Modal', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard (navbar tampil)',
      expectedStatus: 'Sukses — menu terbuka dengan 2 opsi', expectedResponse: 'Menu user berisi tombol "Profile2" (label aktual app, kemungkinan typo) & "Logout"',
      specTitle: 'user menu menampilkan opsi Profile & Logout saat dibuka',
      assertions: 'click user menu → button Profile2 visible; button Logout visible',
      source: 'Hardcoded di spec', notes: 'Kedua item memang disabled by design (konfirmasi owner).',
    },
  ];
}

function buildLoginCases() {
  return [
    {
      id: 'TC-UI-L01', name: 'Form login menampilkan field username, password, dan tombol Log in', category: 'Positive', priority: 'High',
      method: 'Form', endpoint: '/login', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman /login',
      expectedStatus: 'Sukses — form tampil', expectedResponse: 'Input username, password, dan tombol "Log in" tampil',
      specTitle: 'form login menampilkan field username, password, dan tombol Log in',
      assertions: 'getByLabel("Username") & "Password" visible; button "Log in" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-L02', name: 'Submit dengan field kosong menampilkan pesan validasi', category: 'Negative', priority: 'High',
      method: 'Form', endpoint: '/login', headers: '—', params: 'username=, password=', requestBody: '{ username: "", password: "" }',
      precondition: 'User di halaman login; kedua field dibiarkan kosong',
      expectedStatus: 'Validasi error tampil', expectedResponse: 'Pesan "Username and password are required." tampil',
      specTitle: 'submit dengan field kosong menampilkan pesan validasi',
      assertions: 'click Log in tanpa isi → getByText("Username and password are required.") visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-L03', name: 'Submit kredensial terisi menampilkan state Processing (simulasi)', category: 'Positive', priority: 'High',
      method: 'Form', endpoint: '/login', headers: '—', params: 'admin / password123', requestBody: '{ username: "admin", password: "password123" }',
      precondition: 'User di halaman login; kredensial diisi (admin / password123)',
      expectedStatus: 'Sukses — state Processing muncul', expectedResponse: 'Tidak ada error validasi; tombol berubah menjadi "Processing…"',
      specTitle: 'submit dengan kredensial terisi menampilkan state Processing (simulasi)',
      assertions: 'expectNoValidationError; button "Processing…" visible (timeout 2s)',
      source: 'Hardcoded di spec', notes: 'Bug A1: login tidak redirect & tanpa feedback sukses (aplikasi masih simulasi)',
    },
    {
      id: 'TC-UI-L04', name: 'Halaman login menampilkan panel branding SIP Insight', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/login', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman /login',
      expectedStatus: 'Sukses — panel branding tampil', expectedResponse: 'Teks "Social Intelligence Platform" tampil',
      specTitle: 'halaman login menampilkan panel branding SIP Insight',
      assertions: 'getByText("Social Intelligence Platform") visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-L05', name: '[REGRESI A1] Login dengan kredensial valid harus redirect ke dashboard', category: 'Regression', priority: 'High',
      method: 'Form', endpoint: '/login', headers: '—', params: 'admin / password123', requestBody: '{ username: "admin", password: "password123" }',
      precondition: 'Mock API auth login 200 aktif; user di halaman login',
      expectedStatus: 'Sukses — redirect ke dashboard', expectedResponse: 'Setelah klik Log in dengan kredensial valid, URL berpindah ke /monitoring/dashboard',
      specTitle: 'REGRESI A1: login dengan kredensial valid harus redirect ke dashboard',
      assertions: 'login("admin","password123") → toHaveURL(/\\/monitoring\\/dashboard/, 15s)',
      source: 'Hardcoded di spec', notes: 'Bug A1: saat ini tidak redirect — hanya state Processing 900ms tanpa navigasi & tanpa API call. Test FAIL sampai alur login disambungkan.',
    },
    {
      id: 'TC-UI-L06', name: 'Checkbox Remember me aktif secara default dan dapat diubah', category: 'Positive', priority: 'Low',
      method: 'Form', endpoint: '/login', headers: '—', params: 'checkbox Remember me', requestBody: '—',
      precondition: 'User membuka halaman /login',
      expectedStatus: 'Sukses — checkbox berfungsi', expectedResponse: 'Checkbox "Remember me" tercentang sejak awal; uncheck/check berfungsi',
      specTitle: 'checkbox Remember me aktif secara default dan dapat diubah',
      assertions: 'rememberMeCheckbox visible & toBeChecked; uncheck → not.toBeChecked; check → toBeChecked',
      source: 'Hardcoded di spec', notes: '—',
    },
  ];
}

function buildDashboardCases() {
  const keywords = loadJson('dashboard-keywords.json');
  return [
    {
      id: 'TC-UI-D01', name: 'Halaman dashboard menampilkan header, filter, dan tombol aksi', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; user membuka /monitoring/dashboard',
      expectedStatus: 'Sukses — header & filter tampil', expectedResponse: 'Heading "Dashboard Overview", auto-refresh dropdown (Off), tombol Refresh now & Enter fullscreen, section "Trending topic" (dengan 24 Hours/7 Days toggle) & "Search filters" (dengan Period dropdown), tombol Apply/Reset tampil',
      specTitle: 'halaman dashboard menampilkan header, filter, dan tombol aksi',
      assertions: 'heading & tombol aksi visible; auto-refresh combobox, Refresh now button, Enter fullscreen button, "Trending topic" & "Search filters" headings visible',
      source: 'Hardcoded di spec', notes: 'UI baru: auto-refresh dropdown, Refresh now, Enter fullscreen, Trending topic 24H/7D toggle, Period dropdown di search filters'
    },
    {
      id: 'TC-UI-D02', name: 'Empty state "No search yet" tampil ketika belum ada keyword', category: 'Empty State', priority: 'High',
      method: 'Filter', endpoint: '/monitoring/dashboard', headers: '—', params: 'keyword options = [] (mock)', requestBody: '—',
      precondition: 'Mock API mengembalikan daftar keyword kosong; user membuka dashboard',
      expectedStatus: 'Sukses — empty state tampil (FR-14)', expectedResponse: 'Empty state "No search yet" beserta petunjuk pengisian filter tampil',
      specTitle: 'empty state "No search yet" tampil ketika belum ada keyword',
      assertions: 'mockKeywordOptions([]) → getByText("No search yet") visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D03', name: 'Validasi keyword kosong → "Keyword is required."', category: 'Negative', priority: 'High',
      method: 'Form', endpoint: '/monitoring/dashboard', headers: '—', params: 'keyword=', requestBody: '{ keyword: "", platforms: [...] }',
      precondition: 'Mock API dashboard aktif; user di halaman dashboard; keyword dikosongkan',
      expectedStatus: 'Validasi error tampil (FR-13)', expectedResponse: 'Pesan "Keyword is required." tampil',
      specTitle: 'validasi keyword kosong menampilkan pesan "Keyword is required."',
      assertions: 'clearKeyword + applyFilter → getByText("Keyword is required.") visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D04', name: 'Validasi platform kosong → "Select at least one platform."', category: 'Negative', priority: 'High',
      method: 'Form', endpoint: '/monitoring/dashboard', headers: '—', params: 'platforms=[]', requestBody: '{ keyword: "...", platforms: [] }',
      precondition: 'Mock API dashboard aktif; user di halaman dashboard; semua platform di-uncheck',
      expectedStatus: 'Validasi error tampil (FR-13)', expectedResponse: 'Pesan "Select at least one platform." tampil',
      specTitle: 'validasi platform kosong menampilkan pesan "Select at least one platform."',
      assertions: 'deselectAllPlatforms + applyFilter → getByText("Select at least one platform.") visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    ...keywords.map((d, i) => ({
      id: `TC-UI-D${String(i + 5).padStart(2, '0')}`, name: `Cari keyword "${d.keyword}" → filter terkirim ke API & hasil tampil`, category: 'Positive', priority: 'High',
      method: 'Filter', endpoint: '/monitoring/dashboard', headers: '—', params: `keyword=${d.keyword}`, requestBody: `{ keyword: "${d.keyword}", platforms: [X, Instagram, TikTok] }`,
      precondition: 'Mock API dashboard aktif; user memilih keyword dari daftar',
      expectedStatus: 'Sukses — hasil & data render (G2)', expectedResponse: 'Kartu hasil (Conversation summary, Sentiment & Emotion, Content Intelligence) tampil; request summary membawa keyword eksplisit',
      specTitle: `cari keyword "${d.keyword}" → filter terkirim ke API & hasil tampil (mock API)`,
      assertions: 'expectResultsRendered; poll URL summary terakhir mengandung keyword= (plus-encoded)',
      source: 'test-data/dashboard-keywords.json', notes: '—',
    })),
    {
      id: `TC-UI-D${String(keywords.length + 5).padStart(2, '0')}`, name: 'Trending topic berpindah periode 24 Hours → 7 Days', category: 'Positive', priority: 'Medium',
      method: 'Toggle', endpoint: '/monitoring/dashboard', headers: '—', params: 'period=7d', requestBody: '—',
      precondition: 'Mock API dashboard aktif; hasil trending periode 24 Hours sudah tampil',
      expectedStatus: 'Sukses — konten berubah sesuai periode', expectedResponse: 'Konten trending 24 Hours → "Transformasi layanan publik"; 7 Days → "Layanan publik digital" (exact match, tidak bentrok teks post)',
      specTitle: 'trending topic dapat berpindah periode 24 Hours → 7 Days',
      assertions: 'getByText("Transformasi layanan publik", exact) visible; click "7 Days" → getByText("Layanan publik digital", exact) visible; count(24h)=0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: `TC-UI-D${String(keywords.length + 6).padStart(2, '0')}`, name: 'Bagian Top Performers dapat di-hide dan ditampilkan kembali', category: 'Positive', priority: 'Low',
      method: 'Toggle', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; hasil dashboard sudah tampil',
      expectedStatus: 'Sukses — toggle bekerja', expectedResponse: 'Section tersembunyi lalu muncul kembali; tombol toggle berubah Hide ↔ Show',
      specTitle: 'bagian Top Performers dapat di-hide dan ditampilkan kembali',
      assertions: 'click "Hide" → button "Show" visible; click "Show" → button "Hide" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D09', name: 'Toggle dark mode mengubah tema visual aplikasi', category: 'Positive', priority: 'Medium',
      method: 'Toggle', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; user di dashboard (tema default light)',
      expectedStatus: 'Sukses — tema berubah', expectedResponse: 'Setelah klik toggle: tombol berubah "Enable light mode"',
      specTitle: 'toggle dark mode harus mengubah tema visual aplikasi',
      assertions: 'button "Enable light mode" visible setelah toggle dark mode',
      source: 'Hardcoded di spec', notes: 'Koreksi B2 (deep audit): dark mode TERBUKTI bekerja — sip-dashboard.css punya [data-theme="dark"]. Body tidak berubah karena di luar wrapper data-theme (normal).',
    },
    {
      id: 'TC-UI-D09b', name: 'Kartu Sentiment trend & Sentiment map terrender di grup Sentiment', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; hasil dashboard sudah tampil',
      expectedStatus: 'Sukses — dua kartu terrender', expectedResponse: 'Heading "Sentiment trend" & "Sentiment map" visible; grup Sentiment menggambar chart (svg)',
      specTitle: 'kartu Sentiment trend & Sentiment map terrender di grup Sentiment',
      assertions: 'heading Sentiment trend + Sentiment map visible; svg pertama dalam grup visible',
      source: 'Hardcoded di spec', notes: '—',
    },

    {
      id: 'TC-UI-D09c', name: 'Export report mengunduh file xlsx & menampilkan toast sukses', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: 'GET /api/dashboard/export-report',
      precondition: 'Mock API dashboard aktif; hasil sudah tampil',
      expectedStatus: 'Sukses - unduhan berjalan', expectedResponse: 'Event download dgn nama file .xlsx; toast "Report exported successfully."',
      specTitle: 'Export report mengunduh file xlsx & menampilkan toast sukses',
      assertions: 'waitForEvent(download); suggestedFilename matches .xlsx; toast visible',
      source: 'Hardcoded di spec', notes: 'Tombol dikembalikan app & kini FUNGSIONAL (dulu bug A2 no-op).',
    },    {
      id: 'TC-UI-D10', name: 'Section Topic intelligence tersedia di dashboard', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; hasil dashboard sudah tampil',
      expectedStatus: 'Sukses — section tampil', expectedResponse: 'Heading "Topic intelligence" visible (detail chart kini di halaman Keyword Intelligence)',
      specTitle: 'section Topic intelligence tersedia di dashboard',
      assertions: 'topicIntelligenceHeading visible',
      source: 'Hardcoded di spec', notes: 'Sebelumnya mengetes chart aria-label; chart dipindah ke halaman Keyword Intelligence.',
    },
    {
      id: 'TC-UI-D11', name: 'KPI dashboard dirender dari data API BE (Total post, Views, dst.)', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: 'keyword=auto-select', requestBody: '—',
      precondition: `FE di ${BASE_URL_UI} & BE di ${BASE_URL_BE} berjalan; dashboard auto-select keyword pertama (kebijakan-ekonomi)`,
      expectedStatus: 'Sukses — KPI dari BE dirender', expectedResponse: 'Kartu Total post / Total engagement / Views / Engagement rate / Active platforms menampilkan label yang SAMA dengan respons GET /v1/dashboard/summary yang diterima halaman',
      specTitle: 'KPI dashboard dirender dari data API BE (Total post, Views, dst.)',
      assertions: 'tangkap respons BE summary; tiap kartu KPI toContainText(label BE) & active platforms = "active / total"',
      source: 'Hardcoded di spec', notes: 'Integrasi FE↔BE tanpa mock — nilai dibandingkan dengan body respons BE asli (tidak hardcode angka)',
    },
    {
      id: 'TC-UI-D12', name: 'Request KPI dikirim ke BE dengan parameter keyword', category: 'Positive', priority: 'High',
      method: 'Filter', endpoint: '/monitoring/dashboard', headers: '—', params: 'keyword=<auto-select>', requestBody: '—',
      precondition: `FE & BE berjalan; user membuka dashboard`,
      expectedStatus: 'Sukses — request ke BE terkirim', expectedResponse: 'Browser mengirim GET {BASE_URL_BE}/v1/dashboard/summary?keyword=... (bukan tanpa filter)',
      specTitle: 'request KPI dikirim ke BE dengan parameter keyword',
      assertions: 'page.on(request) menangkap URL /v1/dashboard/summary; berisi localhost:8080; searchParams.keyword truthy',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D13', name: 'Ganti keyword → request baru ke BE & kartu KPI ikut berubah', category: 'Positive', priority: 'High',
      method: 'Filter', endpoint: '/monitoring/dashboard', headers: '—', params: 'keyword=layanan-publik', requestBody: '{ keyword: "Layanan Publik", platforms: [...] }',
      precondition: `FE & BE berjalan; dashboard sudah memuat KPI auto-select`,
      expectedStatus: 'Sukses — KPI mengikuti keyword baru', expectedResponse: 'Setelah pilih "Layanan Publik" + Apply: request BE baru ?keyword=layanan-publik → kartu Total post menampilkan label respons (total_post = 0 untuk keyword tanpa data)',
      specTitle: 'ganti keyword → request baru ke BE & kartu KPI ikut berubah',
      assertions: 'pilih opsi "Layanan Publik" + Apply filter; tangkap respons BE keyword=layanan-publik; total_post.value = 0; kartu menampilkan label-nya',
      source: 'Hardcoded di spec', notes: 'Bukti UI merender respons BE keyword baru, bukan data lama',
    },
    {
      id: 'TC-UI-D14', name: 'Halaman dashboard tetap di path /monitoring/dashboard setelah KPI BE dimuat', category: 'Positive', priority: 'Low',
      method: 'Navigate', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: `FE & BE berjalan; user membuka dashboard`,
      expectedStatus: 'Sukses — URL stabil', expectedResponse: 'Setelah KPI BE tampil, URL tetap /monitoring/dashboard (tidak redirect/error)',
      specTitle: 'halaman dashboard tetap di path /monitoring/dashboard setelah KPI BE dimuat',
      assertions: 'kartu Total post visible; expectUrlPath(page, "/monitoring/dashboard")',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D15', name: 'Chart conversation trend dirender dari data API BE (request + label tanggal)', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: 'keyword=auto-select', requestBody: '—',
      precondition: `FE di ${BASE_URL_UI} & BE di ${BASE_URL_BE} berjalan; dashboard auto-select keyword pertama`,
      expectedStatus: 'Sukses — chart dirender dari data BE', expectedResponse: 'Browser mengirim GET /v1/dashboard/conversation-trend?keyword=...; chart canvas tampil dengan aria-label "Chart of post volume and engagement trend from <label pertama> to <label terakhir>" sesuai data BE',
      specTitle: 'chart conversation trend dirender dari data API BE (request + label tanggal)',
      assertions: 'tangkap respons BE conversation-trend; getByRole img /Chart of post volume and engagement trend/ visible; aria-label memuat body.data[0].label & body.data[-1].label',
      source: 'Hardcoded di spec', notes: 'Integrasi FE↔BE tanpa mock — nilai dibandingkan dengan body respons BE asli. Endpoint conversation-trend-hourly tidak dipanggil web saat ini (cakupan: test BE).',
    },
    {
      id: 'TC-UI-D16', name: 'Daftar Top accounts dirender dari data API BE (handle, platform, posts)', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: 'keyword=auto-select', requestBody: '—',
      precondition: `FE & BE berjalan; dashboard auto-select keyword pertama (kebijakan-ekonomi — satu-satunya yang punya data)`,
      expectedStatus: 'Sukses — daftar dirender dari data BE', expectedResponse: 'Section "Top accounts" tampil; item pertama dari respons GET /v1/dashboard/top-accounts (handle, platform, "N post") ter-render di list',
      specTitle: 'daftar Top accounts dirender dari data API BE (handle, platform, posts)',
      assertions: 'article filter heading "Top accounts"; getByText(body.data[0].handle, exact) & platform & /^N posts?$/ visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D17', name: 'Daftar Top hashtags dirender dari data API BE (tag, count)', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: 'keyword=auto-select', requestBody: '—',
      precondition: `FE & BE berjalan; dashboard auto-select keyword pertama`,
      expectedStatus: 'Sukses — daftar dirender dari data BE', expectedResponse: 'Section "Top hashtags" tampil; item pertama dari respons GET /v1/dashboard/top-hashtags (tag, "N post") ter-render di list',
      specTitle: 'daftar Top hashtags dirender dari data API BE (tag, count)',
      assertions: 'article filter heading "Top hashtags"; getByText(body.data[0].tag, exact) & /^N posts?$/ visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D18', name: 'Ganti keyword tanpa data → request BE keyword baru & empty state Top accounts/Top hashtags', category: 'Empty State', priority: 'Medium',
      method: 'Filter', endpoint: '/monitoring/dashboard', headers: '—', params: 'keyword=Transformasi Digital (tanpa data)', requestBody: '{ keyword: "Transformasi Digital", platforms: [...] }',
      precondition: `FE & BE berjalan; dashboard sudah memuat hasil auto-select`,
      expectedStatus: 'Sukses — 4 request BE keyword baru & empty state', expectedResponse: 'Setelah pilih "Transformasi Digital" + Apply: summary, conversation-trend, top-accounts, top-hashtags dipanggil ulang dengan ?keyword=transformasi-digital; data top-accounts & top-hashtags kosong → "No active accounts found" & "No hashtags found"',
      specTitle: 'ganti keyword tanpa data → request BE keyword baru & empty state Top accounts/Top hashtags',
      assertions: 'pilih opsi + Apply; tangkap 4 respons BE keyword=transformasi-digital; body.data = []; getByText("No active accounts found") & "No hashtags found" visible',
      source: 'Hardcoded di spec', notes: 'Bukti filter terkirim ke BE & empty state sesuai desain (FR-14)',
    },
    {
      id: 'TC-UI-D19', name: 'Top Posts menampilkan tabel dengan kolom Platform, Post, Emotion, Topic, Engagement', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: `FE & BE berjalan; dashboard sudah memuat hasil search`,
      expectedStatus: 'Sukses — tabel terisi data dari API BE', expectedResponse: 'Heading "Top posts" visible; tabel dengan 6 kolom (Platform, Post, Emotion, Topic, Views, Engagement); data ter-render; Sort by dropdown (Views/Engagement) tersedia',
      specTitle: 'Top Posts menampilkan tabel dengan kolom Platform, Post, Emotion, Topic, Engagement',
      assertions: 'getByRole heading "Top posts" visible; table th = [Platform, Post, Emotion, Topic, Views, Engagement]; Sort by combobox visible',
      source: 'Hardcoded di spec', notes: 'Fitur baru dari integrasi API BE top-posts (GET /v1/dashboard/top-posts)',
    },
    {
      id: 'TC-UI-D21', name: 'Top Posts "View all →" button terlihat', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: `FE & BE berjalan; dashboard sudah memuat hasil search`,
      expectedStatus: 'Sukses — tombol "View all →" terlihat', expectedResponse: 'Tombol "View all →" visible di card Top posts',
      specTitle: 'Top Posts "View all →" button terlihat',
      assertions: 'getByRole button "View all →" visible',
      source: 'Hardcoded di spec', notes: 'Tombol navigasi ke halaman /monitoring/dashboard/posts',
    },

    {
      id: 'TC-UI-D21b', name: 'KPI summary menampilkan kartu Total post, Total engagement, Views, Engagement rate, Active platforms', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; hasil sudah tampil',
      expectedStatus: 'Sukses - lima kartu tampil', expectedResponse: 'Semua kartu KPI visible',
      specTitle: 'KPI summary menampilkan kartu Total post, Total engagement, Views, Engagement rate, Active platforms',
      assertions: 'lima kartu KPI visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D21c', name: 'Top Accounts menampilkan daftar akun dengan handle, platform, dan jumlah post', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; hasil sudah tampil',
      expectedStatus: 'Sukses - daftar akun tampil', expectedResponse: 'Top accounts visible dengan handle/platform/posts',
      specTitle: 'Top Accounts menampilkan daftar akun dengan handle, platform, dan jumlah post',
      assertions: 'topAccountsHeading visible; item pertama berisi handle',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D21d', name: 'Top Hashtags menampilkan daftar hashtag dengan tag dan jumlah post', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; hasil sudah tampil',
      expectedStatus: 'Sukses - daftar hashtag tampil', expectedResponse: 'Top hashtags visible dengan tag & count',
      specTitle: 'Top Hashtags menampilkan daftar hashtag dengan tag dan jumlah post',
      assertions: 'topHashtagsHeading visible; item hashtag terrender',
      source: 'Hardcoded di spec', notes: '—',
    },    // ---- Fitur baru UI (2026-08-22) ----
    {
      id: 'TC-UI-D22', name: 'Auto-refresh dropdown menampilkan opsi default Off dan 7 interval lainnya', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; user membuka dashboard',
      expectedStatus: 'Sukses — dropdown tampil', expectedResponse: 'Combobox "Auto-refresh" visible dengan value default "off" dan minimal 8 opsi (Off, 1 minute, 5 minutes, 15 minutes, 30 minutes, 1 hour, 2 hours, 1 day)',
      specTitle: 'auto-refresh dropdown menampilkan opsi default Off dan opsi lainnya',
      assertions: 'combobox "Auto-refresh" visible;toHaveValue("off"); option count >= 8',
      source: 'Hardcoded di spec', notes: 'Fitur baru auto-refresh dashboard',
    },
    {
      id: 'TC-UI-D23', name: 'Auto-refresh dapat diubah ke opsi lain (5 minutes)', category: 'Positive', priority: 'Medium',
      method: 'Toggle', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; dashboard sudah tampil',
      expectedStatus: 'Sukses — value berubah', expectedResponse: 'Setelah select "5 minutes", combobox value = "5m"',
      specTitle: 'auto-refresh dapat diubah ke opsi lain',
      assertions: 'selectOption({label:"5 minutes"}) → toHaveValue("5m")',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D24', name: 'Tombol Refresh dashboard now terlihat dan dapat diklik', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; dashboard sudah tampil',
      expectedStatus: 'Sukses — tombol tampil & klik tanpa error', expectedResponse: 'Tombol "Refresh dashboard now" visible; klik tidak crash & data tetap tampil',
      specTitle: 'tombol Refresh dashboard now terlihat dan dapat diklik',
      assertions: 'button "Refresh dashboard now" visible; click → results tetap rendered',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D25', name: 'Tombol Enter fullscreen terlihat', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; dashboard sudah tampil',
      expectedStatus: 'Sukses — tombol tampil', expectedResponse: 'Tombol "Enter fullscreen" visible',
      specTitle: 'tombol Enter fullscreen terlihat',
      assertions: 'button "Enter fullscreen" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D25b', name: 'Enter fullscreen masuk mode fullscreen & Exit keluar', category: 'Positive', priority: 'Medium',
      method: 'Toggle', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; dashboard sudah tampil',
      expectedStatus: 'Sukses — fullscreen on/off', expectedResponse: 'Klik Enter → document.fullscreenElement terisi & tombol Exit muncul; klik Exit → kembali normal',
      specTitle: 'Enter fullscreen benar-benar masuk mode fullscreen & Exit keluar',
      assertions: 'click Enter → poll document.fullscreenElement = true; Exit button visible; click Exit → fullscreenElement = false',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D26', name: 'Top Posts memiliki dropdown Sort by dengan opsi Views dan Engagement', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; dashboard sudah tampil dengan hasil',
      expectedStatus: 'Sukses — dropdown tampil', expectedResponse: 'Combobox "Sort by" visible dengan default "view"; minimal 2 opsi (Views, Engagement)',
      specTitle: 'Top Posts memiliki dropdown Sort by dengan opsi Views dan Engagement',
      assertions: 'combobox "Sort by" visible; toHaveValue("view"); option count >= 2',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D27', name: 'Top Posts dapat di-sort by Engagement', category: 'Positive', priority: 'Medium',
      method: 'Toggle', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; dashboard sudah tampil dengan hasil',
      expectedStatus: 'Sukses — sort berubah & tabel tetap tampil', expectedResponse: 'Setelah select "engagement": combobox value = "engagement"; tabel masih visible dengan 6 kolom',
      specTitle: 'Top Posts dapat di-sort by Engagement',
      assertions: 'selectOption("engagement") → toHaveValue("engagement"); table th = [Platform, Post, Emotion, Topic, Views, Engagement]',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D28', name: 'Period dropdown tersedia di search filters dengan opsi lengkap', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; dashboard sudah tampil',
      expectedStatus: 'Sukses — dropdown tampil', expectedResponse: 'Combobox "Period" visible dengan default disabled "Select period"; opsi: 24 Hours, 3 Days, 7 Days, 1 Month, Custom',
      specTitle: 'Period dropdown tersedia di search filters',
      assertions: 'combobox "Period" visible; option count >= 5',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D29', name: 'Protocol status badge menampilkan level dan deskripsi', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; dashboard sudah tampil',
      expectedStatus: 'Sukses — badge tampil', expectedResponse: 'Teks "Protocol:" terlihat; deskripsi tentang negative emotions & sentiment under control terlihat',
      specTitle: 'protocol status badge menampilkan level dan deskripsi',
      assertions: 'getByText("Protocol:") visible; deskripsi protocol terlihat',
      source: 'Hardcoded di spec', notes: 'Badge protocol status (green/alert/danger)',
    },
    {
      id: 'TC-UI-D30', name: 'Dashboard menampilkan timestamp "Updated just now"', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; dashboard sudah tampil',
      expectedStatus: 'Sukses — timestamp tampil', expectedResponse: 'Teks "Updated just now" terlihat di header dashboard',
      specTitle: 'dashboard menampilkan timestamp "Updated just now"',
      assertions: 'getByText("Updated just now") visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-D31', name: 'Dashboard menampilkan subtitle "Social Intelligence Platform"', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; user membuka dashboard',
      expectedStatus: 'Sukses — subtitle tampil', expectedResponse: 'Teks "Social Intelligence Platform" terlihat di bawah header',
      specTitle: 'dashboard menampilkan subtitle "Social Intelligence Platform"',
      assertions: 'getByText("Social Intelligence Platform") visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    // ── Posts Page (/monitoring/dashboard/posts) ──────────────────────
    {
      id: 'TC-UI-D32', name: 'Halaman Posts menampilkan tabel dengan kolom benar', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard/posts?keyword=RUU+Digital&sort_by=view', headers: '—', params: 'keyword, sort_by', requestBody: '—',
      precondition: 'Mock API dashboard aktif; user membuka halaman posts',
      expectedStatus: 'Sukses — tabel tampil', expectedResponse: 'Tabel dengan 6 kolom: Platform, Post, Emotion, Topic, Views, Engagement',
      specTitle: 'halaman posts menampilkan tabel dengan kolom yang benar',
      assertions: 'table th = [Platform, Post, Emotion, Topic, Views, Engagement]',
      source: 'posts-page.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D33', name: 'Posts page menampilkan data post dari mock API', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard/posts?keyword=RUU+Digital&sort_by=view', headers: '—', params: 'keyword', requestBody: '—',
      precondition: 'Mock API dashboard aktif; user membuka halaman posts',
      expectedStatus: 'Sukses — data render', expectedResponse: 'Row pertama: TikTok, emotion anger, engagement 8432',
      specTitle: 'posts page menampilkan data post dari mock API',
      assertions: 'postRows count > 0; getByText("TikTok") visible; getByText("anger") visible',
      source: 'posts-page.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D34', name: 'Sort by dropdown tersedia dengan opsi Views dan Engagement', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard/posts', headers: '—', params: 'sort_by=view', requestBody: '—',
      precondition: 'User membuka halaman posts',
      expectedStatus: 'Sukses — dropdown tampil', expectedResponse: 'Combobox "Sort by" visible, value="view", minimal 2 opsi',
      specTitle: 'sort by dropdown tersedia dengan opsi Views dan Engagement',
      assertions: 'getByRole combobox "Sort by" visible;toHaveValue("view"); option count >= 2',
      source: 'posts-page.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D35', name: 'Sort by Engagement mengubah urutan post', category: 'Positive', priority: 'Medium',
      method: 'Interaction', endpoint: '/monitoring/dashboard/posts', headers: '—', params: 'sort_by=engagement', requestBody: '—',
      precondition: 'User membuka halaman posts dengan sort_by=view',
      expectedStatus: 'Sukses — sort berubah', expectedResponse: 'Select engagement → value berubah; tabel masih terrender',
      specTitle: 'sort by engagement mengubah urutan post',
      assertions: 'selectOption("engagement") → toHaveValue("engagement"); postRows count > 0',
      source: 'posts-page.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D36', name: 'Tombol Apply filter dan Reset filter tersedia di halaman Posts', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard/posts', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman posts',
      expectedStatus: 'Sukses — tombol tampil', expectedResponse: 'Tombol "Apply filter" dan "Reset filter" visible',
      specTitle: 'tombol Apply filter dan Reset filter tersedia',
      assertions: 'getByRole button "Apply filter" visible; getByRole button "Reset filter" visible',
      source: 'posts-page.spec.ts', notes: '—',
    },

    {
      id: 'TC-UI-D36b', name: 'Filter Topic mempersempit daftar post sesuai pilihan', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/monitoring/dashboard/posts', headers: '—', params: 'topic=<nilai opsi>', requestBody: 'GET top-posts-list?topic=<terpilih>',
      precondition: 'Halaman posts memuat opsi topic dari topic-intelligence',
      expectedStatus: 'Sukses - param topic terkirim', expectedResponse: 'Request top-posts-list terakhir mengandung topic=<nilai terpilih> (decoded)',
      specTitle: 'filter Topic mempersempit daftar post sesuai pilihan',
      assertions: 'selectOption index 1 -> Apply -> poll URL decoded contains topic=<chosen>',
      source: 'Hardcoded di spec', notes: 'Filter Topic baru pada halaman posts (deploy 2026-08).',
    },    {
      id: 'TC-UI-D37', name: 'Link Dashboard untuk kembali ke dashboard utama', category: 'Navigation', priority: 'Medium',
      method: 'Navigation', endpoint: '/monitoring/dashboard/posts', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman posts',
      expectedStatus: 'Sukses — navigasi', expectedResponse: 'Link "Dashboard" visible; klik → URL /monitoring/dashboard',
      specTitle: 'link Dashboard untuk kembali ke dashboard utama',
      assertions: 'getByRole main link "Dashboard" visible; click → URL contains /monitoring/dashboard',
      source: 'posts-page.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D38', name: 'URL posts page mengandung parameter keyword dan sort_by', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/monitoring/dashboard/posts?keyword=RUU+Digital&sort_by=engagement', headers: '—', params: 'keyword, sort_by', requestBody: '—',
      precondition: 'User membuka halaman posts',
      expectedStatus: 'Sukses — URL benar', expectedResponse: 'URL mengandung "keyword=" dan "sort_by=engagement"',
      specTitle: 'URL mengandung parameter keyword dan sort_by',
      assertions: 'page.url() contains "keyword="; contains "sort_by=engagement"',
      source: 'posts-page.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D39', name: 'Page title halaman Posts mengandung "Post"', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/monitoring/dashboard/posts', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman posts',
      expectedStatus: 'Sukses — title benar', expectedResponse: 'Page title mengandung kata "post"',
      specTitle: 'page title mengandung "Post" atau "Posts"',
      assertions: 'page.title() matches /post/i',
      source: 'posts-page.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D40', name: 'Data post memiliki view count dan engagement count', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard/posts', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman posts',
      expectedStatus: 'Sukses — angka tampil', expectedResponse: 'Setiap row post memiliki angka (views/engagement)',
      specTitle: 'data post memiliki view count dan engagement count',
      assertions: 'postRows.first().textContent() matches /\\d/',
      source: 'posts-page.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D40b', name: 'Filter emotion & pencarian mempersempit daftar post', category: 'Positive', priority: 'High',
      method: 'Filter', endpoint: '/monitoring/dashboard/posts', headers: '—', params: 'emotion=Joy; search=Antusiasme warga', requestBody: 'GET top-posts-list?emotion=Joy&search=...',
      precondition: 'Mock API top-posts-list mendukung param emotion & search',
      expectedStatus: 'Sukses — daftar terfilter', expectedResponse: 'Hanya post joy yang mengandung teks pencarian tersisa (1 row)',
      specTitle: 'filter emotion & pencarian mempersempit daftar post',
      assertions: 'select #tpEmotion Joy + fill #tpSearch → Apply → expectPostCount(1); first row contains "Antusiasme warga"',
      source: 'posts-page.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D40c', name: 'Reset filter di halaman Posts mengosongkan input & mengembalikan daftar lengkap', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/monitoring/dashboard/posts', headers: '—', params: 'filter aktif lalu Reset', requestBody: '—',
      precondition: 'Filter emotion=Joy sedang aktif (1 row)',
      expectedStatus: 'Sukses — reset bekerja', expectedResponse: '#tpEmotion kembali "all", #tpSearch kosong, seluruh post tampil kembali (2 rows)',
      specTitle: 'Reset filter mengosongkan input & mengembalikan daftar lengkap',
      assertions: 'setelah Reset → emotionSelect value "all"; searchInput value ""; expectPostCount(2)',
      source: 'posts-page.spec.ts', notes: 'Reset dilakukan client-side (tanpa request baru).',
    },
    // ── Topic Detail (/monitoring/dashboard/topic/:topic) ─────────────
    {
      id: 'TC-UI-D41', name: 'Halaman Topic Detail menampilkan nama topik sebagai heading', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard/topic/lainnya?keyword=RUU+Digital', headers: '—', params: 'keyword', requestBody: '—',
      precondition: 'Mock API dashboard aktif; user membuka halaman topic detail',
      expectedStatus: 'Sukses — heading tampil', expectedResponse: 'H1 menampilkan nama topik (bukan "Loading topic...")',
      specTitle: 'halaman topic detail menampilkan nama topik sebagai heading',
      assertions: 'h1.first() not text "Loading topic..."; visible',
      source: 'topic-detail.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D42', name: 'Halaman Topic Detail menampilkan heading "Post list"', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard/topic/lainnya?keyword=RUU+Digital', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; user membuka halaman topic detail',
      expectedStatus: 'Sukses — heading tampil', expectedResponse: 'Heading "Post list" visible',
      specTitle: 'halaman topic detail menampilkan heading "Post list"',
      assertions: 'getByRole heading "Post list" visible',
      source: 'topic-detail.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D43', name: 'Tabel post memiliki kolom Platform, Post, Emotion, Sentiment, Engagement', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard/topic/lainnya', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman topic detail',
      expectedStatus: 'Sukses — tabel tampil', expectedResponse: 'Tabel dengan 5 kolom: Platform, Post, Emotion, Sentiment, Engagement',
      specTitle: 'tabel post memiliki kolom Platform, Post, Emotion, Sentiment, Engagement',
      assertions: 'table th = [Platform, Post, Emotion, Sentiment, Engagement]',
      source: 'topic-detail.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D44', name: 'Post rows terrender dari mock API di halaman Topic Detail', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/dashboard/topic/lainnya', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif',
      expectedStatus: 'Sukses — data render', expectedResponse: 'Minimal 1 row post tampil dengan platform TikTok',
      specTitle: 'post rows ter-render dari mock API',
      assertions: 'postRows count > 0; getByText("TikTok") visible',
      source: 'topic-detail.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D45', name: 'Chart emotion/sentiment terrender (SVG elements)', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard/topic/lainnya', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman topic detail',
      expectedStatus: 'Sukses — chart tampil', expectedResponse: 'Minimal 1 SVG chart element visible',
      specTitle: 'chart emotion/sentiment terrender (SVG elements)',
      assertions: 'svg count >= 1',
      source: 'topic-detail.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D46', name: 'Tombol Apply filter dan Reset filter tersedia di Topic Detail', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/dashboard/topic/lainnya', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman topic detail',
      expectedStatus: 'Sukses — tombol tampil', expectedResponse: 'Tombol "Apply filter" dan "Reset filter" visible',
      specTitle: 'tombol Apply filter dan Reset filter tersedia',
      assertions: 'getByRole button "Apply filter" visible; getByRole button "Reset filter" visible',
      source: 'topic-detail.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D47', name: 'Link Dashboard untuk kembali dari Topic Detail ke dashboard', category: 'Navigation', priority: 'Medium',
      method: 'Navigation', endpoint: '/monitoring/dashboard/topic/lainnya', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman topic detail',
      expectedStatus: 'Sukses — link tampil', expectedResponse: 'Link "Dashboard" visible di halaman',
      specTitle: 'link "Dashboard" untuk kembali ke dashboard utama',
      assertions: 'getByRole link "Dashboard" first() visible',
      source: 'topic-detail.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D48', name: 'Link "Topic intelligence" untuk kembali ke topic overview', category: 'Navigation', priority: 'Medium',
      method: 'Navigation', endpoint: '/monitoring/dashboard/topic/lainnya', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman topic detail',
      expectedStatus: 'Sukses — navigasi', expectedResponse: 'Link "Topic intelligence" visible; klik → kembali ke dashboard',
      specTitle: 'link "Topic intelligence" untuk kembali ke topic overview',
      assertions: 'getByRole link "Topic intelligence" visible; click → URL /monitoring/dashboard',
      source: 'topic-detail.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D49', name: 'URL topic detail mengandung parameter keyword', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/monitoring/dashboard/topic/lainnya?keyword=RUU+Digital', headers: '—', params: 'keyword', requestBody: '—',
      precondition: 'User membuka halaman topic detail',
      expectedStatus: 'Sukses — URL benar', expectedResponse: 'URL mengandung "keyword=" dan "topic/lainnya"',
      specTitle: 'URL mengandung parameter keyword',
      assertions: 'page.url() contains "keyword="; contains "topic/lainnya"',
      source: 'topic-detail.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D50', name: 'Page title halaman Topic Detail mengandung "Topic"', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/monitoring/dashboard/topic/lainnya', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman topic detail',
      expectedStatus: 'Sukses — title benar', expectedResponse: 'Page title mengandung kata "topic"',
      specTitle: 'page title mengandung "Topic"',
      assertions: 'page.title() matches /topic/i',
      source: 'topic-detail.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D51', name: 'Navigasi dari dashboard ke topic detail via topik link', category: 'Navigation', priority: 'Medium',
      method: 'Navigation', endpoint: '/monitoring/dashboard → /monitoring/dashboard/topic/:topic', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard aktif; user di dashboard',
      expectedStatus: 'Sukses — navigasi', expectedResponse: 'Klik topik di Topic Intelligence → URL berubah ke /monitoring/dashboard/topic/:topic',
      specTitle: 'navigasi dari dashboard ke topic detail via topik link',
      assertions: 'URL matches /monitoring/dashboard/topic\\//',
      source: 'topic-detail.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-D52', name: 'Filter emotion mempersempit post list di topic detail & reset mengembalikan', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/monitoring/dashboard/topic/lainnya?keyword=RUU+Digital', headers: '—', params: 'emotion=Anger lalu Reset', requestBody: 'GET topic-intelligence-detail?emotion=anger',
      precondition: 'Mock API topic-intelligence-detail mendukung param emotion (2 post: anger + joy)',
      expectedStatus: 'Sukses — filter & reset bekerja', expectedResponse: 'Setelah filter Anger: 1 row ber-emotion anger; setelah Reset: select "all" & 2 rows kembali',
      specTitle: 'filter emotion mempersempit post list',
      assertions: 'select #tdEmotion Anger → Apply → expectPostCount(1) contains anger; Reset → value "all"; expectPostCount(2)',
      source: 'topic-detail.spec.ts', notes: '—',
    },
  ];
}

function buildKeywordCases() {
  const filters = loadJson('keyword-filters.json');
  return [
    {
      id: 'TC-UI-K01', name: 'Daftar scheduled keyword tampil lengkap dengan tabel & filter', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/keyword', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API scheduler aktif; user membuka /monitoring/keyword',
      expectedStatus: 'Sukses — tabel & filter tampil (FR-12)', expectedResponse: 'Tab Scheduled aktif; kolom Keyword/Platform/Schedule/Frequency/Status; data & pagination tampil',
      specTitle: 'daftar scheduled keyword tampil lengkap dengan tabel & filter',
      assertions: 'column headers visible; row "SIP Indonesia"; pagination "Page 1 of N"',
      source: 'Hardcoded di spec', notes: '—',
    },
    ...filters.map((d, i) => ({
      id: `TC-UI-K${String(i + 2).padStart(2, '0')}`, name: `Filter status "${d.status}" menampilkan keyword sesuai status`, category: 'Positive', priority: 'High',
      method: 'Filter', endpoint: '/monitoring/keyword', headers: '—', params: `status=${d.status}`, requestBody: '—',
      precondition: 'Mock API scheduler aktif; user di tab Scheduled',
      expectedStatus: 'Sukses — filter status bekerja (FR-13)', expectedResponse: `Keyword status ${d.status} tampil; keyword status lain tidak tampil`,
      specTitle: `filter status "${d.status}" menampilkan keyword sesuai status`,
      assertions: 'expectKeywordVisible(visibleKeyword, true); expectKeywordVisible(hiddenKeyword, false)',
      source: 'test-data/keyword-filters.json', notes: '—',
    })),
    {
      id: `TC-UI-K${String(filters.length + 2).padStart(2, '0')}`, name: 'Filter platform bekerja mempersempit daftar', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/monitoring/keyword', headers: '—', params: 'platform=TikTok', requestBody: '—',
      precondition: 'Mock API scheduler aktif; user di tab Scheduled',
      expectedStatus: 'Sukses — filter platform bekerja (FR-13)', expectedResponse: 'Hanya keyword dengan platform TikTok yang tampil',
      specTitle: 'filter platform bekerja mempersempit daftar',
      assertions: '"SIP Indonesia" visible; "Isu Pendidikan" (hanya X) tidak tampil',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: `TC-UI-K${String(filters.length + 3).padStart(2, '0')}`, name: 'Pencarian keyword memfilter daftar', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/monitoring/keyword', headers: '—', params: 'keyword=layanan', requestBody: '—',
      precondition: 'Mock API scheduler aktif; user di tab Scheduled',
      expectedStatus: 'Sukses — pencarian bekerja (FR-11/FR-13)', expectedResponse: 'Hanya keyword yang cocok yang tampil',
      specTitle: 'pencarian keyword memfilter daftar',
      assertions: '"Layanan Publik" visible; "SIP Indonesia" tidak tampil',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: `TC-UI-K${String(filters.length + 4).padStart(2, '0')}`, name: 'Tab On Demand menampilkan daftar & filter status', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/monitoring/keyword?tab=unscheduled', headers: '—', params: 'status=completed', requestBody: '—',
      precondition: 'Mock API unscheduled aktif; user berada di tab On Demand',
      expectedStatus: 'Sukses — daftar & filter tampil (FR-12/FR-13)', expectedResponse: 'Daftar on-demand & kolomnya tampil; filter status berfungsi',
      specTitle: 'tab On Demand menampilkan daftar & filter status',
      assertions: 'column headers Keyword/Status; "Bantuan Sosial 2026" visible; "Kenaikan Harga" tidak tampil saat status completed',
      source: 'Hardcoded di spec', notes: '—',
    },
    // ---- Modal Add keyword & Edit scheduled keyword (FR-13) ----
    {
      id: 'TC-UI-K07', name: 'Modal Add keyword terbuka dengan field & nilai default', category: 'Positive', priority: 'High',
      method: 'Modal', endpoint: '/monitoring/keyword?tab=unscheduled', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API unscheduled aktif; user di tab On Demand; tombol "+ Add keyword" tersedia',
      expectedStatus: 'Sukses — modal terbuka', expectedResponse: 'Dialog "Add keyword"; input keyword; platform X/Instagram/TikTok terpilih; periode default 24 hours',
      specTitle: 'modal Add keyword terbuka dengan field & nilai default',
      assertions: 'dialog visible; getByRole checkbox X/Instagram/TikTok checked; radio "24 hours" checked',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-K08', name: 'Validasi keyword kosong tidak mengirim request (modal tetap terbuka)', category: 'Negative', priority: 'High',
      method: 'Modal', endpoint: '/monitoring/keyword?tab=unscheduled', headers: '—', params: 'keyword=', requestBody: '(tidak ada POST)',
      precondition: 'Mock POST keyword-management aktif; modal Add keyword terbuka dengan form kosong',
      expectedStatus: 'Validasi menolak submit', expectedResponse: 'Tidak ada POST keluar; modal tetap terbuka',
      specTitle: 'validasi keyword kosong tidak mengirim request (modal tetap terbuka)',
      assertions: 'submitCreate kosong -> expectCreateModalOpen(true); expect.poll posts.length = 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-K09', name: 'Submit valid mengirim POST ke BE sesuai kontrak keyword-management', category: 'Positive', priority: 'High',
      method: 'Modal', endpoint: '/monitoring/keyword?tab=unscheduled', headers: '—', params: 'keyword=Tes Keyword', requestBody: '{ keyword: [...], platform: [...], period } -> POST /v1/scrape/keyword-management',
      precondition: 'Mock POST keyword-management 201 aktif; modal Add keyword (On Demand) terbuka',
      expectedStatus: 'Sukses - POST terkirim sesuai kontrak baru', expectedResponse: 'POST body membawa keyword yang diisi (array)',
      specTitle: 'submit valid mengirim POST ke BE sesuai kontrak keyword-management',
      assertions: 'expect.poll postBodies > 0; keyword echo = Tes Keyword',
      source: 'Hardcoded di spec', notes: 'Penutupan modal tidak diassert (UI menunggu konfirmasi list-refresh).',
    },
    {
      id: 'TC-UI-K10', name: 'Gagal dari server membuat modal tetap terbuka', category: 'Negative', priority: 'Medium',
      method: 'Modal', endpoint: '/monitoring/keyword?tab=unscheduled', headers: '—', params: 'mock POST 500', requestBody: 'POST -> 500',
      precondition: 'Mock POST gagal (500); form Add On Demand terisi valid',
      expectedStatus: 'Error ditangani UI', expectedResponse: 'Modal tetap terbuka setelah submit',
      specTitle: 'gagal dari server membuat modal tetap terbuka',
      assertions: 'submitCreate -> expectCreateModalOpen(true)',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-K12', name: 'Modal Edit scheduled keyword terbuka dengan data baris terisi', category: 'Positive', priority: 'High',
      method: 'Modal', endpoint: '/monitoring/keyword', headers: '—', params: 'row=RUU Digital', requestBody: '—',
      precondition: 'Mock API scheduler aktif; user di tab Scheduled',
      expectedStatus: 'Sukses - modal terbuka dengan data ter-prefill', expectedResponse: 'Dialog "Edit scheduled keyword"; #edit-keyword ter-prefill; tombol Save changes',
      specTitle: 'modal Edit scheduled keyword terbuka dengan data baris terisi',
      assertions: 'editKeywordInput value RUU Digital; platform checkboxes checked; button Save changes visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-K13', name: 'Validasi keyword kosong pada modal Edit scheduled keyword', category: 'Negative', priority: 'High',
      method: 'Modal', endpoint: '/monitoring/keyword', headers: '—', params: 'keyword=', requestBody: '(tidak ada PUT)',
      precondition: 'Modal Edit scheduled keyword terbuka',
      expectedStatus: 'Validasi - tidak tersimpan', expectedResponse: 'Tanpa request PUT; modal tetap terbuka tanpa toast sukses',
      specTitle: 'validasi keyword kosong tidak menyimpan (modal tetap terbuka)',
      assertions: 'fill empty keyword -> Save -> modal open; poll puts.length = 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-K14', name: 'Simpan perubahan modal Edit mengirim PUT ke BE & menutup modal', category: 'Positive', priority: 'High',
      method: 'Modal', endpoint: '/monitoring/keyword', headers: '—', params: 'keyword=RUU Digital Baru', requestBody: '{ keyword, platforms, schedule_enabled: true, schedule } -> PUT /v1/scrape/keyword-management/:id',
      precondition: 'Mock PUT keyword-management/:id 200 aktif; modal Edit terbuka',
      expectedStatus: 'Sukses - PUT terkirim & modal tertutup', expectedResponse: 'PUT body.keyword = RUU Digital Baru; schedule_enabled true; platforms array; modal tertutup',
      specTitle: 'simpan perubahan mengirim PUT ke BE & menutup modal',
      assertions: 'poll putBodies > 0; field checks; editModal count 0',
      source: 'Hardcoded di spec', notes: 'Kontrak baru: PUT (dulu PATCH /scheduler/:id dgn cron).',
    },
    {
      id: 'TC-UI-K23', name: '[REGRESI R1] Submit "+ Add keyword" (Scheduled) harus mengirim POST & menutup modal', category: 'Regression', priority: 'High',
      method: 'Modal', endpoint: '/monitoring/keyword', headers: '—', params: 'keyword=SIP Indonesia; frequency=1; maxPosts=500', requestBody: 'POST /api/admin/keyword/scheduler → { keyword, platforms, frequency, maxPosts }',
      precondition: 'Mock POST scheduler 201 aktif; modal Add scheduled keyword terbuka',
      expectedStatus: 'Sukses — request terkirim', expectedResponse: 'Request POST ke /api/admin/keyword/scheduler terkirim dengan keyword yang diisi; modal menutup',
      specTitle: 'REGRESI R1: submit "+ Add keyword" (Scheduled) harus mengirim POST ke API',
      assertions: 'expect.poll POST body length > 0; body.keyword = "SIP Indonesia"; modal count 0',
      source: 'Hardcoded di spec', notes: 'Bug B1: saat ini NO-OP (submit hanya menutup modal, tanpa request & toast). Test FAIL sampai fitur tersambung ke API.',
    },
    {
      id: 'TC-UI-K24', name: '[REGRESI R2] Periode Custom tanggal terbalik harus DITOLAK', category: 'Regression', priority: 'High',
      method: 'Modal', endpoint: '/monitoring/keyword?tab=unscheduled', headers: '—', params: 'period=custom; dateFrom=2026-08-10; dateTo=2026-08-01 (TERBALIK)', requestBody: '{ keyword: "Tes Tanggal Terbalik", period: "custom", dateFrom: "2026-08-10", dateTo: "2026-08-01" }',
      precondition: 'Modal Add keyword (On Demand) terbuka; periode Custom; tanggal terbalik diisi',
      expectedStatus: 'Validasi menolak submit (TC-UI-005 / P-03)', expectedResponse: 'Submit tidak terkirim; modal tetap terbuka; tidak ada toast sukses',
      specTitle: 'REGRESI R2: periode Custom dengan tanggal terbalik harus DITOLAK (tanpa request)',
      assertions: 'expectCreateModalOpen(true); poll POST count 0; toast sukses count 0',
      source: 'Hardcoded di spec', notes: 'Bug B3: tanggal terbalik saat ini diterima & diproses. Test FAIL sampai validasi urutan tanggal ditambahkan.',
    },
    {
      id: 'TC-UI-K25', name: '[REGRESI B4] Submit Move to scheduled harus mengirim request API (bukan toast-only)', category: 'Regression', priority: 'High',
      method: 'Modal', endpoint: '/monitoring/keyword?tab=unscheduled', headers: '—', params: 'item=Bantuan Sosial 2026 (completed); frequency=1; maxPosts=500', requestBody: 'POST/PATCH ke API scheduler (endpoint sesuai implementasi fix)',
      precondition: 'Mock API unscheduled + scheduler aktif; modal Move to scheduled keyword terbuka',
      expectedStatus: 'Sukses — request terkirim', expectedResponse: 'Submit Move keyword mengirim minimal 1 request API (bukan GET) ke /api/admin/keyword/*',
      specTitle: 'REGRESI B4: submit Move to scheduled harus mengirim request API (bukan toast-only)',
      assertions: 'moveButton click → moveModal visible → moveSubmitButton click → expect.poll mutations.length > 0',
      source: 'Hardcoded di spec', notes: 'Bug B4: submit hanya toast.success + onClose(), tanpa API call — hasil pemindahan hilang saat reload. Test FAIL sampai API dipanggil.',
    },
    {
      id: 'TC-UI-K26', name: 'Tombol Reset filter mengosongkan pencarian & mengembalikan daftar lengkap', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/monitoring/keyword', headers: '—', params: 'search=RUU lalu Reset filter', requestBody: '—',
      precondition: 'Mock API scheduler aktif; user di halaman keyword tab Scheduled',
      expectedStatus: 'Sukses — filter direset', expectedResponse: 'Input pencarian kosong; keyword yang tadinya tersembunyi tampil kembali (daftar penuh)',
      specTitle: 'tombol Reset filter mengosongkan pencarian & mengembalikan daftar lengkap',
      assertions: 'searchKeyword("RUU") → BPJS hidden; click Reset filter → searchInput value "" ; RUU Digital & BPJS Kesehatan visible',
      source: 'Hardcoded di spec', notes: '—',
    },

    {
      id: 'TC-UI-K30b', name: 'Submit Move to scheduled menutup modal', category: 'Positive', priority: 'Medium',
      method: 'Modal', endpoint: '/monitoring/keyword?tab=unscheduled', headers: '—', params: 'item=RUU Digital', requestBody: '—',
      precondition: 'Move modal terbuka',
      expectedStatus: 'Sukses - UX submit', expectedResponse: 'Setelah klik Move keyword, modal tertutup (apapun hasil server)',
      specTitle: 'submit Move to scheduled menutup modal',
      assertions: 'moveSubmitButton click -> moveModal count 0',
      source: 'Hardcoded di spec', notes: '—',
    },    {
      id: 'TC-UI-K27', name: 'Baris Scheduled menyediakan tombol Edit langsung', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/keyword (tab Scheduled)', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API scheduler aktif; user di tab Scheduled',
      expectedStatus: 'Sukses — tombol Edit per baris tampil', expectedResponse: 'Setiap baris memiliki tombol aria-label "Edit <keyword>"',
      specTitle: 'baris Scheduled menyediakan tombol Edit langsung',
      assertions: 'editRowButton("RUU Digital") visible',
      source: 'Hardcoded di spec', notes: 'UI baru: aksi Edit bukan lagi lewat action-menu.',
    },
    {
      id: 'TC-UI-K28', name: 'Modal Edit scheduled keyword terbuka dari tombol Edit baris', category: 'Positive', priority: 'Medium',
      method: 'Modal', endpoint: '/monitoring/keyword (tab Scheduled)', headers: '—', params: 'target=RUU Digital', requestBody: '—',
      precondition: 'Mock API scheduler aktif',
      expectedStatus: 'Sukses — modal prefilled', expectedResponse: 'Heading "Edit scheduled keyword"; #edit-keyword berisi keyword baris',
      specTitle: 'modal Edit scheduled keyword terbuka dari tombol Edit baris',
      assertions: 'openEditModal → editModal visible; editKeywordInput value RUU Digital',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-K29', name: 'Dialog Reprocess keyword terbuka dengan prefill & dapat dibatalkan', category: 'Positive', priority: 'Medium',
      method: 'Modal', endpoint: '/monitoring/keyword?tab=unscheduled', headers: '—', params: 'item=RUU Digital', requestBody: '—',
      precondition: 'Mock API unscheduled aktif; baris On Demand tersedia',
      expectedStatus: 'Sukses — dialog terbuka lalu batal', expectedResponse: 'Combobox Keyword disabled terisi nama; tombol Start reprocessing ada; Cancel menutup',
      specTitle: 'dialog Reprocess keyword terbuka dengan keyword ter-prefill & dapat dibatalkan',
      assertions: 'reprocessButton click → dialog visible; reprocessKeywordInput value RUU Digital; Cancel → count 0',
      source: 'Hardcoded di spec', notes: 'Fitur baru pengganti Retry lama.',
    },
    {
      id: 'TC-UI-K30', name: 'Modal Move to scheduled keyword terbuka dengan prefill & submit', category: 'Positive', priority: 'Medium',
      method: 'Modal', endpoint: '/monitoring/keyword?tab=unscheduled', headers: '—', params: 'item=RUU Digital', requestBody: '—',
      precondition: 'Mock create scheduler aktif (jaring pengaman)',
      expectedStatus: 'Sukses — modal terbuka & interaksi submit', expectedResponse: 'Modal berisi #move-keyword & tombol Move keyword',
      specTitle: 'modal Move to scheduled keyword: terbuka dengan prefill & tombol submit',
      assertions: 'moveButton click → moveModal visible; submit click → modal tertutup',
      source: 'Hardcoded di spec', notes: 'Bug B4 (tanpa API call) masih terbuka — lihat regresi B4.',
    },
    {
      id: 'TC-UI-K31', name: 'Detail unscheduled completed menampilkan breadcrumb, heading & analisis', category: 'Positive', priority: 'High',
      method: 'Navigate', endpoint: '/monitoring/keyword/unscheduled/un-1', headers: '—', params: 'mock detail sukses', requestBody: 'GET /v1/scrape/keyword-management/unscheduled/:id',
      precondition: 'Mock detail 200 (status completed)',
      expectedStatus: 'Sukses — halaman detail penuh', expectedResponse: 'Breadcrumb visible; h1 keyword; kartu Conversation summary & Sentiment & Emotion Analysis tampil',
      specTitle: 'detail unscheduled completed menampilkan breadcrumb, heading, dan hasil analisis',
      assertions: 'breadcrumb visible; heading RUU Digital; dua heading analisis visible',
      source: 'Hardcoded di spec', notes: 'Endpoint baru /v1/scrape/keyword-management/unscheduled/:id.',
    },
    {
      id: 'TC-UI-K32', name: 'Detail unscheduled gagal dimuat menampilkan pesan error', category: 'Negative', priority: 'High',
      method: 'Navigate', endpoint: '/monitoring/keyword/unscheduled/un-x', headers: '—', params: 'mock detail selalu 500', requestBody: 'GET detail → 500',
      precondition: 'Mock detail gagal permanen',
      expectedStatus: 'Error ditangani UI', expectedResponse: 'Pesan "Failed to load keyword detail." tampil',
      specTitle: 'detail gagal dimuat menampilkan pesan error',
      assertions: 'getByText("Failed to load keyword detail.") visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-K33', name: 'Halaman KI menampilkan heading & empat section intelijen', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/monitoring/keyword-intelligence', headers: '—', params: '—', requestBody: 'GET /api/keyword-intelligence/* (proxy)',
      precondition: 'User membuka route baru dari navbar',
      expectedStatus: 'Sukses — halaman tampil', expectedResponse: 'Heading utama + section Sentiment & emotion, Early warning, Topic intelligence, Actor intelligence',
      specTitle: 'halaman menampilkan heading & empat section intelijen',
      assertions: 'heading utama exact visible; 4 heading section visible',
      source: 'Hardcoded di spec', notes: 'Halaman BARU deploy 2026-08 — sebelumnya tanpa test.',
    },
    {
      id: 'TC-UI-K34', name: 'Tombol Export report & Export brief tersedia di Keyword Intelligence', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/monitoring/keyword-intelligence', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman KI',
      expectedStatus: 'Sukses — tombol aksi tampil', expectedResponse: 'Button "Export report" & "Export brief" visible',
      specTitle: 'tombol Export report & Export brief tersedia',
      assertions: 'kedua button visible',
      source: 'Hardcoded di spec', notes: 'Export report kini milik halaman ini (dulu di dashboard).',
    },
    {
      id: 'TC-UI-K35', name: 'Filter keyword dapat diterapkan tanpa merusak halaman KI', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/monitoring/keyword-intelligence', headers: '—', params: 'keyword=<opsi pertama>', requestBody: 'GET /api/keyword-intelligence/* dengan keyword terpilih',
      precondition: 'User membuka halaman KI',
      expectedStatus: 'Sukses — filter aman', expectedResponse: 'Setelah Apply: heading utama & section Early warning tetap tampil',
      specTitle: 'filter keyword dapat diterapkan tanpa merusak halaman',
      assertions: 'Apply filter click → heading utama & Early warning tetap visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-K36', name: 'Link topic intelligence tersedia dengan href pola detail topik', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/monitoring/keyword-intelligence', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman KI',
      expectedStatus: 'Sukses — entry point topik ada', expectedResponse: 'Anchor ke /topic/<slug> tampil (atau section Topic intelligence saat data kosong)',
      specTitle: 'link topic intelligence tersedia dengan href pola detail topik',
      assertions: 'topicLink visible → href match pola; else heading Topic intelligence visible + annotation',
      source: 'Hardcoded di spec', notes: 'Klik programmatic Next-link tidak stabil di headless — cukup kontrak href.',
    },

  ];
}

function buildControlCases() {
  return [
    {
      id: 'TC-UI-C01', name: 'Alert protocol wall menampilkan status aktif & indikator threshold', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/control/alert-protocol', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka /control/alert-protocol',
      expectedStatus: 'Sukses — wall tampil', expectedResponse: 'Judul "Alert", "Active Protocol", "Active since", "Threshold indicator", "Danger threshold at 60%" tampil',
      specTitle: 'alert protocol wall menampilkan status aktif & indikator threshold',
      assertions: 'heading "Alert" visible; texts "Active Protocol"/"Active since"/"Threshold indicator"/"Danger threshold at 60%"',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-C02', name: 'Danger protocol wall menampilkan status aktif', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/control/danger-protocol', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka /control/danger-protocol',
      expectedStatus: 'Sukses — wall tampil', expectedResponse: 'Judul "Danger", "Active Protocol", "Active since" tampil',
      specTitle: 'danger protocol wall menampilkan status aktif',
      assertions: 'heading "Danger" visible; "Active Protocol" & "Active since" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-C03', name: 'Green protocol wall menampilkan status aktif', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/control/green-protocol', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka /control/green-protocol',
      expectedStatus: 'Sukses — wall tampil', expectedResponse: 'Judul "Green — Under Control", "Active Protocol" tampil',
      specTitle: 'green protocol wall menampilkan status aktif',
      assertions: 'heading "Green — Under Control" visible; "Active Protocol" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    // ---- Display Wall Coverage Mendalam (2026-08-22) ----
    {
      id: 'TC-UI-C04', name: 'Setiap display wall memiliki URL path yang benar', category: 'Positive', priority: 'High',
      method: 'Navigate', endpoint: '/control/alert-protocol · /control/danger-protocol · /control/green-protocol', headers: '—', params: '3 URL wall', requestBody: '—',
      precondition: 'User membuka tiap URL wall control protocol',
      expectedStatus: 'Sukses — tiap wall tampil dengan URL benar', expectedResponse: 'Setiap wall menampilkan heading judul wall sesuai URL path',
      specTitle: 'setiap wall memiliki URL path yang benar',
      assertions: 'goto tiap wall → URL path cocok; heading judul wall visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-C05', name: 'Dropdown Display Wall memuat Conversation Overview & Top Engagement (tanpa protocol walls)', category: 'Positive', priority: 'Medium',
      method: 'Navigate', endpoint: '/monitoring/dashboard', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di dashboard; tombol Display Wall ada di navbar',
      expectedStatus: 'Sukses — dropdown tampil 2 wall', expectedResponse: 'Link Conversation Overview & Top Engagement dengan href benar; link protocol walls tidak ada lagi di navbar',
      specTitle: 'dropdown Display Wall memuat Conversation Overview & Top Engagement (tanpa protocol walls)',
      assertions: 'coLink href /display/conversation-overview; teLink href /display/top-engagement; alertLink count 0',
      source: 'Hardcoded di spec', notes: 'Protocol walls kini hanya diakses via URL langsung.',
    },
    {
      id: 'TC-UI-C06', name: 'Alert wall menampilkan deskripsi tentang negative emotions', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/control/alert-protocol', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka /control/alert-protocol',
      expectedStatus: 'Sukses — deskripsi tampil', expectedResponse: 'Alert wall memiliki deskripsi tentang level emosi (Negative emotions / Emotion)',
      specTitle: 'alert wall menampilkan deskripsi tentang negative emotions',
      assertions: 'getByText(/Negative emotions|Emotion/i) visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-C07', name: 'Green wall menampilkan deskripsi sentiment under control', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/control/green-protocol', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka /control/green-protocol',
      expectedStatus: 'Sukses — deskripsi tampil', expectedResponse: 'Green wall memiliki deskripsi tentang sentiment under control',
      specTitle: 'green wall menampilkan deskripsi sentiment under control',
      assertions: 'getByText(/sentiment under control|under control/i) visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-C08', name: 'Semua display wall memiliki heading level 1 yang benar', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/control/alert-protocol · /control/danger-protocol · /control/green-protocol', headers: '—', params: '3 wall', requestBody: '—',
      precondition: 'User membuka tiap URL wall',
      expectedStatus: 'Sukses — heading level 1 visible', expectedResponse: 'Tiap wall memiliki h1 heading: Alert, Danger, atau Green — Under Control',
      specTitle: 'semua wall memiliki heading level 1 yang benar',
      assertions: 'tiap wall → getByRole heading level 1 visible dengan nama yang benar',
      source: 'Hardcoded di spec', notes: 'Konsistensi layout semua wall',
    },
    // ---- Conversation Overview (/display/conversation-overview) ----
    {
      id: 'TC-UI-C09', name: 'Conversation Overview menampilkan heading keyword', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard + control aktif; user membuka halaman',
      expectedStatus: 'Sukses — heading tampil', expectedResponse: 'H1 menampilkan nama keyword (auto-select dari selected-keywords)',
      specTitle: 'halaman menampilkan heading keyword',
      assertions: 'h1.first() contains keyword name',
      source: 'conversation-overview.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C10', name: 'Conversation Overview page title mengandung "Conversation Overview"', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman',
      expectedStatus: 'Sukses — title benar', expectedResponse: 'Page title mengandung "Conversation Overview"',
      specTitle: 'page title mengandung "Conversation Overview"',
      assertions: 'page.title() matches /Conversation Overview/i',
      source: 'conversation-overview.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C11', name: 'Auto-refresh countdown button terlihat di Conversation Overview', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman',
      expectedStatus: 'Sukses — countdown tampil', expectedResponse: 'Tombol countdown "20 seconds" visible',
      specTitle: 'auto-refresh countdown button terlihat',
      assertions: 'button matching /\d+ seconds?/ visible',
      source: 'conversation-overview.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C12', name: 'SIP Insight branding link terlihat & mengarah ke homepage', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman',
      expectedStatus: 'Sukses — link tampil', expectedResponse: 'Link "SIP Insight" visible; href="/"',
      specTitle: 'SIP Insight link mengarah ke homepage (/)',
      assertions: 'getByRole link "SIP Insight" visible; getAttribute("href") === "/"',
      source: 'conversation-overview.spec.ts', notes: '—',
    },

    {
      id: 'TC-UI-C12b', name: 'SIP Insight branding link terlihat di Conversation Overview', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman',
      expectedStatus: 'Sukses - branding tampil', expectedResponse: 'Link "SIP Insight" visible',
      specTitle: 'SIP Insight branding link terlihat',
      assertions: 'expectSipInsightLink()',
      source: 'Hardcoded di spec', notes: '—',
    },    {
      id: 'TC-UI-C13', name: 'Minimal 4 chart SVG terrender di Conversation Overview', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API aktif',
      expectedStatus: 'Sukses — chart tampil', expectedResponse: 'Minimal 4 SVG elements (conversation trend + emotion + sentiment + trending)',
      specTitle: 'minimal 4 chart SVG terrender (conversation trend + emotion + sentiment + trending)',
      assertions: 'svg count >= 4',
      source: 'conversation-overview.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C14', name: 'Conversation trend chart terrender dengan elemen visual', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API aktif',
      expectedStatus: 'Sukses — chart tampil', expectedResponse: 'Chart pertama (conversation trend) memiliki elemen circle/line/path',
      specTitle: 'conversation trend chart terrender',
      assertions: 'charts.first() visible; children (circle|line|path|rect) count > 0',
      source: 'conversation-overview.spec.ts', notes: '—',
    },

    {
      id: 'TC-UI-C14b', name: 'Emotion map chart terrender di Conversation Overview', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: '—', requestBody: '—',
      precondition: 'Wall dirender dgn data BE',
      expectedStatus: 'Sukses - svg cukup', expectedResponse: 'Minimal 3 SVG (trend + emotion + sentiment)',
      specTitle: 'emotion map chart terrender',
      assertions: 'charts count >= 3',
      source: 'Hardcoded di spec', notes: '—',
    },    {
      id: 'TC-UI-C15', name: 'Trending topics section terrender dengan data dari API', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API trending-topic-multi-period aktif',
      expectedStatus: 'Sukses — trending tampil', expectedResponse: 'Minimal salah satu topic ("Public services" atau "Tariff policy") visible',
      specTitle: 'trending topics section terrender',
      assertions: 'getByText("Public services") atau getByText("Tariff policy") visible',
      source: 'conversation-overview.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C16', name: 'Trending topics menampilkan delta per periode (24h, 7d, 1mo)', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API aktif',
      expectedStatus: 'Sukses — delta tampil', expectedResponse: 'Label delta (24h, 7d, atau 1mo) visible',
      specTitle: 'trending topics menampilkan delta per periode (24h, 7d, 1mo)',
      assertions: 'getByText("24h") atau getByText("7d") atau getByText("1mo") visible',
      source: 'conversation-overview.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C17', name: 'Conversation Overview full-screen tanpa navbar utama', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman',
      expectedStatus: 'Sukses — full-screen', expectedResponse: 'Navbar utama (Dashboard/Display Wall/Management) tidak tampil',
      specTitle: 'display wall tidak memiliki navbar utama (full-screen mode)',
      assertions: 'nav link "Dashboard" tidak visible',
      source: 'conversation-overview.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C18', name: 'Conversation Overview menggunakan period=1M sebagai default', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/display/conversation-overview', headers: '—', params: 'period=1M', requestBody: '—',
      precondition: 'Mock API aktif',
      expectedStatus: 'Sukses — period benar', expectedResponse: 'Semua request API menggunakan period=1M',
      specTitle: 'display wall menggunakan period=1M sebagai default',
      assertions: 'semua request /v1/dashboard/ mengandung period=1M',
      source: 'conversation-overview.spec.ts', notes: '—',
    },
    // ---- Top Engagement (/display/top-engagement) ----
    {
      id: 'TC-UI-C19', name: 'Top Engagement menampilkan heading keyword', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API dashboard + control aktif',
      expectedStatus: 'Sukses — heading tampil', expectedResponse: 'H1 menampilkan nama keyword',
      specTitle: 'halaman menampilkan heading keyword',
      assertions: 'h1.first() contains keyword name',
      source: 'top-engagement.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C20', name: 'Top Engagement page title mengandung "Top Engagement"', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman',
      expectedStatus: 'Sukses — title benar', expectedResponse: 'Page title mengandung "Top Engagement"',
      specTitle: 'page title mengandung "Top Engagement"',
      assertions: 'page.title() matches /Top Engagement/i',
      source: 'top-engagement.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C21', name: 'Auto-refresh countdown button terlihat di Top Engagement', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman',
      expectedStatus: 'Sukses — countdown tampil', expectedResponse: 'Tombol countdown visible',
      specTitle: 'auto-refresh countdown button terlihat',
      assertions: 'button matching /\d+ seconds?/ visible',
      source: 'top-engagement.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C22', name: 'SIP Insight branding link terlihat & mengarah ke homepage', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman',
      expectedStatus: 'Sukses — link tampil', expectedResponse: 'Link "SIP Insight" visible; href="/"',
      specTitle: 'SIP Insight link mengarah ke homepage (/)',
      assertions: 'getByRole link "SIP Insight" visible; getAttribute("href") === "/"',
      source: 'top-engagement.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C23', name: 'Minimal 6 chart SVG terrender di Top Engagement', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API aktif',
      expectedStatus: 'Sukses — chart tampil', expectedResponse: 'Minimal 6 SVG elements (posts + accounts + hashtags + charts)',
      specTitle: 'minimal 6 chart SVG terrender (posts + accounts + hashtags + charts)',
      assertions: 'svg count >= 6',
      source: 'top-engagement.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C24', name: 'Top posts terrender dengan link ke source platform', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API aktif',
      expectedStatus: 'Sukses — posts tampil', expectedResponse: 'Minimal 2 post links ke TikTok/Instagram',
      specTitle: 'top posts terrender dengan link ke source platform',
      assertions: 'postLinks (a[href*=tiktok], a[href*=instagram]) count > 0',
      source: 'top-engagement.spec.ts', notes: '—',
    },

    {
      id: 'TC-UI-C24b', name: 'Top posts memiliki minimal 3 post cards', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: '—', requestBody: '—',
      precondition: 'Wall dirender dgn data BE',
      expectedStatus: 'Sukses - cards cukup', expectedResponse: 'Post links >= 2 (kartu minimal 3)',
      specTitle: 'top posts memiliki minimal 3 post cards',
      assertions: 'postLinks count >= 2',
      source: 'Hardcoded di spec', notes: '—',
    },    {
      id: 'TC-UI-C25', name: 'Top hashtags terrender dari data API', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API aktif',
      expectedStatus: 'Sukses — hashtag tampil', expectedResponse: 'Minimal salah satu hashtag (#SIPIndonesia atau #SuaraWarga) visible',
      specTitle: 'top hashtags terrender',
      assertions: 'getByText("#SIPIndonesia") atau getByText("#SuaraWarga") visible',
      source: 'top-engagement.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C26', name: 'Top Engagement full-screen tanpa navbar utama', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman',
      expectedStatus: 'Sukses — full-screen', expectedResponse: 'Navbar utama tidak tampil',
      specTitle: 'display wall tidak memiliki navbar utama (full-screen mode)',
      assertions: 'nav link "Dashboard" tidak visible',
      source: 'top-engagement.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C27', name: 'Top Engagement menggunakan period=1M sebagai default', category: 'Positive', priority: 'Low',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: 'period=1M', requestBody: '—',
      precondition: 'Mock API aktif',
      expectedStatus: 'Sukses — period benar', expectedResponse: 'Semua request API menggunakan period=1M',
      specTitle: 'display wall menggunakan period=1M sebagai default',
      assertions: 'semua request /v1/dashboard/ mengandung period=1M',
      source: 'top-engagement.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C28', name: 'Top posts link membuka di tab baru (target=_blank)', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API aktif',
      expectedStatus: 'Sukses — link target benar', expectedResponse: 'Post links memiliki target="_blank"',
      specTitle: 'top posts link membuka di tab baru (target=_blank)',
      assertions: 'postLinks.first().getAttribute("target") === "_blank"',
      source: 'top-engagement.spec.ts', notes: '—',
    },
    {
      id: 'TC-UI-C29', name: 'Top posts link memiliki rel=noopener (security)', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/display/top-engagement', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API aktif',
      expectedStatus: 'Sukses — rel benar', expectedResponse: 'Post links memiliki rel mengandung "noopener"',
      specTitle: 'top posts link memiliki rel=noopener (security)',
      assertions: 'postLinks.first().getAttribute("rel") contains "noopener"',
      source: 'top-engagement.spec.ts', notes: 'Keamanan: mencegah tabnabbing',
    },

    {
      id: 'TC-UI-C31', name: 'Alert wall threshold indicator "Danger threshold at 60%"', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/control/*-protocol', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka URL wall terkait',
      expectedStatus: 'Sukses - sesuai ekspektasi', expectedResponse: 'Alert wall threshold indicator "Danger threshold at 60%"',
      specTitle: 'alert wall menampilkan threshold indicator dengan label "Danger threshold at 60%"',
      assertions: 'getByText("Danger threshold at 60%") visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-C32', name: 'Danger wall menampilkan status aktif & active since', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/control/*-protocol', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka URL wall terkait',
      expectedStatus: 'Sukses - sesuai ekspektasi', expectedResponse: 'Danger wall menampilkan status aktif & active since',
      specTitle: 'danger wall menampilkan status aktif & active since',
      assertions: 'heading Danger; "Active since" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-C33', name: 'Danger wall konten konsisten dengan alert wall', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/control/*-protocol', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka URL wall terkait',
      expectedStatus: 'Sukses - sesuai ekspektasi', expectedResponse: 'Danger wall konten konsisten dengan alert wall',
      specTitle: 'danger wall memiliki konten yang konsisten dengan alert wall',
      assertions: 'konten danger == konten alert (perbandingan teks)',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-C34', name: 'Green wall heading "Green - Under Control"', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/control/*-protocol', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka URL wall terkait',
      expectedStatus: 'Sukses - sesuai ekspektasi', expectedResponse: 'Green wall heading "Green - Under Control"',
      specTitle: 'green wall menampilkan heading "Green — Under Control"',
      assertions: 'heading exact visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-C35', name: 'Green wall TIDAK menampilkan "Active since" (berbeda alert & danger)', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/control/*-protocol', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka URL wall terkait',
      expectedStatus: 'Sukses - sesuai ekspektasi', expectedResponse: 'Green wall TIDAK menampilkan "Active since" (berbeda alert & danger)',
      specTitle: 'green wall TIDAK menampilkan "Active since" (berbeda dengan alert & danger)',
      assertions: 'getByText("Active since") count 0 pada green wall',
      source: 'Hardcoded di spec', notes: '—',
    },    {
      id: 'TC-UI-C30', name: 'Auto-refresh memutar keyword berikutnya & memuat ulang data tiap interval', category: 'Positive', priority: 'High',
      method: 'Toggle', endpoint: '/display/conversation-overview', headers: '—', params: '3 keyword terpilih; interval 20 detik', requestBody: 'GET chart endpoints?keyword=<keyword berikutnya>',
      precondition: 'Mock selected-keywords 3 item aktif; wall menampilkan keyword pertama',
      expectedStatus: 'Sukses — rotasi & refresh bekerja', expectedResponse: 'Setelah ~20s: request chart untuk "BPJS Kesehatan" terkirim & heading berganti ke keyword berikutnya (label tombol adalah label interval statis)',
      specTitle: 'auto-refresh memutar keyword berikutnya & memuat ulang data tiap interval',
      assertions: 'expect.poll request conversation-trend/emotion-map dgn keyword≠pertama > 0; rotated[0] = BPJS Kesehatan; h1 berganti',
      source: 'conversation-overview.spec.ts', notes: 'Timeout test dinaikkan ke 90s utk menunggu satu siklus interval.',
    },

    {
      id: 'TC-UI-C36', name: 'Setiap wall menampilkan SIP Insight branding', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/control/*-protocol', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka tiap URL wall',
      expectedStatus: 'Sukses - branding konsisten', expectedResponse: 'Link “SIP Insight” visible di setiap wall',
      specTitle: 'setiap wall menampilkan SIP Insight branding',
      assertions: 'tiap wall -> sipInsightLink visible',
      source: 'Hardcoded di spec', notes: '—',
    },  ];
}

function buildUserCases() {
  const filters = loadJson('user-filters.json');
  return [
    {
      id: 'TC-UI-U01', name: 'Halaman user management menampilkan daftar, filter, dan info pagination', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/administration/user', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API user aktif; user membuka /administration/user',
      expectedStatus: 'Sukses — daftar & filter tampil (FR-12)', expectedResponse: 'Heading, tombol "+ Add user", kolom User/Role/Status, info "Showing X-Y of Z users", data tampil',
      specTitle: 'halaman user management menampilkan daftar, filter, dan info pagination',
      assertions: 'filterSection visible; column headers User/Role/Status; showingText /Showing \\d+-\\d+ of \\d+ users/; "Siti Rahma" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U02', name: 'Tombol "+ Add user" membuka modal form user', category: 'Positive', priority: 'High',
      method: 'Modal', endpoint: '/administration/user', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API user aktif; user di halaman user management',
      expectedStatus: 'Sukses — modal form terbuka (FR-13)', expectedResponse: 'Modal form (Username, Name, Password, Role, Status) terbuka',
      specTitle: 'tombol "+ Add user" membuka modal form user',
      assertions: 'click "+ Add user" → #username/#name/#password/#role visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    ...filters.map((d, i) => ({
      id: `TC-UI-U${String(i + 3).padStart(2, '0')}`, name: `Filter role "${d.role}" menampilkan user sesuai role`, category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/administration/user', headers: '—', params: `role=${d.role}`, requestBody: '—',
      precondition: 'Mock API user aktif; user di halaman user management',
      expectedStatus: 'Sukses — filter role bekerja (FR-13)', expectedResponse: `User ber-role ${d.role} tampil; user role lain tidak tampil`,
      specTitle: `filter role "${d.role}" menampilkan user sesuai role`,
      assertions: 'expectUserNameVisible(visibleName, true); getByText(hiddenName, exact) count 0',
      source: 'test-data/user-filters.json', notes: '—',
    })),
    {
      id: `TC-UI-U${String(filters.length + 3).padStart(2, '0')}`, name: 'Pencarian tanpa hasil menampilkan empty state', category: 'Empty State', priority: 'Medium',
      method: 'Filter', endpoint: '/administration/user', headers: '—', params: 'keyword=zzz-tidak-ada', requestBody: '—',
      precondition: 'Mock API user aktif; user di halaman user management',
      expectedStatus: 'Sukses — empty state tampil (FR-14)', expectedResponse: 'Pesan "No users match your search." tampil',
      specTitle: 'pencarian tanpa hasil menampilkan empty state',
      assertions: 'searchUser("zzz-tidak-ada") → getByText("No users match your search.") visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U06', name: '[REGRESI R4] User Super Admin tidak dapat dihapus (guard delete)', category: 'Regression', priority: 'High',
      method: 'Modal', endpoint: '/administration/user', headers: '—', params: 'target=Super Admin (admin — satu-satunya Super Admin)', requestBody: 'DELETE /api/admin/user/:id (HARUS diblokir)',
      precondition: 'Mock API user aktif (1 Super Admin); user di halaman user management',
      expectedStatus: 'Sukses — delete diblokir (TC-SEC)', expectedResponse: 'Tombol Delete Super Admin disabled (atau diklik → tidak ada request DELETE); user tetap tampil',
      specTitle: 'REGRESI R4: user Super Admin tidak dapat dihapus (guard delete)',
      assertions: 'guard: button disabled ATAU klik+confirm → poll DELETE request = 0; "Super Admin" tetap visible',
      source: 'Hardcoded di spec', notes: 'Bug B5: tidak ada proteksi — Super Admin terakhir / akun sendiri bisa dihapus. Test FAIL sampai guard ditambahkan.',
    },
    {
      id: 'TC-UI-U07', name: 'Filter status "Inactive" menampilkan user sesuai status', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/administration/user', headers: '—', params: 'status=Inactive', requestBody: '—',
      precondition: 'Mock API user aktif; user di halaman user management',
      expectedStatus: 'Sukses — filter status bekerja (FR-13)', expectedResponse: 'User ber-status Inactive tampil; user Active tidak tampil',
      specTitle: 'filter status "Inactive" menampilkan user sesuai status',
      assertions: 'selectStatus("Inactive") → "Dewi Lestari" visible; "Siti Rahma" count 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U08', name: 'Pagination next membuka halaman berikutnya', category: 'Positive', priority: 'Medium',
      method: 'Navigate', endpoint: '/administration/user?page=2', headers: '—', params: 'page=1→2 (12 user, size 10)', requestBody: 'GET /api/admin/user?page=2&size=10',
      precondition: 'Mock API user 12 item (size 10) aktif; user di halaman user management',
      expectedStatus: 'Sukses — pindah halaman', expectedResponse: '"Showing 1-10 of 12 users" → klik › → "Showing 11-12 of 12 users"; user hal. 2 tampil',
      specTitle: 'pagination next membuka halaman berikutnya',
      assertions: 'showingText "Showing 1-10 of 12 users"; click paginationNext → showingText "Showing 11-12 of 12 users"; User 11 & 12 visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U09', name: 'Submit "+ Add user" kosong tidak mengirim request (modal tetap terbuka)', category: 'Negative', priority: 'High',
      method: 'Modal', endpoint: '/administration/user', headers: '—', params: 'form kosong', requestBody: '(tidak ada POST)',
      precondition: 'Mock API user aktif; modal Add user terbuka dengan form kosong',
      expectedStatus: 'Validasi menolak submit', expectedResponse: 'Tidak ada POST ke /api/admin/user; modal tetap terbuka',
      specTitle: 'submit "+ Add user" kosong tidak mengirim request (modal tetap terbuka)',
      assertions: 'click Save kosong → dialog visible; expect.poll posts.length = 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U10', name: 'Submit "+ Add user" terisi mengirim POST & menutup modal', category: 'Positive', priority: 'High',
      method: 'Form', endpoint: '/administration/user', headers: '—', params: 'username=qa.automation; name=QA Automation User; password=rahasia123', requestBody: '{ username, name, password, role, status } → POST /api/admin/user',
      precondition: 'Mock POST /api/admin/user 201 aktif; modal Add user terbuka',
      expectedStatus: 'Sukses — 201 & modal tertutup', expectedResponse: 'POST terkirim dengan body sesuai form; modal tertutup setelah sukses',
      specTitle: 'submit "+ Add user" terisi mengirim POST & menutup modal',
      assertions: 'expect.poll POST body length > 0; body.username/name sesuai; dialog count 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U11', name: 'Modal Edit user terbuka dengan data baris terisi', category: 'Positive', priority: 'Medium',
      method: 'Modal', endpoint: '/administration/user', headers: '—', params: 'target=Siti Rahma', requestBody: '—',
      precondition: 'Mock API user aktif; user di halaman user management',
      expectedStatus: 'Sukses — modal prefilled', expectedResponse: 'Heading "Edit user"; #username="siti.rahma"; #name="Siti Rahma"',
      specTitle: 'modal Edit user terbuka dengan data baris terisi',
      assertions: 'editUserButton click → editModal visible; modalUsername toHaveValue siti.rahma; Cancel → modal detached',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U12', name: 'Modal Reset password menampilkan field password & konfirmasi', category: 'Positive', priority: 'Medium',
      method: 'Modal', endpoint: '/administration/user', headers: '—', params: 'target=Siti Rahma', requestBody: '—',
      precondition: 'Mock API user aktif; user di halaman user management',
      expectedStatus: 'Sukses — modal terbuka', expectedResponse: 'Heading "Reset password" dengan field #resetPassword & #resetConfirmPassword',
      specTitle: 'modal Reset password menampilkan field password & konfirmasi',
      assertions: 'resetPasswordButton click → resetPasswordModalHeading + kedua input visible; Cancel → modal detached',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U13', name: 'Modal Delete user menampilkan konfirmasi sebelum penghapusan', category: 'Positive', priority: 'Medium',
      method: 'Modal', endpoint: '/administration/user', headers: '—', params: 'target=Siti Rahma', requestBody: 'DELETE /api/admin/user/:id (dibatalkan)',
      precondition: 'Mock API user aktif; user di halaman user management',
      expectedStatus: 'Sukses — konfirmasi tampil, batal aman', expectedResponse: 'Heading "Delete user" + tombol Delete/Cancel; batal → tanpa request DELETE',
      specTitle: 'modal Delete user menampilkan konfirmasi sebelum penghapusan',
      assertions: 'deleteUserButton click → deleteModalHeading + button Delete visible; Cancel → modal detached; DELETE requests = 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U14', name: 'Submit Edit user mengirim PUT & menutup modal', category: 'Positive', priority: 'High',
      method: 'Form', endpoint: '/administration/user', headers: '—', params: 'target=Siti Rahma; name=Siti Rahma Edit', requestBody: '{ username, name, role, status } → PUT /api/admin/user/:id',
      precondition: 'Mock PUT /api/admin/user/:id 200 aktif; modal Edit user terbuka',
      expectedStatus: 'Sukses — 200 & modal tertutup', expectedResponse: 'PUT terkirim dengan body sesuai form (name diedit); modal tertutup',
      specTitle: 'submit Edit user mengirim PUT & menutup modal',
      assertions: 'expect.poll PUT body > 0; body.username/name sesuai; dialog count 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U15', name: 'Reset password konfirmasi tidak cocok ditolak tanpa mengirim request', category: 'Negative', priority: 'High',
      method: 'Form', endpoint: '/administration/user', headers: '—', params: 'password=passwordBaru123; confirm=beda123', requestBody: '(tidak ada POST)',
      precondition: 'Modal Reset password terbuka dengan konfirmasi berbeda',
      expectedStatus: 'Validasi menolak submit', expectedResponse: 'Pesan "Password confirmation does not match"; modal tetap terbuka; tanpa POST reset-password',
      specTitle: 'Reset password konfirmasi tidak cocok ditolak tanpa mengirim request',
      assertions: 'submit mismatch → pesan mismatch visible; modal visible; poll POST = 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U16', name: 'Submit Reset password valid mengirim POST & menampilkan toast sukses', category: 'Positive', priority: 'High',
      method: 'Form', endpoint: '/administration/user', headers: '—', params: 'password=confirm=passwordBaru123', requestBody: '{ password } → POST /api/admin/user/:id/reset-password',
      precondition: 'Mock POST reset-password 200 aktif; modal Reset password terbuka dengan isian cocok',
      expectedStatus: 'Sukses — 200 & modal tertutup', expectedResponse: 'Toast \'Password for user "siti.rahma" was reset successfully.\'; modal tertutup',
      specTitle: 'submit Reset password valid mengirim POST & menampilkan toast sukses',
      assertions: 'poll POST body.password sesuai; toast sukses visible; dialog count 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U17', name: 'Gagal dari server saat Add user: toast error & modal tetap terbuka', category: 'Negative', priority: 'Medium',
      method: 'Modal', endpoint: '/administration/user', headers: '—', params: 'mock POST 500', requestBody: 'POST /api/admin/user → 500',
      precondition: 'Mock POST gagal (500) aktif; form Add user terisi valid',
      expectedStatus: 'Error ditangani UI', expectedResponse: 'Toast "Failed to add user."; modal tetap terbuka',
      specTitle: 'gagal dari server saat Add user: toast error & modal tetap terbuka',
      assertions: 'submit valid → getByText("Failed to add user.") visible; dialog visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-U18', name: 'Pagination prev & nomor halaman berpindah antar halaman', category: 'Positive', priority: 'Medium',
      method: 'Navigate', endpoint: '/administration/user?page=1|2', headers: '—', params: 'page 2→1→2 (12 user, size 10)', requestBody: 'GET /api/admin/user?page=N&size=10',
      precondition: 'Mock API user 12 item aktif; user di halaman user management',
      expectedStatus: 'Sukses — navigasi halaman lengkap', expectedResponse: 'Next→hal.2, Prev→hal.1, klik nomor 2→hal.2 (info Showing ikut berubah)',
      specTitle: 'pagination prev & nomor halaman berpindah antar halaman',
      assertions: 'next → "Showing 11-12"; prev → "Showing 1-10"; pageNumber(2) → "Showing 11-12"',
      source: 'Hardcoded di spec', notes: '—',
    },
  ];
}

function buildProviderCases() {
  return [
    {
      id: 'TC-UI-PV01', name: 'Halaman provider management menampilkan daftar provider dari API BE', category: 'Positive', priority: 'High',
      method: 'View', endpoint: '/administration/provider', headers: '—', params: 'page=1&size=10', requestBody: 'GET /v1/scrape/credential',
      precondition: 'Mock GET /v1/scrape/credential aktif; user membuka /administration/provider',
      expectedStatus: 'Sukses — daftar provider tampil', expectedResponse: 'Heading "Provider Management", tombol "+ Add provider", kolom Name/Platform/Secret/Enabled/Priority, data mock tampil, info "Showing X-Y of Z provider"',
      specTitle: 'halaman provider management menampilkan daftar provider dari API BE',
      assertions: 'heading visible; columnheaders Name/Platform/Secret/Enabled/Priority; 3 nama mock visible; "Configured" pada baris pertama; showingText visible',
      source: 'Hardcoded di spec', notes: 'Halaman ditemukan saat audit UI live 2026-08-24 — sebelumnya tanpa automation test sama sekali.',
    },
    {
      id: 'TC-UI-PV02', name: 'Filter platform menampilkan provider sesuai platform', category: 'Positive', priority: 'High',
      method: 'Filter', endpoint: '/administration/provider', headers: '—', params: 'platform=tiktok', requestBody: 'GET /v1/scrape/credential?platform=tiktok',
      precondition: 'Mock API provider aktif; user di halaman provider management',
      expectedStatus: 'Sukses — filter platform bekerja', expectedResponse: 'Provider TikTok tampil; provider platform lain tidak tampil',
      specTitle: 'filter platform menampilkan provider sesuai platform',
      assertions: 'selectPlatform("tiktok") → "TikTok Live - Primary" visible; "Instagram Live - Primary" count 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-PV03', name: 'Filter enabled=false hanya menampilkan provider disabled', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/administration/provider', headers: '—', params: 'enabled=false', requestBody: 'GET /v1/scrape/credential?enabled=false',
      precondition: 'Mock API provider aktif; user di halaman provider management',
      expectedStatus: 'Sukses — filter enabled bekerja', expectedResponse: 'Hanya provider disabled (TikTok) yang tampil',
      specTitle: 'filter enabled=false hanya menampilkan provider disabled',
      assertions: 'selectEnabled("false") → TikTok visible; Instagram & TwitterX count 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-PV04', name: 'Pencarian nama memfilter daftar provider', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/administration/provider', headers: '—', params: 'keyword=twitter', requestBody: 'GET /v1/scrape/credential?keyword=twitter',
      precondition: 'Mock API provider aktif; user di halaman provider management',
      expectedStatus: 'Sukses — pencarian bekerja', expectedResponse: 'Provider bernama mengandung "twitter" tampil; lainnya tidak',
      specTitle: 'pencarian nama memfilter daftar provider',
      assertions: 'searchProviders("twitter") → "TwitterX Live - Primary" visible; "Instagram Live - Primary" count 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-PV05', name: 'Reset filter mengembalikan daftar lengkap & nilai default', category: 'Positive', priority: 'Medium',
      method: 'Filter', endpoint: '/administration/provider', headers: '—', params: 'platform=tiktok lalu Reset filter', requestBody: '—',
      precondition: 'Mock API provider aktif; filter platform=tiktok sedang aktif',
      expectedStatus: 'Sukses — filter direset', expectedResponse: '#providerFilterPlatform kembali "all"; seluruh provider tampil kembali',
      specTitle: 'reset filter mengembalikan daftar lengkap & nilai default',
      assertions: 'setelah reset → platformSelect toHaveValue "all"; Instagram & TwitterX visible kembali',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-PV06', name: 'Modal Add provider terbuka dengan field lengkap', category: 'Positive', priority: 'High',
      method: 'Modal', endpoint: '/administration/provider', headers: '—', params: '—', requestBody: '—',
      precondition: 'Mock API provider aktif; user di halaman provider management',
      expectedStatus: 'Sukses — modal terbuka', expectedResponse: 'Modal berisi #name, combobox Platform, #secret, #priority, #reqPerSecond, #reqPerMonth',
      specTitle: 'modal Add provider terbuka dengan field lengkap',
      assertions: 'click "+ Add provider" → keenam field modal visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-PV07', name: 'Validasi form Add provider kosong menampilkan pesan error tanpa mengirim request', category: 'Negative', priority: 'High',
      method: 'Modal', endpoint: '/administration/provider', headers: '—', params: 'form kosong', requestBody: '(tidak ada POST)',
      precondition: 'Modal Add provider terbuka dengan form kosong',
      expectedStatus: 'Validasi menolak submit', expectedResponse: 'Pesan "Name must be at least 2 characters", "Platform is required", "Secret is required"; modal tetap terbuka; tanpa POST',
      specTitle: 'validasi form Add provider kosong menampilkan pesan error tanpa mengirim request',
      assertions: 'submitCreate kosong → 3 pesan validasi visible; modal open; poll POST = 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-PV08', name: 'Submit valid Add provider mengirim POST ke BE & menampilkan toast sukses', category: 'Positive', priority: 'High',
      method: 'Form', endpoint: '/administration/provider', headers: '—', params: 'name=QA Automation Provider; platform=TikTok; secret; priority=7; req/sec=3; req/mo=900', requestBody: '{ name, platform: "tiktok", mode: "live", secret, priority, req_per_second, req_per_month } → POST /v1/scrape/credential',
      precondition: 'Mock POST /v1/scrape/credential 201 aktif; modal Add provider terbuka',
      expectedStatus: 'Sukses — 201 & modal tertutup', expectedResponse: 'Toast \'Provider "…" was added successfully.\'; modal tertutup',
      specTitle: 'submit valid mengirim POST ke BE & menampilkan toast sukses',
      assertions: 'poll POST body > 0; body.name & body.platform sesuai; toast sukses visible; modal count 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-PV09', name: 'Gagal dari server saat simpan provider: modal tetap terbuka tanpa toast sukses', category: 'Negative', priority: 'Medium',
      method: 'Modal', endpoint: '/administration/provider', headers: '—', params: 'mock POST 500', requestBody: 'POST /v1/scrape/credential → 500',
      precondition: 'Mock POST gagal (500) aktif; form Add provider terisi valid',
      expectedStatus: 'Error ditangani UI', expectedResponse: 'Modal tetap terbuka; toast sukses TIDAK muncul',
      specTitle: 'gagal dari server saat simpan: modal tetap terbuka tanpa toast sukses',
      assertions: 'submitCreate → modal open; toast sukses count 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-PV10', name: 'Toggle enable/disable mengirim PATCH ke BE dan mengubah state baris', category: 'Positive', priority: 'High',
      method: 'Toggle', endpoint: '/administration/provider', headers: '—', params: 'target=prv-002 (disabled)', requestBody: 'PATCH /v1/scrape/credential/:id/enable',
      precondition: 'Mock list + toggle aktif (state item ikut berubah); user di halaman provider management',
      expectedStatus: 'Sukses — PATCH terkirim & state berubah', expectedResponse: 'Switch aria-checked false → true setelah klik; PATCH /enable terkirim',
      specTitle: 'toggle enable/disable mengirim PATCH ke BE dan mengubah state baris',
      assertions: 'toggleOf("TikTok…") aria-checked=false; click → poll PATCH > 0; URL mengandung /prv-002/enable; aria-checked=true',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-PV11', name: 'Modal Edit provider terbuka dengan data baris ter-prefill', category: 'Positive', priority: 'Medium',
      method: 'Modal', endpoint: '/administration/provider', headers: '—', params: 'target=baris pertama', requestBody: '—',
      precondition: 'Mock API credential aktif; user di halaman provider management',
      expectedStatus: 'Sukses - modal prefilled', expectedResponse: 'Heading "Edit provider"; #name berisi nama baris; tombol Cancel/Save',
      specTitle: 'modal Edit provider terbuka dengan data baris ter-prefill',
      assertions: 'editButton click -> editModal visible; editNameInput value = nama; Cancel -> count 0',
      source: 'Hardcoded di spec', notes: '—',
    },

  ];
}

function buildProfileCases() {
  return [
    {
      id: 'TC-UI-P01', name: 'Halaman profile menampilkan identitas, role, dan status user', category: 'Positive', priority: 'Medium',
      method: 'View', endpoint: '/profile', headers: '—', params: '—', requestBody: '—',
      precondition: 'User membuka halaman /profile',
      expectedStatus: 'Sukses — identitas tampil', expectedResponse: 'Nama "Admin SIP", @admin, tag "Super Admin" & "Active", tombol "Change password" tampil',
      specTitle: 'halaman profile menampilkan identitas, role, dan status user',
      assertions: 'main: "Admin SIP"/"@admin"/"Super Admin"/"Active" visible; button "Change password" visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-P02', name: 'Modal Change password dapat dibuka', category: 'Positive', priority: 'Low',
      method: 'Modal', endpoint: '/profile', headers: '—', params: '—', requestBody: '—',
      precondition: 'User di halaman /profile',
      expectedStatus: 'Sukses — modal terbuka', expectedResponse: 'Modal dengan field password (current/new/confirm) terbuka',
      specTitle: 'modal Change password dapat dibuka',
      assertions: 'click "Change password" → #currentPassword/#newPassword/#confirmNewPassword visible',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-P03', name: 'Validasi form Change password: kosong, < 6 karakter, dan konfirmasi tidak cocok', category: 'Positive', priority: 'High',
      method: 'Form', endpoint: '/profile', headers: '—', params: '3 skenario invalid + 1 valid', requestBody: '{ currentPassword, newPassword, confirmNewPassword }',
      precondition: 'Mock API change-password 200; modal Change password terbuka',
      expectedStatus: 'Validasi client bekerja lalu submit sukses', expectedResponse: 'Error "Current password is required" (kosong); "Password must be at least 6 characters" (<6); "Password confirmation does not match" (mismatch); submit valid → toast "Password changed successfully." & modal tertutup',
      specTitle: 'validasi form Change password: kosong, < 6 karakter, dan konfirmasi tidak cocok',
      assertions: 'expectModalValidationError x3; toast sukses visible; modal count 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-UI-P04', name: '[REGRESI C7] Change password dengan current password salah harus DITOLAK', category: 'Regression', priority: 'High',
      method: 'Form', endpoint: '/profile', headers: '—', params: 'currentPassword=salahpassword; newPassword=abcdef', requestBody: '{ currentPassword: "salahpassword", newPassword: "abcdef" }',
      precondition: 'User di halaman /profile; modal Change password terbuka; API asli (tanpa mock)',
      expectedStatus: 'Ditolak — modal tetap terbuka', expectedResponse: 'Request ditolak (4xx) → toast error, modal tetap terbuka, tanpa toast sukses',
      specTitle: 'REGRESI C7: change password dengan current password salah harus DITOLAK',
      assertions: 'modalCurrentPassword tetap visible; toast "Password changed successfully." count 0',
      source: 'Hardcoded di spec', notes: 'Bug C7: API hanya cek current tidak kosong (bukan kebenarannya) → 200. Test FAIL sampai API memverifikasi current password. Flake ~10% (failRate API asli).',
    },
    {
      id: 'TC-UI-P05', name: 'Change password dengan current password BENAR → toast sukses & modal tertutup (API asli)', category: 'Positive', priority: 'High',
      method: 'Form', endpoint: '/profile', headers: '—', params: 'currentPassword=password123 (BENAR); newPassword=abcdef', requestBody: '{ currentPassword: "password123", newPassword: "abcdef" }',
      precondition: 'User di halaman /profile; modal Change password terbuka; API asli (tanpa mock)',
      expectedStatus: 'Sukses — 200', expectedResponse: 'Request diterima (200) → toast "Password changed successfully." & modal tertutup',
      specTitle: 'change password dengan current password BENAR → toast sukses & modal tertutup',
      assertions: 'verifikasi server 3x status 200; UI: response 200; toast sukses visible; modal count 0',
      source: 'Hardcoded di spec', notes: 'Pasangan C7: setelah fix memverifikasi current password, password benar (password123, seed admin) harus tetap diterima. Retry UI flow maks 3x untuk failRate 10%.',
    },
  ];
}

// ---------- daftar test case platform BE (tests/be/) ----------
// Sumber: Swagger BE di {BASE_URL_BE}/swagger/ (spec: /swagger/doc.json).
// Status per 2026-08-14: hanya 3 endpoint yang tersisa & aktif —
//   GET /health/live · GET /health/ready · GET /v1/dashboard/summary.
// Endpoint users/tasks/files/provider sudah dihapus dari BE → test &
// test case terkait dihapus (folder tests/be/users|tasks|files|provider).

function buildBeHealthCases() {
  return [
    {
      id: 'TC-BE-H01', name: 'GET /health/live → 200 dengan status live', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: '/health/live', headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{"status":"live"}',
      specTitle: 'GET /health/live → 200 dengan status live',
      assertions: 'res.status() = 200; body.status = "live"',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-H02', name: 'GET /health/ready → 200 dengan status ready', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: '/health/ready', headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{"status":"ready"}',
      specTitle: 'GET /health/ready → 200 dengan status ready',
      assertions: 'res.status() = 200; body.status = "ready"',
      source: 'Hardcoded di spec', notes: '—',
    },
  ];
}

function buildBeDashboardCases() {
  // Data-driven: keyword & ekspektasi dari test-data/be-dashboard-keywords.json
  // (sama pola dengan buildDashboardCases untuk FE).
  const beKeywords = loadJson('be-dashboard-keywords.json');
  // Data-driven: kombinasi keyword x platform (summary & conversation-trend)
  const beCombos = loadJson('be-dashboard-combos.json');
  return [
    {
      id: 'TC-BE-D01', name: 'GET /v1/dashboard/summary mengembalikan 200 dengan struktur data & meta', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; endpoint dashboard summary aktif`,
      expectedStatus: '200 OK', expectedResponse: 'Body punya data (total_post, total_engagement, views, engagement_rate, active_platforms) dan meta.generated_at',
      specTitle: 'GET /v1/dashboard/summary mengembalikan 200 dengan struktur data & meta',
      assertions: 'res.status() = 200; body.data & body.meta ada; semua kartu metrik & generated_at terisi',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D02', name: 'Tiap kartu metrik punya value, label, delta_pct & delta_direction yang valid', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: 'Sama dengan D01',
      expectedStatus: '200 OK', expectedResponse: 'Setiap kartu metrik: value number, label string, delta_pct number, delta_direction ∈ {flat, up, down}',
      specTitle: 'tiap kartu metrik punya value, label, delta_pct & delta_direction yang valid',
      assertions: 'typeof value = number; label string; delta_pct number; delta_direction ∈ [flat, up, down]',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D03', name: 'active_platforms konsisten: active tidak melebihi total', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: 'Sama dengan D01',
      expectedStatus: '200 OK', expectedResponse: 'active ≥ 0 dan total ≥ active',
      specTitle: 'active_platforms konsisten: active tidak melebihi total',
      assertions: 'active >= 0; total >= active',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D04', name: 'meta.generated_at berupa timestamp ISO yang valid', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: 'Sama dengan D01',
      expectedStatus: '200 OK', expectedResponse: 'generated_at dapat di-parse sebagai tanggal valid',
      specTitle: 'meta.generated_at berupa timestamp ISO yang valid',
      assertions: 'new Date(generated_at) bukan NaN',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D05', name: 'Endpoint yang tidak terdaftar di Swagger mengembalikan 404 (bukan hang/500)', category: 'Negative', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/endpoint-belum-ada`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: 'BE lokal berjalan; path tidak terdaftar di Swagger/rute',
      expectedStatus: '404 Not Found', expectedResponse: 'Respons 404 yang wajar (tidak hang / tidak 500)',
      specTitle: 'endpoint yang tidak terdaftar di Swagger mengembalikan 404 (bukan hang/500)',
      assertions: 'res.status() = 404',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D06', name: 'GET /v1/dashboard/summary dengan keyword → 200 & struktur tetap valid', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?keyword=test-keyword`, headers: 'Accept: application/json', params: 'keyword=test-keyword', requestBody: '—',
      precondition: 'Sama dengan D01',
      expectedStatus: '200 OK', expectedResponse: 'Struktur data tetap lengkap (nilai boleh 0 untuk keyword tanpa data)',
      specTitle: 'GET /v1/dashboard/summary dengan keyword → 200 & struktur tetap valid',
      assertions: 'res.status() = 200; kartu metrik & active_platforms & generated_at ada',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D07', name: 'GET /v1/dashboard/summary dengan date_from tidak valid → 200 (diabaikan; Swagger: 400)', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?date_from=abc`, headers: 'Accept: application/json', params: 'date_from=abc', requestBody: '—',
      precondition: 'Sama dengan D01',
      expectedStatus: '200 OK', expectedResponse: 'date_from invalid diabaikan → respons data normal (struktur lengkap)',
      specTitle: 'GET /v1/dashboard/summary dengan date_from tidak valid → 200 (diabaikan; Swagger: 400)',
      assertions: 'res.status() = 200; struktur data & generated_at ada',
      source: 'Hardcoded di spec', notes: 'Mismatch BE vs Swagger: spec 400 invalid_request — implementasi saat ini mengabaikan date_from invalid (200). Perlu sinkronisasi BE/spec.',
    },
    {
      id: 'TC-BE-D08', name: 'GET /v1/dashboard/summary tanpa filter → total_post sesuai jumlah seluruh keyword di data', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; data dashboard sudah terisi (seed 2026-08-13)`,
      expectedStatus: '200 OK', expectedResponse: 'total_post ≥ jumlah post keyword yang terverifikasi (saat ini 18: 9 kebijakan-ekonomi + 9 transformasi-layanan-publik); engagement/views > 0; active_platforms.active > 0',
      specTitle: 'GET /v1/dashboard/summary tanpa filter → total_post sesuai jumlah seluruh keyword di data',
      assertions: 'total_post.value ≥ sum(expectedTotalPosts yang terisi); struktur lengkap; engagement/views > 0; active > 0',
      source: 'test-data/be-dashboard-keywords.json', notes: 'expectedTotalPosts opsional — lengkapi agar assert presisi',
    },
    ...beKeywords.map((d, i) => {
      const suffix = d.expectedTotalPosts !== undefined ? ` & total_post = ${d.expectedTotalPosts}` : '';
      const countText = d.expectedTotalPosts !== undefined ? `total_post = ${d.expectedTotalPosts}` : 'data terisi (total_post > 0)';
      return {
        id: `TC-BE-D${String(i + 9).padStart(2, '0')}`, name: `GET /v1/dashboard/summary?keyword="${d.keyword}" → 200, data terisi${suffix}`, category: 'Positive', priority: 'High',
        method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?keyword=${d.keyword}`, headers: 'Accept: application/json', params: `keyword=${d.keyword}`, requestBody: '—',
        precondition: `BE lokal berjalan di ${BASE_URL_BE}; data keyword "${d.keyword}" sudah terisi`,
        expectedStatus: '200 OK', expectedResponse: `${countText} untuk keyword "${d.keyword}"`,
        specTitle: `GET /v1/dashboard/summary?keyword=${d.keyword} → 200, data terisi${suffix}`,
        assertions: 'res.status() = 200; total_post > 0; active > 0; generated_at ada' + (d.expectedTotalPosts !== undefined ? '; total_post.value = expectedTotalPosts & label sama' : ''),
        source: 'test-data/be-dashboard-keywords.json', notes: d.expectedTotalPosts !== undefined ? '—' : 'expectedTotalPosts belum diisi — test hanya memastikan data terisi; lengkapi setelah diverifikasi',
      };
    }),
    // Endpoint baru (eksplorasi ulang 2026-08-14): conversation-trend &
    // conversation-trend-hourly — lihat tests/be/dashboard/conversation-trend.spec.ts
    {
      id: 'TC-BE-D11', name: 'GET /v1/dashboard/conversation-trend tanpa filter → 200, data terisi & meta.generated_at valid', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; endpoint conversation-trend aktif`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ date, label, volume, engagement }], meta: { generated_at } } — minimal 1 poin, tanggal format YYYY-MM-DD',
      specTitle: 'GET /v1/dashboard/conversation-trend tanpa filter → 200, data terisi & meta.generated_at valid',
      assertions: 'res.status() = 200; data array ≥ 1; tiap poin punya date/label/volume/engagement; generated_at parseable; date regex YYYY-MM-DD',
      source: 'Hardcoded di spec', notes: 'Default period = last 1 month (~30-31 poin harian)',
    },
    {
      id: 'TC-BE-D12', name: 'GET /v1/dashboard/conversation-trend dengan keyword & period=7d → 200, volume sesuai data BE', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?keyword=kebijakan-ekonomi&period=7d`, headers: 'Accept: application/json', params: 'keyword=kebijakan-ekonomi&period=7d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; data keyword kebijakan-ekonomi terisi (9 post)`,
      expectedStatus: '200 OK', expectedResponse: '7-8 poin harian; total volume > 0 (data terisi 2026-08-08 s/d 2026-08-12)',
      specTitle: 'GET /v1/dashboard/conversation-trend dengan keyword & period=7d → 200, volume sesuai data BE',
      assertions: 'res.status() = 200; data.length ∈ [7,8]; sum(volume) > 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D13', name: 'GET /v1/dashboard/conversation-trend dengan period tidak valid → 200 (fallback 1 bulan)', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?period=abc`, headers: 'Accept: application/json', params: 'period=abc', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Malformed period → fallback last 1 month: 28-32 poin harian',
      specTitle: 'GET /v1/dashboard/conversation-trend dengan period tidak valid → 200 (fallback 1 bulan)',
      assertions: 'res.status() = 200; data.length ∈ [28,32]',
      source: 'Hardcoded di spec', notes: 'Perilaku fallback sesuai deskripsi Swagger (malformed → last 1 month)',
    },
    {
      id: 'TC-BE-D14', name: 'GET /v1/dashboard/conversation-trend dengan keyword tanpa data → 200, data tetap valid (volume 0)', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?keyword=keyword-tidak-ada&period=7d`, headers: 'Accept: application/json', params: 'keyword=keyword-tidak-ada&period=7d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Poin harian tetap ada; semua volume = 0 (tidak ada data keyword)',
      specTitle: 'GET /v1/dashboard/conversation-trend dengan keyword tanpa data → 200, data tetap valid (volume 0)',
      assertions: 'res.status() = 200; data.length > 0; tiap poin volume = 0; struktur lengkap',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D15', name: 'GET /v1/dashboard/conversation-trend dengan platform filter → 200, struktur valid', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?platform=x&period=7d`, headers: 'Accept: application/json', params: 'platform=x&period=7d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Data trend tetap terisi dengan struktur poin yang sama',
      specTitle: 'GET /v1/dashboard/conversation-trend dengan platform filter → 200, struktur valid',
      assertions: 'res.status() = 200; data.length > 0; tiap poin punya date/label/volume/engagement',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D16', name: 'GET /v1/dashboard/conversation-trend-hourly dengan date → 200, 24 jam & meta.date cocok', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend-hourly?date=2026-08-14`, headers: 'Accept: application/json', params: 'date=2026-08-14', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; parameter date wajib`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [24 poin { hour, label, volume, engagement }], meta: { generated_at, date } } — meta.date = 2026-08-14',
      specTitle: 'GET /v1/dashboard/conversation-trend-hourly dengan date → 200, 24 jam & meta.date cocok',
      assertions: 'res.status() = 200; data.length = 24; hour regex ^\d{2}$; meta.date cocok; generated_at valid',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D17', name: 'GET /v1/dashboard/conversation-trend-hourly dengan keyword & platform → 200, struktur valid', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend-hourly?keyword=kebijakan-ekonomi&platform=x&date=2026-08-11`, headers: 'Accept: application/json', params: 'keyword=kebijakan-ekonomi&platform=x&date=2026-08-11', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '24 poin per jam dengan struktur { hour, label, volume, engagement }',
      specTitle: 'GET /v1/dashboard/conversation-trend-hourly dengan keyword & platform → 200, struktur valid',
      assertions: 'res.status() = 200; data.length = 24; tiap poin punya hour/label/volume/engagement',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D18', name: 'GET /v1/dashboard/conversation-trend-hourly tanpa date → 400 invalid_request', category: 'Negative', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend-hourly`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '400 Bad Request', expectedResponse: '{ error: { code: "invalid_request", message: "date is required ..." } }',
      specTitle: 'GET /v1/dashboard/conversation-trend-hourly tanpa date → 400 invalid_request',
      assertions: 'res.status() = 400; error.code = invalid_request; message mengandung "date is required"',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D19', name: 'GET /v1/dashboard/conversation-trend-hourly dengan date tidak valid → 400 invalid_request', category: 'Negative', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend-hourly?date=abc`, headers: 'Accept: application/json', params: 'date=abc', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '400 Bad Request', expectedResponse: '{ error: { code: "invalid_request", message: "date is required and must be in YYYY-MM-DD format" } }',
      specTitle: 'GET /v1/dashboard/conversation-trend-hourly dengan date tidak valid → 400 invalid_request',
      assertions: 'res.status() = 400; error.code = invalid_request; message mengandung "YYYY-MM-DD"',
      source: 'Hardcoded di spec', notes: '—',
    },
    // Endpoint terbaru (eksplorasi ulang 2026-08-18): top-accounts, top-hashtags,
    // top-posts, topic-intelligence & topic-intelligence-detail — lihat
    // tests/be/dashboard/top.spec.ts & topic.spec.ts
    {
      id: 'TC-BE-D20', name: 'top-accounts tanpa filter → 200 & struktur lengkap', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-accounts`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; endpoint top-accounts aktif`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, handle, platform, posts }], meta: { generated_at } } — id = handle; posts >= 1',
      specTitle: 'top-accounts tanpa filter → 200 & struktur lengkap',
      assertions: 'res.status() = 200; data array; tiap item: id/handle/platform terisi, handle = id, posts >= 1',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D21', name: 'top-accounts diurutkan posts desc & maks 5', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-accounts`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Maksimal 5 akun, diurutkan posts menurun (ties boleh sama)',
      specTitle: 'top-accounts diurutkan posts desc & maks 5',
      assertions: 'res.status() = 200; data.length <= 5; posts[i] <= posts[i-1]',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D22', name: 'top-accounts filter platform=tiktok → 200 & semua TikTok', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-accounts?platform=tiktok`, headers: 'Accept: application/json', params: 'platform=tiktok', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Semua item platform = "TikTok" (display name)',
      specTitle: 'top-accounts filter platform=tiktok → 200 & semua TikTok',
      assertions: 'res.status() = 200; data.length > 0; tiap item platform = TikTok',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D23', name: 'top-accounts filter keyword → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-accounts?keyword=kebijakan-ekonomi`, headers: 'Accept: application/json', params: 'keyword=kebijakan-ekonomi', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; data keyword kebijakan-ekonomi terisi`,
      expectedStatus: '200 OK', expectedResponse: 'Data array tetap valid',
      specTitle: 'top-accounts filter keyword → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D24', name: 'top-hashtags tanpa filter → 200 & tag berformat #', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-hashtags`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; endpoint top-hashtags aktif`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, tag, count }], meta: { generated_at } } — tag dimulai "#"; count >= 1',
      specTitle: 'top-hashtags tanpa filter → 200 & tag berformat #',
      assertions: 'res.status() = 200; data array; tiap item: tag.startsWith("#"), count >= 1, id terisi',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D25', name: 'top-hashtags diurutkan count desc & maks 5', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-hashtags`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Maksimal 5 hashtag, diurutkan count menurun (ties boleh sama)',
      specTitle: 'top-hashtags diurutkan count desc & maks 5',
      assertions: 'res.status() = 200; data.length <= 5; count[i] <= count[i-1]',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D26', name: 'top-hashtags filter keyword → 200 & tag konsisten', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-hashtags?keyword=kebijakan-ekonomi`, headers: 'Accept: application/json', params: 'keyword=kebijakan-ekonomi', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; data keyword kebijakan-ekonomi terisi`,
      expectedStatus: '200 OK', expectedResponse: 'Data terisi; tiap tag berformat "#" & count >= 1',
      specTitle: 'top-hashtags filter keyword → 200 & tag konsisten',
      assertions: 'res.status() = 200; data.length > 0; tag.startsWith("#"); count >= 1',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D27', name: 'top-hashtags filter platform → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-hashtags?platform=instagram`, headers: 'Accept: application/json', params: 'platform=instagram', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Data array tetap valid',
      specTitle: 'top-hashtags filter platform → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D28', name: 'top-posts tanpa filter → 200 & struktur lengkap', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; endpoint top-posts aktif`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, platform, post, emotion, topic, engagement }], meta: { generated_at } } — engagement >= 1',
      specTitle: 'top-posts tanpa filter → 200 & struktur lengkap',
      assertions: 'res.status() = 200; data array; tiap item: id/platform terisi, post.length > 0, engagement >= 1',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D29', name: 'top-posts diurutkan engagement desc & maks 5', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Maksimal 5 post, diurutkan engagement menurun (ties boleh sama)',
      specTitle: 'top-posts diurutkan engagement desc & maks 5',
      assertions: 'res.status() = 200; data.length <= 5; engagement[i] <= engagement[i-1]',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D30', name: 'top-posts filter keyword+platform → 200 & semua platform sesuai', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts?keyword=kebijakan-ekonomi&platform=x`, headers: 'Accept: application/json', params: 'keyword=kebijakan-ekonomi&platform=x', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; data keyword kebijakan-ekonomi di platform X terisi`,
      expectedStatus: '200 OK', expectedResponse: '1-5 post, semua platform = "X"',
      specTitle: 'top-posts filter keyword+platform → 200 & semua platform sesuai',
      assertions: 'res.status() = 200; data.length ∈ [1,5]; tiap item platform = X',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D31', name: 'top-posts filter platform → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts?platform=tiktok`, headers: 'Accept: application/json', params: 'platform=tiktok', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '1-5 post, semua platform = "TikTok"',
      specTitle: 'top-posts filter platform → 200',
      assertions: 'res.status() = 200; data.length ∈ [1,5]; tiap item platform = TikTok',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D32', name: 'topic-intelligence tanpa filter → 200 & distribusi topic', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; endpoint topic-intelligence aktif`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, label, pct, count }], meta: { generated_at } } — id = label; pct ∈ [0,100]; count >= 1',
      specTitle: 'topic-intelligence tanpa filter → 200 & distribusi topic',
      assertions: 'res.status() = 200; data.length >= 1; id = label; 0 <= pct <= 100; count >= 1',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D33', name: 'topic-intelligence pct konsisten (rumus share dari count)', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'pct = round(count / total * 100) untuk tiap topic',
      specTitle: 'topic-intelligence pct konsisten (rumus share dari count)',
      assertions: 'res.status() = 200; pct[i] = Math.round(count[i] / total * 100)',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D34', name: 'topic-intelligence filter platform → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence?platform=x`, headers: 'Accept: application/json', params: 'platform=x', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Data array tetap valid',
      specTitle: 'topic-intelligence filter platform → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D35', name: 'topic-intelligence filter keyword → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence?keyword=kebijakan-ekonomi`, headers: 'Accept: application/json', params: 'keyword=kebijakan-ekonomi', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; data keyword kebijakan-ekonomi terisi`,
      expectedStatus: '200 OK', expectedResponse: 'Data array tetap valid',
      specTitle: 'topic-intelligence filter keyword → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D36', name: 'topic-intelligence period=7d → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence?period=7d`, headers: 'Accept: application/json', params: 'period=7d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Data array tetap valid',
      specTitle: 'topic-intelligence period=7d → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D37', name: 'topic-intelligence platform multi (comma-separated) → 200', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence?platform=instagram,x`, headers: 'Accept: application/json', params: 'platform=instagram,x', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Data array tetap valid',
      specTitle: 'topic-intelligence platform multi (comma-separated) → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D38', name: 'topic-intelligence period tidak valid → 200 (fallback 1m)', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence?period=xyz`, headers: 'Accept: application/json', params: 'period=xyz', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Period malformed → fallback 1 bulan (tetap 200)',
      specTitle: 'topic-intelligence period tidak valid → 200 (fallback 1m)',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: 'Perilaku fallback sama dengan conversation-trend',
    },
    {
      id: 'TC-BE-D39', name: 'topic-intelligence-detail tanpa topic → 400 (validasi)', category: 'Negative', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; parameter topic wajib`,
      expectedStatus: '400 Bad Request', expectedResponse: '{ error: { code: "invalid_request", message: "topic is required" } }',
      specTitle: 'topic-intelligence-detail tanpa topic → 400 (validasi)',
      assertions: 'res.status() = 400; error.code = invalid_request; message = "topic is required"',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D40', name: 'topic-intelligence-detail topic tidak dikenal → 404', category: 'Negative', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=TopicTidakAda`, headers: 'Accept: application/json', params: 'topic=TopicTidakAda', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '404 Not Found', expectedResponse: '{ error: { code: "not_found", message: "topic not found" } }',
      specTitle: 'topic-intelligence-detail topic tidak dikenal → 404',
      assertions: 'res.status() = 404; error.code = not_found; message = "topic not found"',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D41', name: 'topic-intelligence-detail topic valid → 200 & struktur lengkap', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi`, headers: 'Accept: application/json', params: 'topic=Ekonomi', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; topic Ekonomi ada di seed`,
      expectedStatus: '200 OK', expectedResponse: '{ data: { topic, stats, posts }, meta: { generated_at, page, size, total, totalPages } } — default page=1, size=6; total = stats.totalPost',
      specTitle: 'topic-intelligence-detail topic valid → 200 & struktur lengkap',
      assertions: 'res.status() = 200; topic.id = label = Ekonomi; stats.totalPost >= 1; meta.page=1, size=6, total = stats.totalPost, totalPages >= 1',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D42', name: 'topic-intelligence-detail keyword cocok → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&keyword=kebijakan-ekonomi`, headers: 'Accept: application/json', params: 'topic=Ekonomi&keyword=kebijakan-ekonomi', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'stats.totalPost >= 1 (data keyword cocok dengan topic)',
      specTitle: 'topic-intelligence-detail keyword cocok → 200',
      assertions: 'res.status() = 200; stats.totalPost >= 1',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D43', name: 'topic-intelligence-detail keyword tidak cocok → 404', category: 'Negative', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&keyword=transformasi-layanan-publik`, headers: 'Accept: application/json', params: 'topic=Ekonomi&keyword=transformasi-layanan-publik', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '404 Not Found', expectedResponse: '{ error: { code: "not_found", message: "topic not found" } } — scope keyword kosong dianggap tidak ada',
      specTitle: 'topic-intelligence-detail keyword tidak cocok → 404',
      assertions: 'res.status() = 404; error.code = not_found',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D44', name: 'topic-intelligence-detail search → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&search=kebijakan`, headers: 'Accept: application/json', params: 'topic=Ekonomi&search=kebijakan', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; post topic Ekonomi memuat kata kebijakan`,
      expectedStatus: '200 OK', expectedResponse: 'meta.total >= 1 (post cocok dengan search)',
      specTitle: 'topic-intelligence-detail search → 200',
      assertions: 'res.status() = 200; meta.total >= 1',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D45', name: 'topic-intelligence-detail search tidak cocok → 200 (quirk: total 0, bukan 404)', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&search=tidakada`, headers: 'Accept: application/json', params: 'topic=Ekonomi&search=tidakada', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'meta.total = 0; posts kosong; stats tetap scope penuh (totalPost >= 1)',
      specTitle: 'topic-intelligence-detail search tidak cocok → 200 (quirk: total 0, bukan 404)',
      assertions: 'res.status() = 200; meta.total = 0; posts.length = 0; stats.totalPost >= 1',
      source: 'Hardcoded di spec', notes: 'Quirk: search hanya memfilter daftar posts, bukan stats — kontrak dokumentasi',
    },
    {
      id: 'TC-BE-D46', name: 'topic-intelligence-detail sentiment (stats tetap scope penuh) → 200', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&sentiment=Negatif`, headers: 'Accept: application/json', params: 'topic=Ekonomi&sentiment=Negatif', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'stats.totalPost >= 1 (stats mengabaikan filter sentiment); posts array valid',
      specTitle: 'topic-intelligence-detail sentiment (stats tetap scope penuh) → 200',
      assertions: 'res.status() = 200; stats.totalPost >= 1; posts array',
      source: 'Hardcoded di spec', notes: 'Quirk: stats.totalPost MENGABAIKAN filter search/sentiment/emotion — hanya keyword/topic/platform/period',
    },
    {
      id: 'TC-BE-D47', name: 'topic-intelligence-detail sentiment=Positif → 200 & total >= 1', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&sentiment=Positif`, headers: 'Accept: application/json', params: 'topic=Ekonomi&sentiment=Positif', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; post topic Ekonomi ber-sentiment Positif`,
      expectedStatus: '200 OK', expectedResponse: 'meta.total >= 1',
      specTitle: 'topic-intelligence-detail sentiment=Positif → 200 & total >= 1',
      assertions: 'res.status() = 200; meta.total >= 1',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D48', name: 'topic-intelligence-detail emotion → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&emotion=Joy`, headers: 'Accept: application/json', params: 'topic=Ekonomi&emotion=Joy', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; post topic Ekonomi ber-emotion Joy`,
      expectedStatus: '200 OK', expectedResponse: 'meta.total >= 1',
      specTitle: 'topic-intelligence-detail emotion → 200',
      assertions: 'res.status() = 200; meta.total >= 1',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D49', name: 'topic-intelligence-detail emotion tidak cocok → 200 (quirk: posts kosong)', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&emotion=Anger`, headers: 'Accept: application/json', params: 'topic=Ekonomi&emotion=Anger', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'stats.totalPost >= 1 (stats scope penuh); posts array valid',
      specTitle: 'topic-intelligence-detail emotion tidak cocok → 200 (quirk: posts kosong)',
      assertions: 'res.status() = 200; stats.totalPost >= 1; posts array',
      source: 'Hardcoded di spec', notes: 'Quirk sama dengan sentiment/search — lihat D45/D46',
    },
    {
      id: 'TC-BE-D50', name: 'topic-intelligence-detail pagination page besar di-clamp', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&page=999`, headers: 'Accept: application/json', params: 'topic=Ekonomi&page=999', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'meta.page di-clamp ke [1, totalPages]',
      specTitle: 'topic-intelligence-detail pagination page besar di-clamp',
      assertions: 'res.status() = 200; 1 <= meta.page <= meta.totalPages',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D51', name: 'topic-intelligence-detail page=0 fallback ke 1', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&page=0`, headers: 'Accept: application/json', params: 'topic=Ekonomi&page=0', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'meta.page = 1',
      specTitle: 'topic-intelligence-detail page=0 fallback ke 1',
      assertions: 'res.status() = 200; meta.page = 1',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D52', name: 'topic-intelligence-detail page tidak valid fallback ke 1', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&page=abc`, headers: 'Accept: application/json', params: 'topic=Ekonomi&page=abc', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'meta.page = 1',
      specTitle: 'topic-intelligence-detail page tidak valid fallback ke 1',
      assertions: 'res.status() = 200; meta.page = 1',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D53', name: 'topic-intelligence-detail size besar di-clamp ke 50', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&size=999`, headers: 'Accept: application/json', params: 'topic=Ekonomi&size=999', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'meta.size = 50 (clamp maksimum)',
      specTitle: 'topic-intelligence-detail size besar di-clamp ke 50',
      assertions: 'res.status() = 200; meta.size = 50',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D54', name: 'topic-intelligence-detail size=0 fallback ke 6', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&size=0`, headers: 'Accept: application/json', params: 'topic=Ekonomi&size=0', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'meta.size = 6 (defaultPostsPageSize)',
      specTitle: 'topic-intelligence-detail size=0 fallback ke 6',
      assertions: 'res.status() = 200; meta.size = 6',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D55', name: 'topic-intelligence-detail size negatif fallback ke 6', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&size=-5`, headers: 'Accept: application/json', params: 'topic=Ekonomi&size=-5', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'meta.size = 6 (fallback nilai tidak valid)',
      specTitle: 'topic-intelligence-detail size negatif fallback ke 6',
      assertions: 'res.status() = 200; meta.size = 6',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D56', name: 'topic-intelligence-detail size tidak valid fallback ke 6', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence-detail?topic=Ekonomi&size=abc`, headers: 'Accept: application/json', params: 'topic=Ekonomi&size=abc', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'meta.size = 6 (fallback nilai tidak valid)',
      specTitle: 'topic-intelligence-detail size tidak valid fallback ke 6',
      assertions: 'res.status() = 200; meta.size = 6',
      source: 'Hardcoded di spec', notes: '—',
    },
    // Konsolidasi 2026-08-18: case unik
    // summary/trend/hourly di-port ke tests/be project ini — lihat
    // tests/be/dashboard/summary.spec.ts & conversation-trend.spec.ts
    ...beCombos.map((d, i) => ({
      id: `TC-BE-D${String(57 + i).padStart(2, '0')}`, name: `summary keyword "${d.keyword}" platform ${d.platform} → 200 & total_post >= 1`, category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?keyword=${d.keyword}&platform=${d.platform}`, headers: 'Accept: application/json', params: `keyword=${d.keyword}&platform=${d.platform}`, requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; data keyword "${d.keyword}" platform ${d.platform} terisi`,
      expectedStatus: '200 OK', expectedResponse: 'KPI lengkap & total_post >= 1',
      specTitle: `summary keyword "${d.keyword}" platform ${d.platform} → 200 & total_post >= 1`,
      assertions: 'res.status() = 200; KPI lengkap; total_post >= 1',
      source: 'test-data/be-dashboard-combos.json', notes: '—',
    })),
    {
      id: 'TC-BE-D63', name: 'summary period=7d → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?period=7d`, headers: 'Accept: application/json', params: 'period=7d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'KPI lengkap',
      specTitle: 'summary period=7d → 200',
      assertions: 'res.status() = 200; KPI lengkap (4 kartu + active_platforms + generated_at ISO)',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D64', name: 'summary period=3d → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?period=3d`, headers: 'Accept: application/json', params: 'period=3d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'KPI lengkap',
      specTitle: 'summary period=3d → 200',
      assertions: 'res.status() = 200; KPI lengkap',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D65', name: 'summary period=1y → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?period=1y`, headers: 'Accept: application/json', params: 'period=1y', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'KPI lengkap',
      specTitle: 'summary period=1y → 200',
      assertions: 'res.status() = 200; KPI lengkap',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D66', name: 'summary period=2026-08-12 (date tunggal) → 200 & ada data', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?period=2026-08-12`, headers: 'Accept: application/json', params: 'period=2026-08-12', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; seed punya post 2026-08-12`,
      expectedStatus: '200 OK', expectedResponse: 'KPI lengkap & total_post >= 1 (window 1 hari)',
      specTitle: 'summary period=2026-08-12 (date tunggal) → 200 & ada data',
      assertions: 'res.status() = 200; KPI lengkap; total_post >= 1',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D67', name: 'summary period=2026-08-01/2026-08-18 (range) → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?period=2026-08-01/2026-08-18`, headers: 'Accept: application/json', params: 'period=2026-08-01/2026-08-18', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'KPI lengkap & total_post >= 10 (custom range setengah terbuka)',
      specTitle: 'summary period=2026-08-01/2026-08-18 (range) → 200',
      assertions: 'res.status() = 200; KPI lengkap; total_post >= 10',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D68', name: 'summary platform multi (comma-separated) → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?platform=instagram,x`, headers: 'Accept: application/json', params: 'platform=instagram,x', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'KPI lengkap & total_post >= 10',
      specTitle: 'summary platform multi (comma-separated) → 200',
      assertions: 'res.status() = 200; KPI lengkap; total_post >= 10',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D69', name: 'summary period tidak valid → 200 (fallback default 1m)', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?period=999d`, headers: 'Accept: application/json', params: 'period=999d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Period malformed → fallback 1m (tetap 200, bukan 400)',
      specTitle: 'summary period tidak valid → 200 (fallback default 1m)',
      assertions: 'res.status() = 200; KPI lengkap',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D70', name: 'summary platform tidak dikenal → 200 (lenient, tanpa error)', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?platform=facebook`, headers: 'Accept: application/json', params: 'platform=facebook', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Platform tidak divalidasi → 200 dengan nilai nol',
      specTitle: 'summary platform tidak dikenal → 200 (lenient, tanpa error)',
      assertions: 'res.status() = 200; KPI lengkap',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D71', name: 'summary keyword tanpa data → 200 dengan nilai nol (bukan 404)', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary?keyword=query_tidak_ada`, headers: 'Accept: application/json', params: 'keyword=query_tidak_ada', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'total_post = 0 (beda dari mock service lama yang 404)',
      specTitle: 'summary keyword tanpa data → 200 dengan nilai nol (bukan 404)',
      assertions: 'res.status() = 200; total_post.value = 0',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D72', name: 'summary format label KPI konsisten (value ↔ label)', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/summary`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'label total_post integer thousand-grouped; views count/K/M; engagement_rate persen 2 desimal; delta_direction ∈ up/down/flat',
      specTitle: 'summary format label KPI konsisten (value ↔ label)',
      assertions: 'res.status() = 200; regex label tiap kartu; delta_direction valid; delta_pct number',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    ...beCombos.map((d, i) => ({
      id: `TC-BE-D${String(73 + i).padStart(2, '0')}`, name: `conversation-trend keyword "${d.keyword}" platform ${d.platform} → 200`, category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?keyword=${d.keyword}&platform=${d.platform}&period=7d`, headers: 'Accept: application/json', params: `keyword=${d.keyword}&platform=${d.platform}&period=7d`, requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; data keyword "${d.keyword}" platform ${d.platform} terisi`,
      expectedStatus: '200 OK', expectedResponse: 'Array point valid (date/label/volume/engagement)',
      specTitle: `conversation-trend keyword "${d.keyword}" platform ${d.platform} → 200`,
      assertions: 'res.status() = 200; data array; tiap point punya date/label/volume/engagement',
      source: 'test-data/be-dashboard-combos.json', notes: '—',
    })),
    {
      id: 'TC-BE-D79', name: 'conversation-trend period=24h → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?period=24h`, headers: 'Accept: application/json', params: 'period=24h', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '1-2 point (kemarin & hari ini)',
      specTitle: 'conversation-trend period=24h → 200',
      assertions: 'res.status() = 200; data.length ∈ [1,2]',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D80', name: 'conversation-trend period=3d → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?period=3d`, headers: 'Accept: application/json', params: 'period=3d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '1-4 point',
      specTitle: 'conversation-trend period=3d → 200',
      assertions: 'res.status() = 200; data.length ∈ [1,4]',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D81', name: 'conversation-trend period=1y → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?period=1y`, headers: 'Accept: application/json', params: 'period=1y', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Deret harian panjang (>= 31 point)',
      specTitle: 'conversation-trend period=1y → 200',
      assertions: 'res.status() = 200; data.length >= 31',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D82', name: 'conversation-trend period=2026-08-12 (date tunggal) → 200 & tepat 1 point', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?period=2026-08-12`, headers: 'Accept: application/json', params: 'period=2026-08-12', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}; seed punya post 2026-08-12`,
      expectedStatus: '200 OK', expectedResponse: 'Tepat 1 point (date = 2026-08-12) dengan volume >= 1',
      specTitle: 'conversation-trend period=2026-08-12 (date tunggal) → 200 & tepat 1 point',
      assertions: 'res.status() = 200; data.length = 1; data[0].date = 2026-08-12; volume >= 1',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D83', name: 'conversation-trend period=2026-08-01/2026-08-18 (range) → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?period=2026-08-01/2026-08-18`, headers: 'Accept: application/json', params: 'period=2026-08-01/2026-08-18', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '>= 15 point valid',
      specTitle: 'conversation-trend period=2026-08-01/2026-08-18 (range) → 200',
      assertions: 'res.status() = 200; data.length >= 15; tiap point valid',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D84', name: 'conversation-trend platform multi (comma-separated) → 200', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?platform=instagram,x`, headers: 'Accept: application/json', params: 'platform=instagram,x', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Data array terisi',
      specTitle: 'conversation-trend platform multi (comma-separated) → 200',
      assertions: 'res.status() = 200; data.length > 0',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D85', name: 'conversation-trend period=24h + keyword → 200', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend?period=24h&keyword=kebijakan-ekonomi`, headers: 'Accept: application/json', params: 'period=24h&keyword=kebijakan-ekonomi', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '1-2 point',
      specTitle: 'conversation-trend period=24h + keyword → 200',
      assertions: 'res.status() = 200; data.length ∈ [1,2]',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D86', name: 'conversation-trend-hourly date=7d (relative token) → 400', category: 'Negative', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend-hourly?date=7d`, headers: 'Accept: application/json', params: 'date=7d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '400 Bad Request', expectedResponse: '{ error: { code: "invalid_request" } } — date wajib tanggal tunggal',
      specTitle: 'conversation-trend-hourly date=7d (relative token) → 400',
      assertions: 'res.status() = 400; error.code = invalid_request',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D87', name: 'conversation-trend-hourly date range → 400', category: 'Negative', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend-hourly?date=2026-08-01/2026-08-02`, headers: 'Accept: application/json', params: 'date=2026-08-01/2026-08-02', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '400 Bad Request', expectedResponse: '{ error: { code: "invalid_request" } } — date range ditolak',
      specTitle: 'conversation-trend-hourly date range → 400',
      assertions: 'res.status() = 400; error.code = invalid_request',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    {
      id: 'TC-BE-D88', name: 'conversation-trend-hourly date tanpa data → 200 & 24 point nol', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/conversation-trend-hourly?date=2026-01-01`, headers: 'Accept: application/json', params: 'date=2026-01-01', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'Tetap 24 point; semua volume & engagement = 0 (zero-filled)',
      specTitle: 'conversation-trend-hourly date tanpa data → 200 & 24 point nol',
      assertions: 'res.status() = 200; data.length = 24; tiap point volume = 0 & engagement = 0',
      source: 'Hardcoded di spec', notes: 'Port dari eksplorasi BE 2026-08-18',
    },
    // Ex-GAP: endpoint sebelumnya 404 (audit FE-BE 2026-08-18), kini sudah diimplementasikan di Go (2026-08-20).
    // Lihat tests/be/dashboard/missing-endpoints.spec.ts — regression guard untuk kontrak FE.
    {
      id: 'TC-BE-D89', name: 'GET /v1/dashboard/trending-topic?period=7D → 200, struktur valid', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/trending-topic?period=7D`, headers: 'Accept: application/json', params: 'period=7D', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, topic, volume, delta }], meta: { period, total, generated_at } }',
      specTitle: 'GET /v1/dashboard/trending-topic?period=7D → 200, struktur valid',
      assertions: 'status=200; meta.period=7D; item has id/topic/volume/delta',
      source: 'Hardcoded di spec', notes: 'Ex-GAP: sudah diimplementasikan di Go (sebelumnya 404)',
    },
    {
      id: 'TC-BE-D90', name: 'GET /v1/dashboard/emotion-map → 200, data punya 5 emotion fields', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/emotion-map`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: { anger, neutral, fear, joy, sadness }, meta: { generated_at } }',
      specTitle: 'GET /v1/dashboard/emotion-map → 200, data punya 5 emotion fields',
      assertions: 'status=200; anger/neutral/fear/joy/sadness typeof number',
      source: 'Hardcoded di spec', notes: 'Ex-GAP: sudah diimplementasikan di Go (sebelumnya 404)',
    },
    {
      id: 'TC-BE-D91', name: 'GET /v1/dashboard/sentiment-map → 200, data punya 3 sentiment fields', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/sentiment-map`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: { positive, neutral, negative }, meta: { generated_at } }',
      specTitle: 'GET /v1/dashboard/sentiment-map → 200, data punya 3 sentiment fields',
      assertions: 'status=200; positive/neutral/negative typeof number',
      source: 'Hardcoded di spec', notes: 'Ex-GAP: sudah diimplementasikan di Go (sebelumnya 404)',
    },
    {
      id: 'TC-BE-D92', name: 'GET /v1/dashboard/sentiment-trend → 200, data berupa array of points', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/sentiment-trend`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ date, label, positive, negative }], meta: { generated_at } }',
      specTitle: 'GET /v1/dashboard/sentiment-trend → 200, data berupa array of points',
      assertions: 'status=200; data is array; meta.generated_at exists',
      source: 'Hardcoded di spec', notes: 'Ex-GAP: sudah diimplementasikan di Go (sebelumnya 404)',
    },
    {
      id: 'TC-BE-D93', name: 'GET /v1/dashboard/sentiment-trend-hourly?date=2026-08-20 → 200, 24 points', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/sentiment-trend-hourly?date=2026-08-20`, headers: 'Accept: application/json', params: 'date=2026-08-20', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ hour, label, positive, negative }], meta: { generated_at, date } }',
      specTitle: 'GET /v1/dashboard/sentiment-trend-hourly?date=2026-08-20 → 200, 24 points',
      assertions: 'status=200; data.length=24; meta.date=2026-08-20',
      source: 'Hardcoded di spec', notes: 'Ex-GAP: sudah diimplementasikan di Go (sebelumnya 404)',
    },
    {
      id: 'TC-BE-D94', name: 'top-accounts period=7d → 200 (parameter period di Swagger)', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-accounts?period=7d`, headers: 'Accept: application/json', params: 'period=7d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, handle, platform, posts }], meta: { generated_at } }',
      specTitle: 'top-accounts period=7d → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: 'Coverage parameter period di top-* (sebelumnya belum diuji)',
    },
    {
      id: 'TC-BE-D95', name: 'top-accounts period range (date/date) → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-accounts?period=2026-08-01/2026-08-18`, headers: 'Accept: application/json', params: 'period=2026-08-01/2026-08-18', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, handle, platform, posts }], meta: { generated_at } }',
      specTitle: 'top-accounts period range (date/date) → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D96', name: 'top-accounts platform multi (comma-separated) → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-accounts?platform=instagram,x`, headers: 'Accept: application/json', params: 'platform=instagram,x', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, handle, platform, posts }], meta: { generated_at } }',
      specTitle: 'top-accounts platform multi (comma-separated) → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D97', name: 'top-hashtags period=7d → 200 (parameter period di Swagger)', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-hashtags?period=7d`, headers: 'Accept: application/json', params: 'period=7d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, tag, count }], meta: { generated_at } }',
      specTitle: 'top-hashtags period=7d → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D98', name: 'top-hashtags period range (date/date) → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-hashtags?period=2026-08-01/2026-08-18`, headers: 'Accept: application/json', params: 'period=2026-08-01/2026-08-18', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, tag, count }], meta: { generated_at } }',
      specTitle: 'top-hashtags period range (date/date) → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D99', name: 'top-hashtags platform multi (comma-separated) → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-hashtags?platform=instagram,x`, headers: 'Accept: application/json', params: 'platform=instagram,x', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, tag, count }], meta: { generated_at } }',
      specTitle: 'top-hashtags platform multi (comma-separated) → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D100', name: 'top-posts period=7d → 200 (parameter period di Swagger)', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts?period=7d`, headers: 'Accept: application/json', params: 'period=7d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, platform, post, emotion, topic, engagement }], meta: { generated_at } }',
      specTitle: 'top-posts period=7d → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D101', name: 'top-posts period range (date/date) → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts?period=2026-08-01/2026-08-18`, headers: 'Accept: application/json', params: 'period=2026-08-01/2026-08-18', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, platform, post, emotion, topic, engagement }], meta: { generated_at } }',
      specTitle: 'top-posts period range (date/date) → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D102', name: 'top-posts platform multi (comma-separated) → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts?platform=instagram,x`, headers: 'Accept: application/json', params: 'platform=instagram,x', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, platform, post, emotion, topic, engagement }], meta: { generated_at } }',
      specTitle: 'top-posts platform multi (comma-separated) → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D103', name: 'topic-intelligence period=3d → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence?period=3d`, headers: 'Accept: application/json', params: 'period=3d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, label, count, pct }], meta: { generated_at } }',
      specTitle: 'topic-intelligence period=3d → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: 'Varian period topic-intelligence (sebelumnya hanya 7d)',
    },
    {
      id: 'TC-BE-D104', name: 'topic-intelligence period=1y → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence?period=1y`, headers: 'Accept: application/json', params: 'period=1y', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, label, count, pct }], meta: { generated_at } }',
      specTitle: 'topic-intelligence period=1y → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D105', name: 'topic-intelligence period date tunggal (2026-08-12) → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence?period=2026-08-12`, headers: 'Accept: application/json', params: 'period=2026-08-12', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, label, count, pct }], meta: { generated_at } }',
      specTitle: 'topic-intelligence period date tunggal (2026-08-12) → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D106', name: 'topic-intelligence period range (2026-08-01/2026-08-18) → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/topic-intelligence?period=2026-08-01/2026-08-18`, headers: 'Accept: application/json', params: 'period=2026-08-01/2026-08-18', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, label, count, pct }], meta: { generated_at } }',
      specTitle: 'topic-intelligence period range (2026-08-01/2026-08-18) → 200',
      assertions: 'res.status() = 200; data berupa array',
      source: 'Hardcoded di spec', notes: '—',
    },
    // ---- trending-topic (trending-topic.spec.ts) ----
    {
      id: 'TC-BE-D107', name: 'trending-topic tanpa param period → 200 & fallback ke 24H', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/trending-topic`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [...], meta: { period: "24H", total, generated_at } }',
      specTitle: 'tanpa period → 200 & fallback ke 24H',
      assertions: 'status=200; meta.period = 24H',
      source: 'Hardcoded di spec', notes: 'Endpoint sebelumnya GAP (404), sudah diimplementasikan di Go',
    },
    {
      id: 'TC-BE-D108', name: 'trending-topic period=24H → 200, meta.period = 24H', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/trending-topic?period=24H`, headers: 'Accept: application/json', params: 'period=24H', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [...], meta: { period: "24H", total, generated_at } }',
      specTitle: 'period=24H → 200, meta.period = 24H',
      assertions: 'status=200; meta.period=24H; total matches data length',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D109', name: 'trending-topic period=7D → 200, meta.period = 7D', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/trending-topic?period=7D`, headers: 'Accept: application/json', params: 'period=7D', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [...], meta: { period: "7D", total, generated_at } }',
      specTitle: 'period=7D → 200, meta.period = 7D',
      assertions: 'status=200; meta.period=7D',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D110', name: 'trending-topic period=INVALID → 200 & fallback ke 24H (bukan 400)', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/trending-topic?period=XYZ`, headers: 'Accept: application/json', params: 'period=XYZ', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK (fallback)', expectedResponse: '{ data: [...], meta: { period: "24H" } }',
      specTitle: 'period=INVALID → 200 & fallback ke 24H (bukan 400)',
      assertions: 'status=200; meta.period=24H (silent fallback)',
      source: 'Hardcoded di spec', notes: 'Go tidak menolak period invalid — silent fallback ke default',
    },
    // ---- emotion-map (emotion-map.spec.ts) ----
    {
      id: 'TC-BE-D111', name: 'emotion-map tanpa filter → 200, data punya 5 emotion fields', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/emotion-map`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: { anger, neutral, fear, joy, sadness }, meta: { generated_at } }',
      specTitle: 'tanpa filter → 200, data punya 5 emotion fields',
      assertions: 'status=200; anger/neutral/fear/joy/sadness typeof number',
      source: 'Hardcoded di spec', notes: 'Endpoint sebelumnya GAP (404), sudah diimplementasikan',
    },
    {
      id: 'TC-BE-D112', name: 'emotion-map keyword tanpa data → 200 dengan semua angka 0', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/emotion-map?keyword=keyword_tidak_ada_xyz`, headers: 'Accept: application/json', params: 'keyword=keyword_tidak_ada_xyz', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: { anger:0, neutral:0, fear:0, joy:0, sadness:0 }, meta }',
      specTitle: 'keyword tanpa data → 200 dengan semua angka 0',
      assertions: 'status=200; semua field = 0 (bukan 404)',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D113', name: 'emotion-map period=7d → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/emotion-map?period=7d`, headers: 'Accept: application/json', params: 'period=7d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: { ... }, meta }',
      specTitle: 'filter period=7d → 200',
      assertions: 'status=200; data has emotion fields',
      source: 'Hardcoded di spec', notes: '—',
    },
    // ---- sentiment-map (sentiment-map.spec.ts) ----
    {
      id: 'TC-BE-D114', name: 'sentiment-map tanpa filter → 200, data punya 3 sentiment fields', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/sentiment-map`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: { positive, neutral, negative }, meta: { generated_at } }',
      specTitle: 'tanpa filter → 200, data punya 3 sentiment fields',
      assertions: 'status=200; positive/neutral/negative typeof number',
      source: 'Hardcoded di spec', notes: 'Endpoint sebelumnya GAP (404), sudah diimplementasikan',
    },
    {
      id: 'TC-BE-D115', name: 'sentiment-map keyword tanpa data → 200 dengan semua angka 0', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/sentiment-map?keyword=keyword_tidak_ada_xyz`, headers: 'Accept: application/json', params: 'keyword=keyword_tidak_ada_xyz', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: { positive:0, neutral:0, negative:0 }, meta }',
      specTitle: 'keyword tanpa data → 200 dengan semua angka 0',
      assertions: 'status=200; semua field = 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    // ---- sentiment-trend (sentiment-trend.spec.ts) ----
    {
      id: 'TC-BE-D116', name: 'sentiment-trend tanpa filter → 200, data berupa array of daily points', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/sentiment-trend`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ date, label, positive, negative }], meta: { generated_at } }',
      specTitle: 'tanpa filter → 200, data berupa array of daily points',
      assertions: 'status=200; data is array; meta.generated_at exists',
      source: 'Hardcoded di spec', notes: 'Endpoint sebelumnya GAP (404), sudah diimplementasikan',
    },
    {
      id: 'TC-BE-D117', name: 'sentiment-trend keyword+period=7d → 200', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/sentiment-trend?keyword=layanan-publik&period=7d`, headers: 'Accept: application/json', params: 'keyword=layanan-publik&period=7d', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [...], meta }',
      specTitle: 'filter keyword+period=7d → 200',
      assertions: 'status=200; data is array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D118', name: 'sentiment-trend-hourly date valid → 200, tepat 24 points', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/sentiment-trend-hourly?date=2026-08-20`, headers: 'Accept: application/json', params: 'date=2026-08-20', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ hour, label, positive, negative }], meta: { generated_at, date } }',
      specTitle: 'date valid → 200, tepat 24 points (jam 00-23)',
      assertions: 'status=200; data.length = 24; meta.date = 2026-08-20',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D119', name: 'sentiment-trend-hourly tanpa date → 400 (validasi)', category: 'Negative', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/sentiment-trend-hourly`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '400 Bad Request', expectedResponse: '{ error: { code: "invalid_request", message: "date is required..." } }',
      specTitle: 'tanpa date → 400 (validasi)',
      assertions: 'status=400; error.code = invalid_request',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D120', name: 'sentiment-trend-hourly date invalid → 400', category: 'Negative', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/sentiment-trend-hourly?date=abc`, headers: 'Accept: application/json', params: 'date=abc', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '400 Bad Request', expectedResponse: '{ error: { code: "invalid_request" } }',
      specTitle: 'date tidak valid → 400',
      assertions: 'status=400; error.code = invalid_request',
      source: 'Hardcoded di spec', notes: '—',
    },
    // ---- protocol-status (protocol-status.spec.ts) ----
    {
      id: 'TC-BE-D121', name: 'protocol-status tanpa filter → 200, data punya level, label, description', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/protocol-status`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: { level, label, description, negative_pct, emotion, sentiment, ... }, meta }',
      specTitle: 'tanpa filter → 200, data punya level, label, description',
      assertions: 'status=200; level ∈ [danger, alert, green]; label ∈ [Danger, Alert, Green]; description non-empty',
      source: 'Hardcoded di spec', notes: 'Endpoint baru — protocol wall situation room',
    },
    {
      id: 'TC-BE-D122', name: 'protocol-status level konsisten dengan label', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/protocol-status`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: 'level & label konsisten (danger→Danger, alert→Alert, green→Green)',
      specTitle: 'level konsisten dengan label',
      assertions: 'level=danger → label=Danger; level=alert → label=Alert; level=green → label=Green',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D123', name: 'protocol-status emotion punya 5 field', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/protocol-status`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ emotion: { anger, neutral, fear, joy, sadness } }',
      specTitle: 'emotion punya 5 field: anger, neutral, fear, joy, sadness',
      assertions: 'emotion has 5 numeric fields',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D124', name: 'protocol-status sentiment punya 3 field', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/protocol-status`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ sentiment: { positive, neutral, negative } }',
      specTitle: 'sentiment punya 3 field: positive, neutral, negative',
      assertions: 'sentiment has 3 numeric fields',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D125', name: 'protocol-status period=24h → 200 & period = 24h', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/protocol-status?period=24h`, headers: 'Accept: application/json', params: 'period=24h', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: { period: "24h", ... } }',
      specTitle: 'filter period=24h → 200 & period = 24h',
      assertions: 'status=200; data.period = 24h',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D126', name: 'protocol-status period tidak valid → 200 & fallback ke 24h', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/protocol-status?period=XYZ`, headers: 'Accept: application/json', params: 'period=XYZ', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK (fallback)', expectedResponse: '{ data: { period: "24h", ... } }',
      specTitle: 'period tidak valid → 200 & fallback ke 24h',
      assertions: 'status=200; data.period = 24h',
      source: 'Hardcoded di spec', notes: '—',
    },
    // ---- top-posts-list (top-posts-list.spec.ts) ----
    {
      id: 'TC-BE-D127', name: 'top-posts-list tanpa filter → 200, default page=1 size=10', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts-list`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [...], meta: { generated_at, page:1, size:10, total, totalPages } }',
      specTitle: 'tanpa filter → 200, default page=1 size=10',
      assertions: 'status=200; meta.page=1; meta.size=10; data.length <= 10',
      source: 'Hardcoded di spec', notes: 'Endpoint baru — paginated top posts (View All)',
    },
    {
      id: 'TC-BE-D128', name: 'top-posts-list sort_by=engagement → 200, diurutkan engagement desc', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts-list?sort_by=engagement`, headers: 'Accept: application/json', params: 'sort_by=engagement', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [...], meta } — first item highest engagement',
      specTitle: 'sort_by=engagement → 200, diurutkan engagement desc',
      assertions: 'status=200; data[0].engagement >= data[1].engagement',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D129', name: 'top-posts-list search=ekonomi → 200, semua post mengandung ekonomi', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts-list?search=ekonomi`, headers: 'Accept: application/json', params: 'search=ekonomi', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [post with "ekonomi" in title], meta }',
      specTitle: 'search=ekonomi → 200, semua post mengandung "ekonomi"',
      assertions: 'status=200; data.length > 0; every post.post contains "ekonomi"',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D130', name: 'top-posts-list emotion=Joy → 200, semua item emotion = Joy', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts-list?emotion=Joy`, headers: 'Accept: application/json', params: 'emotion=Joy', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [posts with emotion=Joy], meta }',
      specTitle: 'emotion=Joy → 200, semua item emotion = Joy',
      assertions: 'status=200; every post.emotion = Joy',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D131', name: 'top-posts-list platform filter → 200, semua item dari platform yang sama', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts-list?platform=tiktok`, headers: 'Accept: application/json', params: 'platform=tiktok', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [TikTok posts only], meta }',
      specTitle: 'platform filter → 200, semua item dari platform yang sama',
      assertions: 'status=200; every post.platform = TikTok',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D132', name: 'top-posts-list size=100 (over max) → 200, di-clamp ke 50', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts-list?size=100`, headers: 'Accept: application/json', params: 'size=100', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [...], meta: { size: 50 } }',
      specTitle: 'size=100 (over max) → 200, di-clamp ke 50',
      assertions: 'status=200; meta.size = 50',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D133', name: 'top-posts-list page besar di-clamp ke halaman terakhir', category: 'Positive', priority: 'Low',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-posts-list?page=999`, headers: 'Accept: application/json', params: 'page=999', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [...last page...], meta: { page: totalPages } }',
      specTitle: 'page besar di-clamp ke halaman terakhir (bukan error)',
      assertions: 'status=200; meta.page = meta.totalPages; data.length > 0',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-BE-D134', name: 'top-keywords → 200, kontrak {keyword,count}, urut count desc', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-keywords`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE berjalan di ${BASE_URL_BE}; ada data post`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, keyword, count }...], meta.generated_at }; counts descending',
      specTitle: 'tanpa filter → 200, data terisi & item punya kontrak {id, keyword, count}',
      assertions: 'status=200; data array > 0; item.keyword string; item.count >= 0; urut desc',
      source: 'top-keywords.spec.ts', notes: 'Endpoint sebelumnya belum ada test-nya (ditemukan audit BE 2026-08-24).',
    },
    {
      id: 'TC-BE-D135', name: 'top-keywords konsisten dengan summary (count keyword dikenal = total_post)', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/top-keywords`, headers: 'Accept: application/json', params: 'vs /summary?keyword=', requestBody: '—',
      precondition: `BE berjalan; angka terverifikasi di test-data/be-dashboard-keywords.json`,
      expectedStatus: '200 OK — lintas-endpoint konsisten', expectedResponse: 'Tiap keyword known muncul di top-keywords dengan count == expectedTotalPosts',
      specTitle: 'konsistensi: "<keyword>" muncul dengan count = <n> (sama dgn summary)',
      assertions: 'hit = data.find(keyword) truthy; hit.count = expectedTotalPosts',
      source: 'test-data/be-dashboard-keywords.json', notes: 'Konsistensi antar endpoint dashboard.',
    },
    {
      id: 'TC-BE-D136', name: 'trending-topic-multi-period → 200, kontrak deltas 24h/7d/1mo & satu primary', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BE_API_PREFIX}/dashboard/trending-topic-multi-period`, headers: 'Accept: application/json', params: '— (varian +keyword juga 200)', requestBody: '—',
      precondition: `BE berjalan di ${BASE_URL_BE}`,
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, label, value, pct 0..100, deltas[24h|7d|1mo] dengan up boolean & tepat 1 primary }] }',
      specTitle: 'tiap topik punya delta 24h/7d/1mo dengan flag up boolean & tepat satu primary',
      assertions: 'labels contain 24h/7d/1mo; up boolean; primaries.length = 1 per topik; pct dalam rentang',
      source: 'trending-topic-multi-period.spec.ts', notes: 'Swagger menandai placeholder data → assert struktur saja.',
    },
  ];
}

// ---------- daftar test case scrape service / api-gateway (tests/be/scrape/) ----------
// Service TERPISAH dari dashboard-service (BASE_URL_SCRAPE, default
// http://10.200.101.13:8080). Menjadi tulang punggung fitur Keyword
// Management & Provider Management di FE.
// Write lifecycle valid sengaja TIDAK diuji langsung (tidak ada endpoint
// delete → berisiko mencemari staging); alur sukses ter-cover mock FE.

function buildScrapeCases() {
  return [
    {
      id: 'TC-BE-S01', name: 'GET /health → 200 status ok & service api-gateway', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: '/health', headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `Scrape service berjalan di ${BASE_URL_SCRAPE} (env BASE_URL_SCRAPE)`,
      expectedStatus: '200 OK', expectedResponse: '{ "status": "ok", "service": "api-gateway" }',
      specTitle: '→ 200 dengan status ok & service api-gateway',
      assertions: 'status=200; body.status = "ok"; body.service = "api-gateway"',
      source: 'scrape/health.spec.ts', notes: 'Service ini sebelumnya NOL coverage (ditemukan audit BE 2026-08-24).',
    },
    {
      id: 'TC-BE-S02', name: 'GET /v1/scrape/platform → 200 minimal instagram/tiktok/twitter_x + label', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: '/v1/scrape/platform', headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: 'Scrape service berjalan',
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ platform, platform_name }...], meta } — slug inilah nilai filter platform endpoint lain',
      specTitle: '→ 200 dengan minimal Instagram/TikTok/Twitter-X & nama labelnya',
      assertions: 'slugs contain instagram/tiktok/twitter_x; tiap item platform_name non-kosong',
      source: 'scrape/platform.spec.ts', notes: '—',
    },
    {
      id: 'TC-BE-S03', name: 'GET keyword-management tanpa filter → kontrak meta & item lengkap', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: '/v1/scrape/keyword-management?page=1&size=10', headers: 'Accept: application/json', params: 'page,size', requestBody: '—',
      precondition: 'Scrape service berjalan',
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, keyword, platforms[slug], status ACTIVE|INACTIVE, schedule_enabled }], meta { page,size,total,total_pages,generated_at } }',
      specTitle: 'tanpa filter → 200 dengan kontrak meta pagination & item lengkap',
      assertions: 'meta.page/size/total/total_pages; platforms ⊆ slug resmi; status ∈ ACTIVE|INACTIVE',
      source: 'scrape/keyword-management.spec.ts', notes: '—',
    },
    {
      id: 'TC-BE-S04', name: 'Filter schedule_enabled=true/false hanya mengembalikan tab terkait', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: '/v1/scrape/keyword-management?schedule_enabled=true|false', headers: 'Accept: application/json', params: 'schedule_enabled', requestBody: '—',
      precondition: 'Scrape service berjalan',
      expectedStatus: '200 OK', expectedResponse: 'true → semua item schedule_enabled=true; false → semua false',
      specTitle: 'schedule_enabled=false hanya mengembalikan keyword on-demand',
      assertions: 'setiap item.schedule_enabled sesuai filter (kedua varian dites)',
      source: 'scrape/keyword-management.spec.ts', notes: 'Satu endpoint untuk 2 tab halaman Keyword.',
    },
    {
      id: 'TC-BE-S05', name: 'Filter platform & search pada keyword-management konsisten', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: '/v1/scrape/keyword-management?platform=tiktok | search=ruu', headers: 'Accept: application/json', params: 'platform,search', requestBody: '—',
      precondition: 'Scrape service berjalan',
      expectedStatus: '200 OK', expectedResponse: 'platform=tiktok → semua item mengandung tiktok; search=ruu → semua keyword mengandung "ruu"',
      specTitle: 'filter platform=tiktok → semua item punya platform tiktok',
      assertions: 'dua test: platform filter & search substring match',
      source: 'scrape/keyword-management.spec.ts', notes: '—',
    },
    {
      id: 'TC-BE-S06', name: 'Pagination keyword-management size=1&page=2 diikuti meta', category: 'Positive', priority: 'Medium',
      method: 'GET', endpoint: '/v1/scrape/keyword-management?page=2&size=1', headers: 'Accept: application/json', params: 'page,size', requestBody: '—',
      precondition: 'Scrape service berjalan',
      expectedStatus: '200 OK', expectedResponse: 'data.length <= 1; meta.page=2; meta.size=1',
      specTitle: 'pagination size=1&page=2 → meta mengikuti & data maksimal 1 item',
      assertions: 'data.length <= 1; meta.page = 2; meta.size = 1',
      source: 'scrape/keyword-management.spec.ts', notes: '—',
    },
    {
      id: 'TC-BE-S07', name: 'POST keyword-management body kosong → 400 validation_failed', category: 'Negative', priority: 'High',
      method: 'POST', endpoint: '/v1/scrape/keyword-management', headers: 'Content-Type: application/json', params: '—', requestBody: '{}',
      precondition: 'Scrape service berjalan (aman: tidak membuat data)',
      expectedStatus: '400 Bad Request', expectedResponse: '{ error: { code: "validation_failed", message: "invalid keyword request" } }',
      specTitle: 'POST body kosong → 400 validation_failed (tanpa membuat data)',
      assertions: 'status=400; error.code=validation_failed; message contains "invalid keyword request"',
      source: 'scrape/keyword-management.spec.ts', notes: 'Alur sukses create tidak diuji langsung (tanpa DELETE → tak bisa bersih-bersih).',
    },
    {
      id: 'TC-BE-S08', name: 'GET credential tanpa filter → kontrak item lengkap (snake_case)', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: '/v1/scrape/credential?page=1&size=10', headers: 'Accept: application/json', params: 'page,size', requestBody: '—',
      precondition: 'Scrape service berjalan',
      expectedStatus: '200 OK', expectedResponse: '{ data: [{ id, platform, name, enabled, secret_configured, priority, req_per_second, req_per_month, req_usage_percent }] }',
      specTitle: 'tanpa filter → 200 dengan kontrak item lengkap & meta pagination',
      assertions: 'platform ⊆ slug resmi; enabled/secret_configured boolean; angka >= 0',
      source: 'scrape/credential.spec.ts', notes: '—',
    },
    {
      id: 'TC-BE-S09', name: 'Filter credential platform/enabled/keyword/gabungan konsisten', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: '/v1/scrape/credential?platform=tiktok&enabled=true | keyword=dev', headers: 'Accept: application/json', params: 'platform,enabled,keyword', requestBody: '—',
      precondition: 'Scrape service berjalan',
      expectedStatus: '200 OK', expectedResponse: 'Semua item lolos filter yang diminta (termasuk kombinasi)',
      specTitle: 'filter gabungan platform+enabled konsisten',
      assertions: 'empat test: platform, enabled true/false, gabungan, keyword substring',
      source: 'scrape/credential.spec.ts', notes: '—',
    },
    {
      id: 'TC-BE-S10', name: 'POST credential body kosong → 400 validation_failed', category: 'Negative', priority: 'High',
      method: 'POST', endpoint: '/v1/scrape/credential', headers: 'Content-Type: application/json', params: '—', requestBody: '{}',
      precondition: 'Scrape service berjalan (aman: tidak membuat data)',
      expectedStatus: '400 Bad Request', expectedResponse: '{ error: { code: "validation_failed", message: "invalid credential request" } }',
      specTitle: 'POST body kosong → 400 validation_failed (tanpa membuat data)',
      assertions: 'status=400; error.code=validation_failed',
      source: 'scrape/credential.spec.ts', notes: '—',
    },
    {
      id: 'TC-BE-S11', name: 'PATCH credential/:id/enable|disable toggle round-trip aman', category: 'Positive', priority: 'High',
      method: 'PATCH', endpoint: '/v1/scrape/credential/:id/{enable|disable}', headers: 'Accept: application/json', params: 'id dari GET list', requestBody: '—',
      precondition: 'Minimal 1 provider ada; state akhir HARUS = state awal (finally block)',
      expectedStatus: '200 OK — state flip lalu restore', expectedResponse: 'Setelah PATCH pertama state berubah; setelah PATCH kedua kembali persis seperti awal',
      specTitle: 'toggle round-trip: state berubah lalu dikembalikan ke semula',
      assertions: 'PATCH 200; refetch flipped; finally restore PATCH 200; refetch = original',
      source: 'scrape/credential.spec.ts', notes: 'Satu-satunya mutasi yang aman di staging (reversibel).',
    },
    {
      id: 'TC-BE-S12', name: 'POST /v1/scrape body kosong/tanpa body → 400 bukan 5xx', category: 'Negative', priority: 'High',
      method: 'POST', endpoint: '/v1/scrape', headers: 'Content-Type: application/json', params: '—', requestBody: '{} / (kosong)',
      precondition: 'Scrape service berjalan (aman: job tidak dijalankan)',
      expectedStatus: '400 Bad Request', expectedResponse: '{ error: { code: "validation_failed", message: "platform and keyword are required" } }; payload hilang juga ditolak elegan (4xx)',
      specTitle: 'body kosong → 400 "platform and keyword are required"',
      assertions: 'status=400; message contains required; varian tanpa body tetap < 500',
      source: 'scrape/on-demand.spec.ts', notes: 'Payload VALID sengaja tidak dikirim → akan menjalankan job scraping nyata.',
    },
  ];
}

// ---------- daftar test case platform AI (tests/ai/) ----------
// Sumber: spec OpenAPI SIP AI Service di {BASE_URL_AI}/docs
// (spec JSON: {BASE_URL_AI}/openapi.json). Auth: header X-Service-Token
// (dev lokal: dev-local-service-token). Status 2026-08-14: 5 endpoint aktif.

function buildAiHealthCases() {
  return [
    {
      id: 'TC-AI-H01', name: 'GET /v1/health dengan token valid → 200, status ok & quota tersedia', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BASE_URL_AI}/v1/health`, headers: 'X-Service-Token: <token>', params: '—', requestBody: '—',
      precondition: `AI Service berjalan di ${BASE_URL_AI}; token dev-local-service-token`,
      expectedStatus: '200 OK', expectedResponse: '{ status: "ok", provider_reachable: true, quota_remaining: { production, qa, ... }, analysis_version }',
      specTitle: 'GET /v1/health dengan token valid → 200, status ok & quota tersedia',
      assertions: 'res.status() = 200; status ∈ [ok, degraded, down]; provider_reachable boolean; quota_remaining ada; analysis_version string',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-AI-H02', name: 'GET /v1/health tanpa token → 401', category: 'Negative', priority: 'High',
      method: 'GET', endpoint: `${BASE_URL_AI}/v1/health`, headers: '—', params: '—', requestBody: '—',
      precondition: `AI Service berjalan di ${BASE_URL_AI}`,
      expectedStatus: '401 Unauthorized', expectedResponse: 'Token tidak valid / tidak dikirim',
      specTitle: 'GET /v1/health tanpa token → 401',
      assertions: 'res.status() = 401',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-AI-H03', name: 'GET /v1/health dengan token salah → 401', category: 'Negative', priority: 'Medium',
      method: 'GET', endpoint: `${BASE_URL_AI}/v1/health`, headers: 'X-Service-Token: token-salah', params: '—', requestBody: '—',
      precondition: `AI Service berjalan di ${BASE_URL_AI}`,
      expectedStatus: '401 Unauthorized', expectedResponse: 'Token tidak valid',
      specTitle: 'GET /v1/health dengan token salah → 401',
      assertions: 'res.status() = 401',
      source: 'Hardcoded di spec', notes: '—',
    },
  ];
}

function buildAiMetaCases() {
  return [
    {
      id: 'TC-AI-M01', name: 'GET /v1/meta dengan token valid → 200 & taxonomy lengkap', category: 'Positive', priority: 'High',
      method: 'GET', endpoint: `${BASE_URL_AI}/v1/meta`, headers: 'X-Service-Token: <token>', params: '—', requestBody: '—',
      precondition: `AI Service berjalan di ${BASE_URL_AI}; token valid`,
      expectedStatus: '200 OK', expectedResponse: '{ emotion_labels[], topic_labels[], emotion_label_colors{}, uncertain_threshold, analysis_version }',
      specTitle: 'GET /v1/meta dengan token valid → 200 & taxonomy lengkap',
      assertions: 'emotion_labels & topic_labels array tidak kosong (memuat neutral, ekonomi_bisnis); warna per label ada; uncertain_threshold number',
      source: 'Hardcoded di spec', notes: 'FE & QA memakai /v1/meta sebagai sumber label — jangan hardcode',
    },
    {
      id: 'TC-AI-M02', name: 'GET /v1/meta tanpa token → 401', category: 'Negative', priority: 'Medium',
      method: 'GET', endpoint: `${BASE_URL_AI}/v1/meta`, headers: '—', params: '—', requestBody: '—',
      precondition: `AI Service berjalan di ${BASE_URL_AI}`,
      expectedStatus: '401 Unauthorized', expectedResponse: 'Token tidak valid',
      specTitle: 'GET /v1/meta tanpa token → 401',
      assertions: 'res.status() = 401',
      source: 'Hardcoded di spec', notes: '—',
    },
  ];
}

function buildAiBatchCases() {
  return [
    {
      id: 'TC-AI-B01', name: 'POST /v1/analyze/batch dengan payload valid → 202 queued', category: 'Positive', priority: 'High',
      method: 'POST', endpoint: `${BASE_URL_AI}/v1/analyze/batch`, headers: 'X-Service-Token: <token> · Content-Type: application/json', params: '—', requestBody: '{ batch_id, analysis_request: [{ post_id, text, platform?, created_at? }] }',
      precondition: `AI Service berjalan di ${BASE_URL_AI}; token valid; batch_id unik per run`,
      expectedStatus: '202 Accepted', expectedResponse: '{ job_id, batch_id, status: "queued", total_posts, poll_after_ms }',
      specTitle: 'POST /v1/analyze/batch dengan payload valid → 202 queued',
      assertions: 'res.status() = 202; job_id & batch_id string; status = queued; total_posts = jumlah post; poll_after_ms number',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-AI-B02', name: 'POST /v1/analyze/batch tanpa token → 401', category: 'Negative', priority: 'High',
      method: 'POST', endpoint: `${BASE_URL_AI}/v1/analyze/batch`, headers: 'Content-Type: application/json', params: '—', requestBody: '{ batch_id, analysis_request }',
      precondition: `AI Service berjalan di ${BASE_URL_AI}`,
      expectedStatus: '401 Unauthorized', expectedResponse: 'Token tidak valid',
      specTitle: 'POST /v1/analyze/batch tanpa token → 401',
      assertions: 'res.status() = 401',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-AI-B03', name: 'POST /v1/analyze/batch tanpa analysis_request → 422', category: 'Negative', priority: 'Medium',
      method: 'POST', endpoint: `${BASE_URL_AI}/v1/analyze/batch`, headers: 'X-Service-Token: <token> · Content-Type: application/json', params: '—', requestBody: '{ batch_id }',
      precondition: `AI Service berjalan di ${BASE_URL_AI}; token valid`,
      expectedStatus: '422 Unprocessable Entity', expectedResponse: 'FastAPI validation: detail array berisi loc field yang kurang',
      specTitle: 'POST /v1/analyze/batch tanpa analysis_request → 422',
      assertions: 'res.status() = 422; body.detail array',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-AI-B04', name: 'POST /v1/analyze/batch dengan post tanpa text → 422', category: 'Negative', priority: 'Medium',
      method: 'POST', endpoint: `${BASE_URL_AI}/v1/analyze/batch`, headers: 'X-Service-Token: <token> · Content-Type: application/json', params: '—', requestBody: '{ batch_id, analysis_request: [{ post_id }] }',
      precondition: `AI Service berjalan di ${BASE_URL_AI}; token valid`,
      expectedStatus: '422 Unprocessable Entity', expectedResponse: 'FastAPI validation: field text kurang',
      specTitle: 'POST /v1/analyze/batch dengan post tanpa text → 422',
      assertions: 'res.status() = 422; body.detail array',
      source: 'Hardcoded di spec', notes: '—',
    },
  ];
}

function buildAiJobsCases() {
  return [
    {
      id: 'TC-AI-J01', name: 'Alur batch → poll job sampai completed, hasil sesuai post yang dikirim', category: 'Positive', priority: 'High',
      method: 'POST+GET', endpoint: `${BASE_URL_AI}/v1/analyze/batch → /v1/analyze/jobs/{job_id}`, headers: 'X-Service-Token: <token>', params: '—', requestBody: 'batch: { batch_id, analysis_request: [post] }',
      precondition: `AI Service berjalan di ${BASE_URL_AI}; token valid; provider AI tersedia`,
      expectedStatus: '202 → 200 (completed)', expectedResponse: 'JobResult: status completed/partial, counts.total = 1, results memuat post yang dikirim',
      specTitle: 'alur batch → poll job sampai completed, hasil sesuai post yang dikirim',
      assertions: 'create 202; poll 200 sampai selesai (maks 20x); counts.total = 1; results.find(post_id) ada',
      source: 'Hardcoded di spec', notes: 'Polling hormati poll_after_ms (default 1000ms)',
    },
    {
      id: 'TC-AI-J02', name: 'GET /v1/analyze/jobs/{id} yang tidak ada → 404', category: 'Negative', priority: 'Medium',
      method: 'GET', endpoint: `${BASE_URL_AI}/v1/analyze/jobs/{job_id}`, headers: 'X-Service-Token: <token>', params: 'job_id=id tidak ada', requestBody: '—',
      precondition: `AI Service berjalan di ${BASE_URL_AI}; token valid`,
      expectedStatus: '404 Not Found', expectedResponse: '{ detail: "Job not found or expired" }',
      specTitle: 'GET /v1/analyze/jobs/{id} yang tidak ada → 404',
      assertions: 'res.status() = 404; body.detail string',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-AI-J03', name: 'GET /v1/analyze/jobs/{id} tanpa token → 401', category: 'Negative', priority: 'Medium',
      method: 'GET', endpoint: `${BASE_URL_AI}/v1/analyze/jobs/{job_id}`, headers: '—', params: '—', requestBody: '—',
      precondition: `AI Service berjalan di ${BASE_URL_AI}`,
      expectedStatus: '401 Unauthorized', expectedResponse: 'Token tidak valid',
      specTitle: 'GET /v1/analyze/jobs/{id} tanpa token → 401',
      assertions: 'res.status() = 401',
      source: 'Hardcoded di spec', notes: '—',
    },
  ];
}

function buildAiSyncCases() {
  // Data-driven: post berbagai isu dari test-data/ai-sync-posts.json
  // (pola sama dengan be-dashboard-keywords.json).
  const syncPosts = loadJson('ai-sync-posts.json');
  return [
    {
      id: 'TC-AI-S01', name: 'POST /v1/analyze/sync dengan payload valid → 200 & hasil analisis lengkap', category: 'Positive', priority: 'High',
      method: 'POST', endpoint: `${BASE_URL_AI}/v1/analyze/sync`, headers: 'X-Service-Token: <token> · Content-Type: application/json', params: '—', requestBody: '{ batch_id, analysis_request: [{ post_id, text, platform?, created_at? }] } (maks 10 post)',
      precondition: `AI Service berjalan di ${BASE_URL_AI}; token valid; provider AI tersedia`,
      expectedStatus: '200 OK', expectedResponse: 'JobResult: status completed/partial, counts.total = 1, results: { post_id, status, emotion, emotion_score, topic, topic_score, is_sarcasm }',
      specTitle: 'POST /v1/analyze/sync dengan payload valid → 200 & hasil analisis lengkap',
      assertions: 'res.status() = 200; batch_id cocok; counts.total = 1; result.status = analyzed → emotion/topic string + score number + is_sarcasm boolean; pending → reason (mis. quota_exhausted)',
      source: 'Hardcoded di spec', notes: 'Endpoint blocking, khusus dev & QA (maks 10 post). Status pending = kuota provider habis (kondisi service).',
    },
    ...syncPosts.map((p, i) => {
      const topicText = Array.isArray(p.expectedTopic) ? p.expectedTopic.join(' / ') : (p.expectedTopic || 'valid');
      return {
        id: `TC-AI-S${String(i + 4).padStart(2, '0')}`, name: `Sync post "${p.text.slice(0, 45)}${p.text.length > 45 ? '…' : ''}" → analyzed (topik: ${topicText})`, category: 'Positive', priority: 'High',
        method: 'POST', endpoint: `${BASE_URL_AI}/v1/analyze/sync`, headers: 'X-Service-Token: <token> · Content-Type: application/json', params: '—', requestBody: `{ batch_id, analysis_request: [{ post_id: "${p.post_id}", text: "${p.text}", platform: "${p.platform}", created_at }] }`,
        precondition: `AI Service berjalan di ${BASE_URL_AI}; token valid; provider AI tersedia (kuota cukup)`,
        expectedStatus: '200 OK', expectedResponse: `Post "${p.post_id}" dianalisis → topic "${topicText}" + emotion + skor; bila kuota habis → status pending (quota_exhausted)`,
        specTitle: `sync post "${p.text.slice(0, 48)}${p.text.length > 48 ? '…' : ''}" → analyzed${p.expectedTopic ? ` (topik: ${topicText})` : ''}`,
        assertions: 'res.status() = 200; result.status analyzed → topik cocok expectedTopic (boleh array) & skor valid; pending → reason ada',
        source: 'test-data/ai-sync-posts.json', notes: p.notes || '—',
      };
    }),
    {
      id: `TC-AI-S${String(syncPosts.length + 4).padStart(2, '0')}`, name: 'Sync batch 10 post berbagai isu sekaligus → 200, semua ter-analisis', category: 'Positive', priority: 'High',
      method: 'POST', endpoint: `${BASE_URL_AI}/v1/analyze/sync`, headers: 'X-Service-Token: <token> · Content-Type: application/json', params: '—', requestBody: `{ batch_id, analysis_request: [10 post dari ai-sync-posts.json] }`,
      precondition: `AI Service berjalan di ${BASE_URL_AI}; token valid; provider AI tersedia`,
      expectedStatus: '200 OK', expectedResponse: 'JobResult dengan counts.total = 10 & results.length = 10; analyzed ≥ 5 ATAU semua pending (kuota habis)',
      specTitle: 'sync batch 10 post berbagai isu sekaligus → 200, semua ter-analisis',
      assertions: 'res.status() = 200; total = 10; results.length = 10; analyzed ≥ setengah (bila kuota cukup); tiap analyzed punya topic & topic_score',
      source: 'test-data/ai-sync-posts.json', notes: '—',
    },
    {
      id: `TC-AI-S${String(syncPosts.length + 5).padStart(2, '0')}`, name: 'POST /v1/analyze/sync tanpa token → 401', category: 'Negative', priority: 'High',
      method: 'POST', endpoint: `${BASE_URL_AI}/v1/analyze/sync`, headers: 'Content-Type: application/json', params: '—', requestBody: '{ batch_id, analysis_request }',
      precondition: `AI Service berjalan di ${BASE_URL_AI}`,
      expectedStatus: '401 Unauthorized', expectedResponse: 'Token tidak valid',
      specTitle: 'POST /v1/analyze/sync tanpa token → 401',
      assertions: 'res.status() = 401',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: `TC-AI-S${String(syncPosts.length + 6).padStart(2, '0')}`, name: 'POST /v1/analyze/sync dengan post tanpa text → 422', category: 'Negative', priority: 'Medium',
      method: 'POST', endpoint: `${BASE_URL_AI}/v1/analyze/sync`, headers: 'X-Service-Token: <token> · Content-Type: application/json', params: '—', requestBody: '{ batch_id, analysis_request: [{ post_id }] }',
      precondition: `AI Service berjalan di ${BASE_URL_AI}; token valid`,
      expectedStatus: '422 Unprocessable Entity', expectedResponse: 'FastAPI validation: field text kurang',
      specTitle: 'POST /v1/analyze/sync dengan post tanpa text → 422',
      assertions: 'res.status() = 422; body.detail array',
      source: 'Hardcoded di spec', notes: '—',
    },
  ];
}

function buildAiGenerateCases() {
  return [
    {
      id: 'TC-AI-A01', name: 'Generate laporan insight dari data live BE (dashboard summary)', category: 'Positive', priority: 'High',
      method: 'Generate', endpoint: `${BE_API_PREFIX}/dashboard/summary → test-results/ai/*.md`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: 'Sukses — laporan dibuat', expectedResponse: 'File markdown ter-generate di test-results/ai/ berisi data BE (label metrik, generated_at, active platforms)',
      specTitle: 'generate laporan insight dari data live BE (dashboard summary)',
      assertions: 'GET summary 200; file ada & tidak kosong; berisi label metrik & generated_at dari data BE',
      source: 'Hardcoded di spec', notes: '—',
    },
    {
      id: 'TC-AI-A02', name: 'Generate laporan eksekusi test BE dari results-be.json', category: 'Positive', priority: 'Medium',
      method: 'Generate', endpoint: 'test-results/results-be.json → test-results/ai/*.md', headers: '—', params: '—', requestBody: '—',
      precondition: 'npm run test:be pernah dijalankan (results-be.json ada); bila belum → test di-skip',
      expectedStatus: 'Sukses — laporan dibuat (atau skip)', expectedResponse: 'File laporan eksekusi (total/passed/failed/skipped) ter-generate dari hasil test BE',
      specTitle: 'generate laporan eksekusi test BE dari results-be.json',
      assertions: 'laporan memuat Total, Passed, Failed, Skipped sesuai results-be.json',
      source: 'Hardcoded di spec', notes: 'Skip bila results-be.json belum ada',
    },
    {
      id: 'TC-AI-A03', name: 'Laporan insight memuat header tabel metrik yang konsisten', category: 'Positive', priority: 'Low',
      method: 'Generate', endpoint: `${BE_API_PREFIX}/dashboard/summary → test-results/ai/*.md`, headers: 'Accept: application/json', params: '—', requestBody: '—',
      precondition: `BE lokal berjalan di ${BASE_URL_BE}`,
      expectedStatus: 'Sukses — format tabel konsisten', expectedResponse: 'Header tabel "| Metrik | Nilai | Delta |" ada; jumlah baris tabel = 7 (1 header + 1 separator + 4 metrik + 1 active platforms)',
      specTitle: 'laporan insight memuat header tabel metrik yang konsisten',
      assertions: 'berisi header tabel; jumlah baris dimulai "| " = 7',
      source: 'Hardcoded di spec', notes: '—',
    },
  ];
}

// ---------- definisi platform (FE / BE / AI) ----------
// Setiap platform: folder test, config Playwright, file report JSON, file
// Excel output, daftar modul (sheet), legend & catatan sheet Ringkasan.
const PLATFORM_FE = {
  key: 'fe',
  label: 'FE — Web UI Automation (Playwright)',
  projectName: 'Automation-Dashboard-FE (Playwright Web UI Testing)',
  outFile: path.join(OUT_DIR, 'UI-Test-Cases.xlsx'),
  reportFile: path.join(ROOT, 'test-results', 'results.json'),
  baseUrl: BASE_URL_UI,
  runCmd: 'npm run test:fe',
  runCommands: 'npm run test:fe (semua) · npm run test:smoke · npm run test:login · npm run test:dashboard · npm run test:keyword · npm run test:control · npm run test:user · npm run test:profile',
  reportCmd: 'npm run report:fe',
  modules() {
    return [
      { sheet: 'Smoke', project: 'smoke', accent: 'FF0F3D5C', cases: buildSmokeCases() },
      { sheet: 'Login', project: 'login', accent: 'FF6D28D9', cases: buildLoginCases() },
      { sheet: 'Dashboard', project: 'dashboard', accent: 'FF0284C7', cases: buildDashboardCases() },
      { sheet: 'Keyword', project: 'keyword', accent: 'FF0E7490', cases: buildKeywordCases() },
      { sheet: 'Control', project: 'control', accent: 'FF7C2D12', cases: buildControlCases() },
      { sheet: 'User', project: 'user', accent: 'FF166534', cases: buildUserCases() },
      { sheet: 'Provider', project: 'user', accent: 'FF4D7C0F', cases: buildProviderCases() },
      { sheet: 'Profile', project: 'profile', accent: 'FF9D174D', cases: buildProfileCases() },
    ];
  },
  coverage: () => ({ sheetName: 'Coverage TC-UI', title: 'TC-UI', rows: buildCoverageRows() }),
  legend: [
    ['Kategori Positive', 'Skenario berhasil (navigasi, form valid, filter, data render, modal sukses)'],
    ['Kategori Negative', 'Validasi tidak valid / kegagalan server → ekspektasi error / modal tetap terbuka'],
    ['Kategori Empty State', 'State kosong (belum ada pencarian / tidak ada hasil) sesuai desain'],
    ['Kategori Smoke', 'Pemeriksaan cepat halaman utama & navigasi (API asli, assert elemen stabil)'],
    ['Kategori Responsive', 'Perilaku layout di viewport mobile (hamburger menu, FR-15)'],
    ['Method', 'Jenis interaksi UI utama: Navigate / View / Form / Filter / Modal / Toggle'],
    ['Endpoint', 'Halaman aplikasi yang diuji (path URL)'],
    ['Request Body', 'Input form / payload yang dikirim (data yang diisi user di UI)'],
    ['Hasil Pass', 'Test lolos pada run terakhir — Actual Result: "Sesuai ekspektasi"'],
    ['Hasil Fail', 'Test gagal pada run terakhir — cek detail error di HTML report (npm run report:fe)'],
    ['Hasil — (strip)', 'Test belum dijalankan'],
    ['Environment', 'Lingkungan eksekusi test — bisa di-override via env TEST_ENV (default: Local/Staging dari BASE_URL)'],
    ['Executed By', 'Nama eksekutor test — isi via env TEST_EXECUTED_BY (default: "—")'],
    ['Notes/Bug Link', 'Catatan tambahan / referensi bug (mis. bug aplikasi yang terdokumentasi saat pengujian)'],
    ['Prioritas High', 'Kritis — wajib lolos di setiap test run'],
    ['Prioritas Medium', 'Penting — tetap harus lolos'],
  ],
  notes: [
    ['Sumber data test', 'Data-driven dibaca dari test-data/dashboard-keywords.json, test-data/keyword-filters.json, dan test-data/user-filters.json (baris baru = test baru otomatis)'],
    ['Kolom eksekusi', '"Actual Result", "Status", "Environment", "Executed By", "Tanggal Eksekusi" diisi otomatis: Status/Actual Result dari test-results/results.json; Tanggal dari mtime report; Environment & Executed By dari env'],
    ['Status hasil test', 'Urutan yang benar: npm run test:fe → npm run test-cases:fe. Jalankan ulang keduanya untuk memperbarui kolom eksekusi'],
    ['API simulasi', 'Test fungsional utama memakai mock API (deterministik) karena aplikasi punya random failure; test smoke memakai API asli'],
  ],
};

const PLATFORM_BE = {
  key: 'be',
  label: 'BE — API Backend Testing (Playwright)',
  projectName: 'Automation-Dashboard-FE — API Backend Testing',
  outFile: path.join(OUT_DIR, 'BE-Test-Cases.xlsx'),
  reportFile: path.join(ROOT, 'test-results', 'results-be.json'),
  baseUrl: BASE_URL_BE,
  runCmd: 'npm run test:be',
  runCommands: 'npm run test:be (semua) · filter: npx playwright test -c playwright.be.config.ts tests/be/<folder>',
  reportCmd: 'npm run report:be',
  modules() {
    return [
      { sheet: 'Health', project: 'be', accent: 'FF166534', cases: buildBeHealthCases() },
      { sheet: 'Dashboard', project: 'be', accent: 'FF0284C7', cases: buildBeDashboardCases() },
      { sheet: 'Scrape', project: 'be', accent: 'FFB45309', cases: buildScrapeCases() },
    ];
  },
  coverage: null,
  legend: [
    ['Kategori Positive', 'Skenario sukses: endpoint mengembalikan 200 & struktur respons sesuai harapan'],
    ['Kategori Negative', 'Ekspektasi error: status 404 untuk endpoint yang belum diimplementasikan'],
    ['Method', 'Metode HTTP yang diuji: GET / POST / PUT / PATCH / DELETE'],
    ['Endpoint', `Path API lengkap (prefix ${BE_API_PREFIX}) di base URL ${BASE_URL_BE}`],
    ['Request Body', 'Payload JSON yang dikirim pada request'],
    ['Hasil Pass', 'Test lolos pada run terakhir — Actual Result: "Sesuai ekspektasi"'],
    ['Hasil Fail', 'Test gagal pada run terakhir — cek detail error di HTML report (npm run report:be)'],
    ['Hasil — (strip)', 'Test belum dijalankan'],
    ['Environment', 'Lingkungan eksekusi test — bisa di-override via env TEST_ENV (default: Local/Staging dari BASE_URL_BE)'],
    ['Executed By', 'Nama eksekutor test — isi via env TEST_EXECUTED_BY (default: "—")'],
    ['Notes/Bug Link', 'Catatan tambahan / referensi bug / kendala (mis. Swagger belum aktif)'],
  ],
  notes: [
    ['Sumber kebenaran', 'Struktur respons mengikuti Swagger BE & verifikasi langsung ke BE lokal. Status 2026-08-20: 17 endpoint aktif — health (2) + dashboard (15: summary, conversation-trend, conversation-trend-hourly, top-accounts, top-hashtags, top-posts, top-posts-list, topic-intelligence, topic-intelligence-detail, trending-topic, emotion-map, sentiment-map, sentiment-trend, sentiment-trend-hourly, protocol-status)'],
    ['Kolom eksekusi', '"Actual Result", "Status", "Environment", "Executed By", "Tanggal Eksekusi" diisi otomatis dari test-results/results-be.json'],
    ['Status hasil test', 'Urutan yang benar: npm run test:be → npm run test-cases:be. Jalankan ulang keduanya untuk memperbarui kolom eksekusi'],
    ['Tidak di-test', 'Users/Tasks/Files/Provider tidak ada di Swagger BE → tidak di-test (keputusan 2026-08-18)'],
    ['Endpoint terbaru 2026-08-20', 'trending-topic, emotion-map, sentiment-map, sentiment-trend, sentiment-trend-hourly (ex-GAP, sudah diimplementasikan), protocol-status, top-posts-list (baru) — termasuk pagination, search, emotion filter, protocol wall'],
  ],
};

const PLATFORM_AI = {
  key: 'ai',
  label: 'AI — Generate Hasil dari Data BE',
  projectName: 'Automation-Dashboard-FE — AI (Generate dari Data BE)',
  outFile: path.join(OUT_DIR, 'AI-Test-Cases.xlsx'),
  reportFile: path.join(ROOT, 'test-results', 'results-ai.json'),
  baseUrl: BASE_URL_AI,
  runCmd: 'npm run test:ai',
  runCommands: 'npm run test:ai (semua) · filter: npx playwright test -c playwright.ai.config.ts -g "<judul>"',
  reportCmd: 'npm run report:ai',
  modules() {
    return [
      { sheet: 'Health', project: 'ai', accent: 'FF166534', cases: buildAiHealthCases() },
      { sheet: 'Meta', project: 'ai', accent: 'FF0284C7', cases: buildAiMetaCases() },
      { sheet: 'Analyze Batch', project: 'ai', accent: 'FF6D28D9', cases: buildAiBatchCases() },
      { sheet: 'Analyze Jobs', project: 'ai', accent: 'FF0E7490', cases: buildAiJobsCases() },
      { sheet: 'Analyze Sync', project: 'ai', accent: 'FF7C3AED', cases: buildAiSyncCases() },
      { sheet: 'Generate', project: 'ai', accent: 'FF9D174D', cases: buildAiGenerateCases() },
    ];
  },
  coverage: null,
  legend: [
    ['Kategori Positive', 'Skenario sukses: endpoint AI mengembalikan 200/202 & struktur respons sesuai kontrak'],
    ['Kategori Negative', 'Ekspektasi error: 401 (token), 404 (job tidak ada), 422 (validasi body)'],
    ['Method', 'Metode HTTP yang diuji: GET / POST / polling job'],
    ['Endpoint', `Path API lengkap di base URL ${BASE_URL_AI} (SIP AI Service)`],
    ['Auth', 'Semua endpoint AI wajib header X-Service-Token (dev lokal: dev-local-service-token)'],
    ['Request Body', 'Payload JSON yang dikirim pada request (batch_id + analysis_request)'],
    ['Hasil Pass', 'Test lolos pada run terakhir — Actual Result: "Sesuai ekspektasi"'],
    ['Hasil Fail', 'Test gagal pada run terakhir — cek detail error di HTML report (npm run report:ai)'],
    ['Hasil — (strip)', 'Test belum dijalankan'],
    ['Environment', 'Lingkungan eksekusi test — bisa di-override via env TEST_ENV (default: Local/Staging dari BASE_URL_AI)'],
    ['Executed By', 'Nama eksekutor test — isi via env TEST_EXECUTED_BY (default: "—")'],
    ['Notes/Bug Link', 'Catatan tambahan / referensi bug / kendala'],
  ],
  notes: [
    ['Sumber kebenaran', 'Spec OpenAPI SIP AI Service di {BASE_URL_AI}/docs (spec JSON: /openapi.json) — 5 endpoint, auth X-Service-Token'],
    ['Platform AI ganda', 'AI Service (health/meta/analyze) diuji langsung; sheet Generate tetap memproduksi laporan dari data BE (tests/ai/report.ts)'],
    ['Kolom eksekusi', '"Actual Result", "Status", "Environment", "Executed By", "Tanggal Eksekusi" diisi otomatis dari test-results/results-ai.json'],
    ['Status hasil test', 'Urutan yang benar: npm run test:ai → npm run test-cases:ai. Jalankan ulang keduanya untuk memperbarui kolom eksekusi'],
    ['Lapisan AI lanjutan', 'Provider AI/LLM bisa dicolok di tests/ai/report.ts untuk analisis naratif dari data BE'],
  ],
};

// ---------- coverage TC-UI (Test Plan Sprint 1 §7.5) ----------
// Mapping 12 test case TC-UI (QA-S1-07) ke test otomasi Playwright.
// Data baris di sini DAN di COVERAGE-TC-UI-MAPPING.md harus tetap sinkron
// (md berisi penjelasan & rekomendasi lengkap; sheet ini ringkasannya).
const COV_FULL = 'Ter-cover penuh';
const COV_PARTIAL = 'Ter-cover sebagian';
const COV_NONE = 'Belum ter-cover';

// Hitung statistik coverage sekali, dipakai di sheet, Ringkasan, dan console.
function coverageStats(rows) {
  const penuh = rows.filter((r) => r.status === COV_FULL).length;
  const sebagian = rows.filter((r) => r.status === COV_PARTIAL).length;
  const belum = rows.filter((r) => r.status === COV_NONE).length;
  return {
    penuh,
    sebagian,
    belum,
    pctFull: Math.round((penuh / rows.length) * 100),
    pctFullPart: Math.round(((penuh + sebagian) / rows.length) * 100),
  };
}
function buildCoverageRows() {
  return [
    {
      id: 'TC-UI-001', name: 'Layout dashboard lengkap (filter, KPI, chart emotion/topic, tren, tabel post)', priority: 'High', status: COV_PARTIAL, tests: 'D01 (+ D05)',
      notes: 'Heading, tombol aksi, dan area filter terverifikasi. Kartu KPI, chart emotion/topic, dan tabel post belum di-assert eksplisit → perkuat D01',
    },
    {
      id: 'TC-UI-002', name: 'Filter menolak submit tanpa keyword', priority: 'Highest', status: COV_FULL, tests: 'D03',
      notes: 'Assertion error eksplisit: "Keyword is required."',
    },
    {
      id: 'TC-UI-003', name: 'Filter menolak submit tanpa platform', priority: 'Highest', status: COV_FULL, tests: 'D04',
      notes: 'Assertion error eksplisit: "Select at least one platform."',
    },
    {
      id: 'TC-UI-004', name: 'Pilihan multi-platform berfungsi (1/2/3 chip)', priority: 'High', status: COV_NONE, tests: '—',
      notes: 'Belum ada test toggle chip platform di dashboard + verifikasi payload filter (platform) terkirim',
    },
    {
      id: 'TC-UI-005', name: 'Validasi periode (P-03 terbalik ditolak)', priority: 'High', status: COV_NONE, tests: '— (terkait D07)',
      notes: 'UI periode = preset 24h/7d (D07), bukan date-range bebas — skenario terbalik (P-03) tidak bisa dijalankan; perlu sinkronisasi kontrak test plan ↔ UI',
    },
    {
      id: 'TC-UI-006', name: 'KPI menampilkan N/A untuk metrik tidak tersedia (null ≠ 0)', priority: 'Highest', status: COV_NONE, tests: '—',
      notes: 'KRITIS — prinsip no misleading data (risiko R-01 = 9); butuh mock metrik null (pola SP-11) + assert kartu menampilkan N/A, bukan 0',
    },
    {
      id: 'TC-UI-007', name: 'Format angka besar terbaca (48.2K, 1.24M)', priority: 'Medium', status: COV_NONE, tests: '—',
      notes: 'Butuh mock nilai besar (mis. view_count 1.240.000) + assert format konsisten di seluruh kartu',
    },
    {
      id: 'TC-UI-008', name: 'Loading state terlihat (skeleton)', priority: 'High', status: COV_NONE, tests: '—',
      notes: 'Butuh mock delay 1–2 dtk + assert skeleton/loading tampil lalu digantikan konten',
    },
    {
      id: 'TC-UI-009', name: 'Empty state informatif', priority: 'High', status: COV_FULL, tests: 'D02',
      notes: 'Empty state "No search yet" terverifikasi (mock keyword options kosong)',
    },
    {
      id: 'TC-UI-010', name: 'Error state dan aksi coba lagi (Retry)', priority: 'High', status: COV_NONE, tests: '— (K11 di modal)',
      notes: 'K11 hanya menguji error pada modal Add keyword, bukan dashboard; butuh mock 500 + assert pesan error & tombol Retry berfungsi',
    },
    {
      id: 'TC-UI-011', name: 'Partial failure tidak menyesatkan (satu platform gagal)', priority: 'Highest', status: COV_NONE, tests: '—',
      notes: 'KRITIS — BRD §10 Keandalan (risiko R-05 = 6); butuh mock partial_failed + indikator sumber gagal & data platform lain tetap tampil',
    },
    {
      id: 'TC-UI-012', name: 'Chart & layout pada resolusi disepakati (1920/1440/1366)', priority: 'Medium', status: COV_PARTIAL, tests: 'S08',
      notes: 'Hanya mobile 390×844 (hamburger & navigasi); 1440×900 & 1366×768 + cek console error belum ada',
    },
  ];
}

const COVERAGE_STATUS_FILL = {
  'Ter-cover penuh': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } },
  'Ter-cover sebagian': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } },
  'Belum ter-cover': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } },
};

function fillCoverageSheet(ws, rows) {
  const COLS = 7;
  ws.columns = [
    { width: 6 },   // No
    { width: 14 },  // TC-ID
    { width: 54 },  // Judul
    { width: 10 },  // Prioritas
    { width: 18 },  // Status Coverage
    { width: 40 },  // Test Playwright
    { width: 64 },  // Catatan / Rekomendasi
  ];

  styleTitleRow(ws, 'Coverage — TC-UI (Test Plan Sprint 1 §7.5 / QA-S1-07) ↔ Test Otomasi Playwright', 'FF1F2937', COLS);

  // Baris ringkasan dinamis (dihitung dari data, bukan hardcoded)
  const { penuh, sebagian, belum, pctFull, pctFullPart } = coverageStats(rows);
  const sum = ws.addRow([
    `Ringkasan: ${rows.length} test case TC-UI · ${penuh} ter-cover penuh · ${sebagian} ter-cover sebagian · ${belum} belum ter-cover  →  coverage penuh ${pctFull}%, penuh+sebagian ${pctFullPart}%  ·  sumber: TEST_PLAN_SIP_SPRINT_1.md §7.5  ·  detail & rekomendasi: COVERAGE-TC-UI-MAPPING.md`,
  ]);
  ws.mergeCells(sum.number, 1, sum.number, COLS);
  sum.height = 30;
  sum.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF374151' }, name: 'Calibri' };
  sum.getCell(1).alignment = { vertical: 'middle', wrapText: true };
  sum.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

  styleHeaderRow(ws, [
    'No',
    'TC-ID',
    'Judul Test Case (Test Plan Sprint 1)',
    'Prioritas',
    'Status Coverage',
    'Test Playwright (referensi)',
    'Catatan / Rekomendasi',
  ]);

  rows.forEach((r, idx) => {
    const row = ws.addRow([idx + 1, r.id, r.name, r.priority, r.status, r.tests, r.notes]);
    row.height = 42;
    row.eachCell((cell, col) => {
      cell.border = THIN_BORDER;
      if (idx % 2 === 1) cell.fill = BAND_FILL;
      cell.alignment =
        col === 3 || col === 6 || col === 7
          ? { vertical: 'top', wrapText: true }
          : { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    // badge status coverage (kolom 5)
    const stCell = row.getCell(5);
    stCell.fill = COVERAGE_STATUS_FILL[r.status];
    stCell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    stCell.alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(1).font = { bold: true, name: 'Calibri' };
    row.getCell(2).font = { bold: true, name: 'Calibri' };
    row.getCell(4).font = { bold: true, size: 10, color: { argb: 'FF1F2937' }, name: 'Calibri' };
  });

  ws.views = [{ state: 'frozen', ySplit: 3 }];
  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: rows.length + 3, column: COLS },
  };
  // Dropdown Status Coverage (kolom E) — pilih dari daftar, bukan ketik manual.
  addDropdown(ws, `E4:E${rows.length + 3}`, DROPDOWN_COVERAGE);

  // Warna badge mengikuti nilai sel (conditional formatting).
  addValueFormatting(ws, `E4:E${rows.length + 3}`, Object.entries(COVERAGE_STATUS_FILL), STATUS_FONT);

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

// ---------- styling ----------
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
};
const BAND_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
const CATEGORY_FILL = {
  Positive: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } },
  Negative: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } },
  'Expected-Fail': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }, // amber — sengaja diharapkan gagal
  Gap: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } }, // oranye — endpoint dipanggil FE tapi belum ada di BE
  'Empty State': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
  Smoke: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B7280' } },
  Responsive: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } },
  Regression: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0891B2' } }, // cyan — test regresi bug (FAIL sampai bug diperbaiki)
};
const DEFAULT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B7280' } };
const STATUS_FILL = {
  Pass: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } },
  Fail: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } },
  Skip: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B7280' } },
};
const STATUS_FONT = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };

/**
 * Tambahkan dropdown (data validation) pada range kolom — nilai harus DIPILIH
 * dari daftar, bukan diketik manual (list pendek, di bawah 255 karakter).
 */
function addDropdown(ws, range, options) {
  ws.dataValidations.add(range, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${options.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Pilihan tidak valid',
    error: 'Pilih salah satu nilai dari daftar.',
  });
}

// Opsi dropdown (nilai di kolom harus salah satu dari daftar ini).
const DROPDOWN_KATEGORI = Object.keys(CATEGORY_FILL);
const DROPDOWN_STATUS = ['Pass', 'Fail', 'Skip', '—'];
const DROPDOWN_COVERAGE = Object.keys(COVERAGE_STATUS_FILL);

/**
 * Conditional formatting berbasis NILAI sel — warna badge otomatis mengikuti
 * nilai. Dipakai supaya saat user MENGGANTI nilai lewat dropdown, warna
 * Kategori/Status ikut berubah (Excel mengevaluasi ulang CF secara live;
 * nilai di luar daftar tidak mungkin terpilih karena dibatasi dropdown).
 *
 * Tipe rule dipakai yang paling dasar & universal: `cellIs` / operator
 * `equal` ("Cell Value = ...") — sama persis seperti yang dibuat Excel
 * secara manual, supaya kompatibel maksimal.
 */
function addValueFormatting(ws, range, valueStylePairs, font) {
  ws.addConditionalFormatting({
    ref: range,
    rules: valueStylePairs.map(([value, fill]) => ({
      type: 'cellIs',
      operator: 'equal',
      formulae: [`"${value}"`],
      style: {
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: fill.fgColor,
          bgColor: fill.fgColor,
        },
        font,
      },
    })),
  });
}

// 21 kolom sesuai template test case management
const COLUMNS = 21;
const HEADERS = [
  'No',
  'Test Case ID',
  'Nama Test Case',
  'Kategori',
  'Priority',
  'Method',
  'Endpoint',
  'Headers',
  'Parameter/Query',
  'Request Body',
  'Precondition',
  'Expected Status',
  'Expected Response',
  'Assertions Utama',
  'Sumber Data',
  'Actual Result',
  'Status',
  'Environment',
  'Executed By',
  'Tanggal Eksekusi',
  'Notes/Bug Link',
];
const COLUMN_WIDTHS = [
  6,    // No
  14,   // Test Case ID
  42,   // Nama Test Case
  12,   // Kategori
  9,    // Priority
  10,   // Method
  30,   // Endpoint
  22,   // Headers
  26,   // Parameter/Query
  34,   // Request Body
  32,   // Precondition
  22,   // Expected Status
  40,   // Expected Response
  56,   // Assertions Utama
  24,   // Sumber Data
  26,   // Actual Result
  9,    // Status
  12,   // Environment
  14,   // Executed By
  15,   // Tanggal Eksekusi
  28,   // Notes/Bug Link
];

// Kolom yang teksnya di-wrap (kiri-atas) vs di-center
const WRAP_COLS = new Set([3, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 21]);

function styleTitleRow(ws, text, color, cols) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, cols);
  row.height = 28;
  const cell = row.getCell(1);
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  cell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
}

function styleHeaderRow(ws, headers) {
  const row = ws.addRow(headers);
  row.height = 30;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  });
  return row;
}

// Status dari report → nilai kolom "Status" (Pass/Fail/Skip, mengikuti contoh
// template) & "Actual Result".
function statusColumns(status) {
  if (status === 'PASS') return { status: 'Pass', actual: 'Sesuai ekspektasi — semua assertion lolos' };
  if (status === 'FAIL') return { status: 'Fail', actual: 'Tidak sesuai ekspektasi — lihat HTML report (npm run report)' };
  if (status === 'SKIP') return { status: 'Skip', actual: 'Tidak dieksekusi (skip)' };
  return { status: '—', actual: '— (belum dijalankan)' };
}

function fillCaseSheet(ws, cases, accentColor, projectName, statusMap, execDate, env) {
  ws.columns = COLUMN_WIDTHS.map((width) => ({ width }));

  const sheetName = ws.name;
  styleTitleRow(ws, `Test Case — ${sheetName}`, accentColor, COLUMNS);
  styleHeaderRow(ws, HEADERS);

  cases.forEach((c, idx) => {
    const key = `${projectName}::${c.specTitle.toLowerCase()}`;
    const status = statusMap ? statusMap.get(key) || '—' : '—';
    const { status: statusVal, actual: actualVal } = statusColumns(status);

    const row = ws.addRow([
      idx + 1,
      c.id,
      c.name,
      c.category,
      c.priority,
      c.method,
      c.endpoint,
      c.headers,
      c.params,
      c.requestBody,
      c.precondition,
      c.expectedStatus,
      c.expectedResponse,
      c.assertions,
      c.source,
      actualVal,
      statusVal,
      env,
      EXECUTED_BY,
      execDate,
      c.notes,
    ]);
    row.height = 45;
    row.eachCell((cell, col) => {
      cell.border = THIN_BORDER;
      if (idx % 2 === 1) cell.fill = BAND_FILL;
      cell.alignment = WRAP_COLS.has(col)
        ? { vertical: 'top', wrapText: true }
        : { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    // badge kategori (kolom 4)
    const catCell = row.getCell(4);
    catCell.fill = CATEGORY_FILL[c.category] || DEFAULT_FILL;
    catCell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    catCell.alignment = { vertical: 'middle', horizontal: 'center' };
    // badge status (kolom 17)
    const statusCell = row.getCell(17);
    if (statusVal !== '—') {
      statusCell.fill = STATUS_FILL[statusVal];
      statusCell.font = STATUS_FONT;
    } else {
      statusCell.font = { italic: true, size: 10, color: { argb: 'FF9CA3AF' }, name: 'Calibri' };
    }
    statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(1).font = { bold: true, name: 'Calibri' };
    row.getCell(2).font = { bold: true, name: 'Calibri' };
  });

  ws.views = [{ state: 'frozen', ySplit: 2 }];
  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: cases.length + 2, column: COLUMNS },
  };
  // Dropdown Kategori (kolom D) & Status (kolom Q) — pilih dari daftar,
  // bukan ketik manual (biar konsisten & rapih).
  addDropdown(ws, `D3:D${cases.length + 2}`, DROPDOWN_KATEGORI);
  addDropdown(ws, `Q3:Q${cases.length + 2}`, DROPDOWN_STATUS);

  // Warna badge MENGIKUTI nilai sel (conditional formatting): saat nilai
  // diganti lewat dropdown, warna Kategori/Status ikut berubah otomatis.
  // (Fill statis tetap ditulis sebagai fallback untuk viewer non-Excel.)
  addValueFormatting(ws, `D3:D${cases.length + 2}`, Object.entries(CATEGORY_FILL), STATUS_FONT);
  addValueFormatting(
    ws,
    `Q3:Q${cases.length + 2}`,
    [
      ['Pass', STATUS_FILL.Pass],
      ['Fail', STATUS_FILL.Fail],
      ['Skip', STATUS_FILL.Skip],
    ],
    STATUS_FONT,
  );

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

// ---------- workbook ----------
function buildWorkbook(platform, results) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Automation-Dashboard-FE';
  wb.created = new Date();

  const modules = platform.modules();
  const total = modules.reduce((sum, m) => sum + m.cases.length, 0);
  const coverage = platform.coverage ? platform.coverage() : null;
  const statusMap = results?.statusMap ?? null;
  const execDate = executionDate(platform.reportFile);
  const env = environmentFor(platform.baseUrl);

  // ---- Sheet: Ringkasan ----
  const summary = wb.addWorksheet('Ringkasan');
  summary.columns = [{ width: 30 }, { width: 100 }];
  styleTitleRow(summary, `Test Case — ${platform.label}`, 'FF1F2937', 2);

  summary.addRow([]);
  summary.addRow(['Nama Project', platform.projectName]);
  summary.addRow(['Total Test Case', total]);
  for (const m of modules) {
    summary.addRow([`  ${m.sheet}`, m.cases.length]);
  }
  if (coverage) {
    const covStats = coverageStats(coverage.rows);
    summary.addRow([
      `  Coverage ${coverage.title} (Test Plan Sprint 1)`,
      `${coverage.rows.length} TC — ${covStats.penuh} penuh, ${covStats.sebagian} sebagian, ${covStats.belum} belum — lihat sheet "${coverage.sheetName}"`,
    ]);
  }
  summary.addRow(['Base URL', platform.baseUrl]);
  summary.addRow(['Environment', env]);
  summary.addRow(['Executed By', EXECUTED_BY]);
  summary.addRow(['Cara Menjalankan', platform.runCommands]);
  summary.addRow(['HTML Report', platform.reportCmd]);
  summary.addRow([]);

  const sectionStyle = (row, label) => {
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    summary.mergeCells(row.number, 1, row.number, 2);
  };

  const hasil = summary.addRow([]);
  sectionStyle(hasil, 'HASIL TEST TERAKHIR');
  if (results) {
    summary.addRow([
      'Ringkasan',
      `${results.counts.passed} Pass · ${results.counts.failed} Fail · ${results.counts.skipped} Skip (total ${results.total} test dijalankan)`,
    ]);
    summary.addRow(['Tanggal Eksekusi', execDate]);
    summary.addRow(['Laporan', `${platform.reportFile} — dibuat oleh "${platform.runCmd}"`]);
  } else {
    summary.addRow([
      'Status',
      `Belum ada report — jalankan "${platform.runCmd}" dulu, lalu regenerate file ini`,
    ]);
    summary.addRow(['Laporan', platform.reportFile]);
  }
  summary.addRow([]);

  const legend = summary.addRow([]);
  sectionStyle(legend, 'LEGENDA');
  for (const [key, value] of platform.legend) summary.addRow([key, value]);
  summary.addRow(['Dropdown (data validation)', 'Kolom Kategori & Status memakai dropdown — pilih salah satu nilai dari daftar, bukan mengetik manual']);
  summary.addRow([]);

  const note = summary.addRow([]);
  sectionStyle(note, 'CATATAN');
  for (const [key, value] of platform.notes) summary.addRow([key, value]);

  // ---- Sheet: Coverage (khusus FE) ----
  if (coverage) {
    fillCoverageSheet(wb.addWorksheet(coverage.sheetName), coverage.rows);
  }

  // ---- Sheet per modul ----
  for (const m of modules) {
    fillCaseSheet(wb.addWorksheet(m.sheet), m.cases, m.accent, m.project, statusMap, execDate, env);
  }

  return { wb, total, modules, results };
}

// ---------- main ----------
const args = process.argv.slice(2);
const platformArg =
  (args.find((a) => a.startsWith('--platform=')) ?? '').split('=')[1] ?? 'all';

const ALL_PLATFORMS = [PLATFORM_FE, PLATFORM_BE, PLATFORM_AI];
const selectedPlatforms =
  platformArg === 'all'
    ? ALL_PLATFORMS
    : ALL_PLATFORMS.filter((p) => p.key === platformArg);

if (selectedPlatforms.length === 0) {
  console.error(`❌ Platform tidak dikenal: "${platformArg}" — gunakan: fe | be | ai | all`);
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Tulis workbook; jika file terkunci (mis. sedang dibuka di Excel → EBUSY/EPERM),
// tulis ke file alternatif ber-timestamp supaya generate tidak gagal.
async function writeWorkbook(platform) {
  const results = loadTestResults(platform.reportFile);
  const { wb, total, modules } = buildWorkbook(platform, results);
  try {
    await wb.xlsx.writeFile(platform.outFile);
    return { platform, results, total, modules, outPath: platform.outFile };
  } catch (err) {
    if (err.code !== 'EBUSY' && err.code !== 'EPERM') throw err;
    const alt = platform.outFile.replace(/\.xlsx$/, `-${Date.now()}.xlsx`);
    await wb.xlsx.writeFile(alt);
    return { platform, results, total, modules, outPath: alt };
  }
}

for (const platform of selectedPlatforms) {
  const { platform: pl, results, total, modules, outPath } = await writeWorkbook(platform);

  // Cek sinkronisasi specTitle (drift): case yang tidak ter-map ke report saat
  // report tersedia → peringatan supaya koreksi dilakukan (bukan diam-diam "—").
  if (results) {
    const unmatched = [];
    for (const m of modules) {
      for (const c of m.cases) {
        if (!results.statusMap.has(`${m.project}::${c.specTitle.toLowerCase()}`)) {
          unmatched.push({ moduleKey: m.project, specTitle: c.specTitle });
        }
      }
    }
    if (unmatched.length > 0) {
      console.warn(`⚠️  [${pl.key.toUpperCase()}] ${unmatched.length} test case TIDAK ter-map ke report (cek judul test di spec vs specTitle di generator):`);
      for (const { moduleKey, specTitle } of unmatched) {
        console.warn(`   - [${moduleKey}] ${specTitle}`);
      }
    }
  }

  console.log(`✅ [${pl.key.toUpperCase()}] File Excel berhasil dibuat: ${outPath}`);
  console.log(
    `   Total test case: ${total}${modules.map((m) => ` (${m.sheet} ${m.cases.length})`).join('')}`,
  );
  const coverage = pl.coverage ? pl.coverage() : null;
  if (coverage) {
    const covStats = coverageStats(coverage.rows);
    console.log(
      `   Coverage: sheet "${coverage.sheetName}" (${coverage.rows.length} TC — ${covStats.penuh} penuh, ${covStats.sebagian} sebagian, ${covStats.belum} belum)`,
    );
  }
  console.log(`   Kolom: ${COLUMNS} (template test case management) · Environment: ${environmentFor(pl.baseUrl)} · Executed By: ${EXECUTED_BY}`);
  if (results) {
    console.log(`   Hasil test terakhir: ${results.counts.passed} Pass, ${results.counts.failed} Fail, ${results.counts.skipped} Skip (tanggal ${executionDate(pl.reportFile)})`);
  } else {
    console.log(`   ⚠️  Belum ada report test (${pl.reportFile}) — jalankan "${pl.runCmd}" dulu untuk mengisi kolom Actual Result/Status.`);
  }
  console.log('');
}
