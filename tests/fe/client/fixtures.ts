import { test as base, expect } from '@playwright/test';
import { DisplayWallPage } from '../../../src/pages/DisplayWallPage';
import { LoginPage } from '../../../src/pages/LoginPage';

/**
 * Custom fixtures Playwright untuk client role.
 *
 * Client role hanya memiliki akses terbatas:
 * - /monitoring/home (home page dengan kartu navigasi)
 * - /display/top-engagement
 * - /display/conversation-overview
 *
 * Tidak ada akses ke: dashboard, keyword, control, profile, administration.
 */
export const test = base.extend<{
  loginPage: LoginPage;
  displayWallPage: DisplayWallPage;
}>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  displayWallPage: async ({ page }, use) => use(new DisplayWallPage(page)),
});

export { expect };
