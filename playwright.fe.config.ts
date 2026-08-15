import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { Env } from './src/config/env';

dotenv.config();

/**
 * Konfigurasi Web UI testing (platform FE) — multi-project per modul halaman
 * (adaptasi dari pola multi-project per platform di project API testing, FR-02).
 *
 * - Folder `tests/fe/<modul>/` otomatis masuk project `<modul>`.
 * - Platform lain punya konfigurasi terpisah: `playwright.be.config.ts`
 *   (test API, folder `tests/be/`) dan `playwright.ai.config.ts`
 *   (generate hasil dari data BE, folder `tests/ai/`).
 * - Konfigurasi default (`playwright.config.ts`) = gabungan SEMUA platform
 *   dalam satu run (`npm test`).
 * - Browser: chromium (default) — cross-browser via env `UI_BROWSERS`
 *   (mis. "chromium,firefox,webkit"), FR-04.
 * - Mode headed via env `UI_HEADED=1`, FR-03.
 */
const MODULES = [
  { name: 'smoke', testMatch: /smoke\/.*\.spec\.ts/ },
  { name: 'login', testMatch: /login\/.*\.spec\.ts/ },
  { name: 'dashboard', testMatch: /dashboard\/.*\.spec\.ts/ },
  { name: 'keyword', testMatch: /keyword\/.*\.spec\.ts/ },
  { name: 'control', testMatch: /control\/.*\.spec\.ts/ },
  { name: 'user', testMatch: /administration\/.*\.spec\.ts/ },
  { name: 'profile', testMatch: /profile\/.*\.spec\.ts/ },
] as const;

const browsers = Env.browsers.length > 0 ? Env.browsers : ['chromium'];
const multiBrowser = browsers.length > 1;

const projects = browsers.flatMap((browser) =>
  MODULES.map((mod) => ({
    name: multiBrowser ? `${mod.name}-${browser}` : mod.name,
    testMatch: mod.testMatch,
    use: {
      ...devices['Desktop Chrome'],
      browserName: browser as 'chromium' | 'firefox' | 'webkit',
    },
  })),
);

export default defineConfig({
  testDir: './tests/fe',
  // outputDir per platform — Playwright membersihkan outputDir di awal tiap
  // run, jadi dipisah per platform agar file JSON report (test-results/*.json)
  // yang ditaruh di level atas tidak ikut terhapus.
  outputDir: 'test-results/fe',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: Env.defaultTimeout,
  },

  reporter: [
    ['list'],
    // Report HTML (FR-21) — buka dengan `npm run report:fe`
    ['html', { outputFolder: 'playwright-report-fe', open: 'never' }],
    // JSON dipakai generator Excel test case (FR-22): npm run test-cases
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: Env.baseUrl,
    headless: !Env.headed,
    channel: Env.channel,
    // Artefak debugging on failure (FR-23): trace + screenshot + video
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects,
});
