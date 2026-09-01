import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { Env } from './src/config/env';
import { AUTH_STATE_PATH } from './src/helpers/auth';
import { CLIENT_AUTH_STATE_PATH } from './src/helpers/client-auth';

dotenv.config({ override: true });

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

/**
 * Client modules — client role hanya bisa akses home & display wall.
 * Test di folder `tests/fe/client/` menggunakan auth state terpisah
 * (.auth/fe-client-state.json) dengan kredensial client.
 */
const CLIENT_MODULES = [
  { name: 'client-login', testMatch: /client\/login\.spec\.ts/ },
  { name: 'client-home', testMatch: /client\/home\.spec\.ts/ },
  { name: 'client-access', testMatch: /client\/access-control\.spec\.ts/ },
  { name: 'client-display', testMatch: /client\/display-wall\.spec\.ts/ },
  { name: 'client-logout', testMatch: /client\/logout\.spec\.ts/ },
] as const;

const browsers = Env.browsers.length > 0 ? Env.browsers : ['chromium'];
const multiBrowser = browsers.length > 1;

/**
 * Project setup auth: login via UI sekali dengan kredensial dari .env lalu
 * simpan storageState (.auth/fe-state.json). Dijalankan otomatis sebagai
 * dependency semua project modul KECUALI `login` — halaman /login justru
 * di-redirect ke dashboard oleh aplikasi bila sudah terautentikasi.
 */
const authProject = {
  name: multiBrowser ? 'auth-chromium' : 'auth',
  testMatch: /tests\/fe\/auth\.setup\.ts/,
  use: { ...devices['Desktop Chrome'], browserName: 'chromium' as const },
};

const projects = [
  authProject,
  ...browsers.flatMap((browser) =>
    MODULES.map((mod) => ({
      name: multiBrowser ? `${mod.name}-${browser}` : mod.name,
      testMatch: mod.testMatch,
      dependencies: mod.name === 'login' ? [] : [authProject.name],
      use: {
        ...devices['Desktop Chrome'],
        browserName: browser as 'chromium' | 'firefox' | 'webkit',
        ...(mod.name === 'login' ? {} : { storageState: AUTH_STATE_PATH }),
      },
    })),
  ),
];

// ── Client auth project & client module projects ──────────────────────
const clientAuthProject = {
  name: multiBrowser ? 'client-auth-chromium' : 'client-auth',
  testMatch: /tests\/fe\/client\/auth\.setup\.ts/,
  use: { ...devices['Desktop Chrome'], browserName: 'chromium' as const },
};

const clientProjects = [
  clientAuthProject,
  ...browsers.flatMap((browser) =>
    CLIENT_MODULES.map((mod) => ({
      name: multiBrowser ? `${mod.name}-${browser}` : mod.name,
      testMatch: mod.testMatch,
      dependencies: mod.name === 'client-login' ? [] : [clientAuthProject.name],
      use: {
        ...devices['Desktop Chrome'],
        browserName: browser as 'chromium' | 'firefox' | 'webkit',
        ...(mod.name === 'client-login' ? {} : { storageState: CLIENT_AUTH_STATE_PATH }),
      },
    })),
  ),
];


export default defineConfig({
  testDir: './tests/fe',
  // outputDir per platform — Playwright membersihkan outputDir di awal tiap
  // run, jadi dipisah per platform agar file JSON report (test-results/*.json)
  // yang ditaruh di level atas tidak ikut terhapus.
  outputDir: 'test-results/fe',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 2,
  workers: process.env.CI ? 1 : 4,
  timeout: 30_000,
  expect: {
    timeout: Env.defaultTimeout,
  },

  // PERHATIAN: results.json hanya boleh ditulis oleh run LENGKAP (npm run test:fe).
  // Run per project (npm run test:smoke|login|dashboard|...) harus override reporter
  // dengan `--reporter=list` (lihat package.json) supaya TIDAK menimpa report FE
  // lengkap — kalau tertimpa, generator Excel kehilangan status 52 test case lain.
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

  projects: [...projects, ...clientProjects],
});
