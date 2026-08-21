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
export const test = base.extend<{ api: APIRequestContext }>({
  api: async ({ request }, use) => use(request),
});

/** Bangun URL absolut API backend: `${BASE_URL_BE}${path}` */
export function apiUrl(path: string): string {
  return `${Env.beBaseUrl}${path}`;
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
  // Normalize: lowercase, buang suffix _live/_dead/
  const normalize = (s: string) => s.toLowerCase().replace(/_(live|dead)$/i, '');
  return normalize(actualPlatform) === normalize(filterParam);
}
export { expect };
