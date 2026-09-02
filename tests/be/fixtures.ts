import { test as base, expect, APIRequestContext } from '@playwright/test';
import { Env } from '../../src/config/env';

/**
 * Custom fixtures untuk testing API backend (platform BE).
 *
 * - `api`   : APIRequestContext siap pakai (baseURL = BASE_URL_BE,
 *             header Accept: application/json) — sama seperti fixture
 *             `request` bawaan Playwright, tapi diberi nama `api` supaya
 *             jelas di spec.
 * - `apiUrl`: helper membangun URL absolut dari path API.
 *
 * Cara pakai di spec:
 *   import { test, expect, apiUrl } from '../fixtures';
 *   test('...', async ({ api }) => {
 *     const res = await api.get(apiUrl('/v1/dashboard/summary'));
 *     ...
 *   });
 *
 * ⚠️ File ini sengaja TIDAK berakhiran .spec.ts supaya tidak ter-collect
 *    sebagai test file oleh testMatch di playwright.be.config.ts.
 */
export const test = base.extend<{
  api: APIRequestContext;
  scrapeApi: APIRequestContext;
  scraperApi: APIRequestContext;
}>({
  api: async ({ request }, use) => use(request),
  // Scrape service / api-gateway berjalan di host/port TERPISAH dari
  // dashboard-service — butuh APIRequestContext sendiri (BASE_URL_SCRAPE).
  scrapeApi: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: Env.scrapeBaseUrl,
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    await use(ctx);
    await ctx.dispose();
  },
  // Scraper service RAW (backend, tanpa prefix /scrape/) — service BE
  // KEDUA di BASE_URL_SCRAPER (default :8090). Endpoint-nya konsisten
  // dengan api-gateway tapi di-path polos (/v1/keyword-management, dsb).
  scraperApi: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: Env.scraperBaseUrl,
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    await use(ctx);
    await ctx.dispose();
  },
});

/** Bangun URL absolut API backend: `${BASE_URL_BE}${path}` */
export function apiUrl(path: string): string {
  return `${Env.beBaseUrl}${path}`;
}

/** Bangun URL absolut scrape service: `${BASE_URL_SCRAPE}${path}` */
export function scrapeUrl(path: string): string {
  return `${Env.scrapeBaseUrl}${path}`;
}

/** Bangun URL absolut scraper service RAW: `${BASE_URL_SCRAPER}${path}` */
export function scraperUrl(path: string): string {
  return `${Env.scraperBaseUrl}${path}`;
}

/**
 * Flexible platform matcher — BE deployed menggunakan suffix dinamis
 * seperti "Tiktok_live", "Twitterx_live", "Instagram_live", "X_dead",
 * dsb. Filter param selalu lowercase tanpa suffix ("tiktok", "x", "instagram").
 *
 * Cara pakai:
 *   expect(matchesPlatformFilter(item.platform, 'tiktok')).toBe(true);
 *   expect(items.every(i => matchesPlatformFilter(i.platform, 'tiktok'))).toBe(true);
 *
 * Atau wrap di expect:
 *   expect(platformMatches(item.platform, filter)).toBeTruthy();
 */
export function matchesPlatformFilter(actualPlatform: string, filterParam: string): boolean {
  // Normalize: lowercase, buang suffix _live/_dead/, handle Twitter/x → x
  const normalize = (s: string) => {
    let n = s.toLowerCase().replace(/_(live|dead)$/i, '');
    // Handle "Twitter/x" → "x"
    if (n.includes('/')) {
      n = n.split('/').pop()!;
    }
    return n;
  };
  return normalize(actualPlatform) === normalize(filterParam);
}
export { expect };
