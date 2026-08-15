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

export { expect };
