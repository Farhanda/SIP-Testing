import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { Env } from './src/config/env';

dotenv.config({ override: true });

/**
 * Konfigurasi platform AI — dua peran, dijalankan dengan `npm run test:ai`:
 *
 * 1. Menguji **SIP AI Service** (health, meta, analyze batch/jobs/sync)
 *    di `BASE_URL_AI` (default http://10.200.102.2:8100) dengan header
 *    auth `X-Service-Token` (`AI_SERVICE_TOKEN`, dev: dev-local-service-token).
 * 2. MENGHASILKAN output dari data BE (laporan ringkasan insight &
 *    ringkasan hasil eksekusi test BE) — membaca `BASE_URL_BE` dan
 *    `test-results/results-be.json`, hasil ditulis ke `test-results/ai/`.
 *
 * - Folder `tests/ai/` → project `ai`.
 * - Report terpisah: HTML di `playwright-report-ai/`, JSON di
 *   `test-results/results-ai.json`.
 */
export default defineConfig({
  testDir: './tests/ai',
  testMatch: /.*\.spec\.ts/,
  // outputDir = folder hasil generate (test-results/ai). Playwright
  // membersihkannya di awal tiap run → laporan lama dibersihkan, laporan
  // baru di-generate ulang. results-ai.json ditaruh di level atas supaya
  // tidak ikut terhapus.
  outputDir: 'test-results/ai',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // workers dibatasi (2) agar tidak membanjiri AI Service — analisis sync
  // itu blocking berat; saat terlalu banyak request paralel, service
  // overload dan sebagian post gagal dianalisis (status partial).
  workers: process.env.CI ? 1 : 2,
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-ai', open: 'never' }],
    ['json', { outputFile: 'test-results/results-ai.json' }],
  ],

  use: {
    // Base URL default request; helper aiApiUrl/beApiUrl di fixtures AI
    // membangun URL absolut per target (AI Service / BE).
    baseURL: Env.aiBaseUrl,
    extraHTTPHeaders: { Accept: 'application/json' },
  },

  projects: [{ name: 'ai', testMatch: /.*\.spec\.ts/ }],
});
