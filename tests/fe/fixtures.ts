import { test as base, expect } from '@playwright/test';
import { DashboardPage } from '../../src/pages/DashboardPage';
import { KeywordPage } from '../../src/pages/KeywordPage';
import { LoginPage } from '../../src/pages/LoginPage';
import { ProfilePage } from '../../src/pages/ProfilePage';
import { ProtocolPage } from '../../src/pages/ProtocolPage';
import { UnscheduledDetailPage } from '../../src/pages/UnscheduledDetailPage';
import { UserManagementPage } from '../../src/pages/UserManagementPage';

/**
 * Custom fixtures Playwright — menghilangkan boilerplate pembuatan POM
 * di tiap spec (FR-05, pola sama dengan fixtures project API).
 *
 * Cara pakai di spec:
 *   import { test, expect } from '../fixtures';
 *   test('...', async ({ dashboardPage }) => { ... });
 *
 * ⚠️ File ini sengaja TIDAK berakhiran .spec.ts supaya tidak ter-collect
 *    sebagai test file oleh testMatch di playwright.config.ts.
 */
export const test = base.extend<{
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  keywordPage: KeywordPage;
  protocolPage: ProtocolPage;
  userPage: UserManagementPage;
  profilePage: ProfilePage;
  unscheduledDetailPage: UnscheduledDetailPage;
}>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  keywordPage: async ({ page }, use) => use(new KeywordPage(page)),
  protocolPage: async ({ page }, use) => use(new ProtocolPage(page)),
  userPage: async ({ page }, use) => use(new UserManagementPage(page)),
  profilePage: async ({ page }, use) => use(new ProfilePage(page)),
  unscheduledDetailPage: async ({ page }, use) => use(new UnscheduledDetailPage(page)),
});

export { expect };
