import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { Env } from './src/config/env';

dotenv.config();

/**
 * Konfigurasi testing API Backend (platform BE).
 *
 * - Folder `tests/be/` → project `be`, dijalankan dengan `npm run test:be`.
 * - Base URL & prefix API dari env (`BASE_URL_BE`, `BE_API_PREFIX`),
 *   default ke BE lokal `http://localhost:8080` + `/v1`.
 * - Report terpisah dari FE: HTML di `playwright-report-be/`, JSON di
 *   `test-results/results-be.json` (dipakai platform AI sebagai sumber data).
 */
export default defineConfig({
  testDir: './tests/be',
  testMatch: /.*\.spec\.ts/,
  // outputDir per platform — Playwright membersihkan outputDir di awal tiap
  // run, jadi dipisah agar results-be.json (dibaca platform AI) tetap ada.
  outputDir: 'test-results/be',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-be', open: 'never' }],
    ['json', { outputFile: 'test-results/results-be.json' }],
  ],

  use: {
    // Base URL untuk APIRequestContext (`request`/`api` fixture).
    baseURL: Env.beBaseUrl,
    extraHTTPHeaders: { Accept: 'application/json' },
  },

  projects: [{ name: 'be', testMatch: /.*\.spec\.ts/ }],
});
