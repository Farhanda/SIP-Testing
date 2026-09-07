import dotenv from 'dotenv';

// Snapshot env var CLI/proses SEBELUM dotenv.config({ override: true }) —
// supaya nilai yang diset via CLI (mis. `UI_ENV=dev npm run test:fe`)
// selalu menang atas nilai dengan nama sama di file .env.
const CLI_UI_ENV = process.env.UI_ENV;
const CLI_BASE_URL_UI = process.env.BASE_URL_UI;

dotenv.config({ override: true });

/**
 * Profil environment aplikasi FE — memetakan nama environment ke URL:
 *   - `dev`     → http://10.200.101.13:3000  (wifi kantor)
 *   - `staging` → http://10.200.101.6:3000   (wifi kantor)
 *   - `prod`    → https://sip.c2signals.com  (bisa diakses di mana saja)
 *
 * Cara pakai (pilih SALAH SATU):
 *   1. Set `UI_ENV=dev|staging|prod` di .env (atau env var CLI, mis.
 *      `UI_ENV=prod npm run test:fe`), atau
 *   2. Set langsung `BASE_URL_UI=https://...` untuk URL custom.
 *
 * Prioritas: env var CLI > `.env` > default `dev`. Di dalam sumber yang sama,
 * `UI_ENV` didahulukan di atas `BASE_URL_UI`. Contoh:
 *   - .env berisi `UI_ENV=staging` (default harian), CLI
 *     `BASE_URL_UI=http://localhost:3000` → URL custom CLI yang dipakai
 *     (Opsi 3 tetap berfungsi tanpa harus mengubah .env).
 *   - CLI `UI_ENV=prod` → prod dipakai walau .env berisi apa pun.
 *
 * Catatan dotenv: `.env` dibaca dengan `override: true`, jadi isi `.env`
 * menimpa env var CLI untuk variabel yang sama. Supaya CLI tetap menang,
 * `UI_ENV`/`BASE_URL_UI` dibaca dari snapshot proses SEBELUM dotenv dijalankan.
 *
 * ⚠️ HATI-HATI: test menulis data (login, password, dsb.) — pastikan yang
 * di-test adalah environment yang benar, terutama saat memakai `prod`.
 */
export const UI_ENV_URLS: Record<string, string> = {
  dev: 'http://10.200.101.13:3000',
  staging: 'http://10.200.101.6:3000',
  prod: 'https://sip.c2signals.com',
};

/** Nilai ter-resolusi (sumber + nilai) sebelum dipakai mengisi Env. */
type Resolved = { source: 'cli' | 'dotenv' | 'default'; profile?: string; url?: string };

function resolveBaseUrlUi(): Resolved {
  const cliProfile = (CLI_UI_ENV ?? '').trim().toLowerCase();
  const cliUrl = (CLI_BASE_URL_UI ?? '').trim();
  const envProfile = (process.env.UI_ENV ?? '').trim().toLowerCase();
  const envUrl = (process.env.BASE_URL_UI ?? '').trim();

  // 1) CLI UI_ENV — di dalam sumber CLI, UI_ENV didahulukan di atas
  //    BASE_URL_UI (ganti profil via CLI selalu bisa).
  if (cliProfile !== '') {
    const url = UI_ENV_URLS[cliProfile];
    if (!url) {
      throw new Error(
        `UI_ENV tidak dikenal: "${cliProfile}". Nilai valid: ${Object.keys(UI_ENV_URLS).join(', ')}.`,
      );
    }
    return { source: 'cli', profile: cliProfile, url };
  }

  // 2) CLI BASE_URL_UI — URL custom eksplisit dari CLI/proses.
  if (cliUrl !== '') return { source: 'cli', url: cliUrl };

  // 3) .env UI_ENV (dotenv sudah dijalankan → process.env berisi nilai .env).
  if (envProfile !== '') {
    const url = UI_ENV_URLS[envProfile];
    if (!url) {
      throw new Error(
        `UI_ENV tidak dikenal: "${envProfile}". Nilai valid: ${Object.keys(UI_ENV_URLS).join(', ')}.`,
      );
    }
    return { source: 'dotenv', profile: envProfile, url };
  }

  // 4) .env BASE_URL_UI (perilaku lama tetap berlaku).
  if (envUrl !== '') return { source: 'dotenv', url: envUrl };

  // 5) Tanpa semuanya → default dev (URL default lama sebelum ada UI_ENV).
  return { source: 'default', profile: 'dev', url: UI_ENV_URLS.dev };
}

const resolved = resolveBaseUrlUi();

/**
 * Baca variabel wajib (kredensial) — tanpa default nyata di kode supaya
 * secret tidak pernah ter-commit. Error jelas bila .env belum diisi.
 */
function requiredEnv(name: string): string {
  const value = (process.env[name] ?? '').trim();
  if (value === '') {
    throw new Error(
      `Environment variable ${name} wajib diisi di .env (lihat .env.example) — kredensial tidak boleh punya default di kode.`,
    );
  }
  return value;
}

/**
 * Konfigurasi terpusat yang dibaca dari .env.
 * Semua nilai punya default agar project tetap bisa jalan tanpa .env
 * (pola sama dengan src/config/env.ts di project API testing).
 */
export const Env = {
  // Base URL aplikasi web target — dari UI_ENV (dev/staging/prod) atau
  // BASE_URL_UI eksplisit. Default: dev.
  baseUrl: resolved.url as string,

  // Profil environment aktif: 'dev' | 'staging' | 'prod' | 'custom'
  // (custom = BASE_URL_UI eksplisit yang tidak cocok dengan profil mana pun).
  uiEnv: resolved.profile ?? 'custom',

  // Daftar browser: "chromium" (default) | "firefox" | "webkit"
  browsers: (process.env.UI_BROWSERS ?? 'chromium')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean),

  // Mode headed (debug) vs headless (CI)
  headed: process.env.UI_HEADED === '1',

  // Channel browser (mis. "chrome" untuk memakai Google Chrome sistem)
  channel: process.env.UI_BROWSER_CHANNEL || undefined,

  // Timeout default per assertion/aksi (ms)
  defaultTimeout: Number(process.env.UI_TIMEOUT ?? 15000),

  // ----- Kredensial user test (login UI, auth asli) -----
  // Dipakai setup auth (storageState) & test case login. WAJIB dari .env —
  // tidak ada default di kode agar secret tidak ter-commit.
  testUsername: requiredEnv('UI_TEST_USERNAME'),
  testPassword: requiredEnv('UI_TEST_PASSWORD'),

  // ----- Kredensial client (role terbatas: hanya home & display wall) -----
  clientUsername: requiredEnv('UI_CLIENT_USERNAME'),
  clientPassword: requiredEnv('UI_CLIENT_PASSWORD'),

  // ----- Password akun admin saat ini (regression change-password) -----
  // Dipakai tests/fe/profile/regression-bugs.spec.ts (P05) sebagai
  // "current password benar" — jangan hardcode di spec.
  adminCurrentPassword: requiredEnv('UI_ADMIN_CURRENT_PASSWORD'),

  // ----- Backend API (testing platform BE & AI) -----
  // Base URL API backend target (deployed)
  beBaseUrl: process.env.BASE_URL_BE ?? 'http://10.200.101.13:8091',

  // Prefiks versi API backend (default /v1)
  beApiPrefix: process.env.BE_API_PREFIX ?? '/v1',

  // Base URL scrape service / api-gateway (keyword-management, credential,
  // platform) — service TERPISAH dari dashboard-service di BASE_URL_BE.
  scrapeBaseUrl: process.env.BASE_URL_SCRAPE ?? 'http://10.200.101.13:8080',

  // ----- AI Service (SIP AI Service, platform AI) -----
  // Base URL service AI (deployed)
  aiBaseUrl: process.env.BASE_URL_AI ?? 'http://10.200.102.2:8100',

  // Token service AI — dikirim via header X-Service-Token (semua endpoint
  // AI wajib membawanya; isi "dev-local-service-token" untuk dev lokal)
  aiServiceToken: process.env.AI_SERVICE_TOKEN ?? 'dev-local-service-token',

  // ----- Scraper service RAW (backend, tanpa prefix /scrape/) -----
  // Backend BE ada DUA service: dashboard-service (BASE_URL_BE) &
  // scraper service langsung (BASE_URL_SCRAPER, default :8090) — beda
  // host/port dari api-gateway scrape (BASE_URL_SCRAPE, prefix /v1/scrape).
  scraperBaseUrl: process.env.BASE_URL_SCRAPER ?? 'http://10.200.101.13:8090',

  // ----- Intelligence AI Service (SIP Intelligence, port :8000) -----
  // Service AI kedua: SIP AI Service (BASE_URL_AI, :8100, header
  // X-Service-Token) & Intelligence AI Service (BASE_URL_AI_INTELLIGENCE,
  // :8000, header X-AI-Service-Token). Token per-service dari .env.
  aiIntelligenceBaseUrl: process.env.BASE_URL_AI_INTELLIGENCE ?? 'http://10.200.102.2:8000',
  aiIntelligenceToken: process.env.AI_INTELLIGENCE_TOKEN ?? '',
};
