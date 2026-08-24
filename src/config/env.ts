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
};
