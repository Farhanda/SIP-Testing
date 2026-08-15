import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { Env } from './src/config/env';

dotenv.config();

/**
 * Konfigurasi DEFAULT — menjalankan SEMUA platform (FE + BE + AI) dalam satu
 * run, dijalankan dengan `npm test` (atau `npx playwright test`) → report
 * gabungan di `playwright-report/` (buka dengan `npm run report`).
 *
 * Nama polos = gabungan/semua; nama ber-suffix = spesifik per platform:
 *   - `playwright.fe.config.ts` → Web UI (tests/fe/, `npm run test:fe`)
 *   - `playwright.be.config.ts` → API backend (tests/be/, `npm run test:be`)
 *   - `playwright.ai.config.ts` → generate hasil dari data BE (tests/ai/, `npm run test:ai`)
 *
 * Catatan:
 * - Berbeda dengan run per platform, project FE di sini tidak dipecah per
 *   modul (smoke/login/...) — cukup satu project `fe` agar report ringkas.
 * - Untuk Excel test case per platform, tetap pakai run per platform
 *   (`npm run test:fe|be|ai`) lalu `npm run test-cases[:fe|:be|:ai]`.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: Env.defaultTimeout,
  },

  // outputDir sendiri supaya tidak menghapus hasil JSON per platform
  // (test-results/results.json · results-be.json · results-ai.json).
  outputDir: 'test-results/run',

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    headless: !Env.headed,
    channel: Env.channel,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: { Accept: 'application/json' },
  },

  projects: [
    // FE → base URL aplikasi web; BE & AI → base URL API backend.
    { name: 'fe', testMatch: /fe\/.*\.spec\.ts/, use: { baseURL: Env.baseUrl } },
    { name: 'be', testMatch: /be\/.*\.spec\.ts/, use: { baseURL: Env.beBaseUrl } },
    { name: 'ai', testMatch: /ai\/.*\.spec\.ts/, use: { baseURL: Env.beBaseUrl } },
  ],
});
