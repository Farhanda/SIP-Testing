import dotenv from 'dotenv';

dotenv.config({ override: true });

/**
 * Konfigurasi terpusat yang dibaca dari .env.
 * Semua nilai punya default agar project tetap bisa jalan tanpa .env
 * (pola sama dengan src/config/env.ts di project API testing).
 */
export const Env = {
  // Base URL aplikasi web target (deployed)
  baseUrl: process.env.BASE_URL_UI ?? 'http://10.200.101.13:3000',

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
  // Dipakai setup auth (storageState) & test case login. JANGAN hardcode di spec.
  testUsername: process.env.UI_TEST_USERNAME ?? 'admin',
  testPassword: process.env.UI_TEST_PASSWORD ?? '12tiga',

  // ----- Kredensial client (role terbatas: hanya home & display wall) -----
  clientUsername: process.env.UI_CLIENT_USERNAME ?? 'client',
  clientPassword: process.env.UI_CLIENT_PASSWORD ?? 'signalsclient',

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
