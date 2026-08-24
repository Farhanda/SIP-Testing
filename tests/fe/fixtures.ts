import { test as base, expect } from '@playwright/test';
import { DashboardPage } from '../../src/pages/DashboardPage';
import { DisplayWallPage } from '../../src/pages/DisplayWallPage';
import { KeywordPage } from '../../src/pages/KeywordPage';
import { LoginPage } from '../../src/pages/LoginPage';
import { PostsPage } from '../../src/pages/PostsPage';
import { ProfilePage } from '../../src/pages/ProfilePage';
import { ProtocolPage } from '../../src/pages/ProtocolPage';
import { ProviderPage } from '../../src/pages/ProviderPage';
import { TopicDetailPage } from '../../src/pages/TopicDetailPage';
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
  displayWallPage: DisplayWallPage;
  keywordPage: KeywordPage;
  postsPage: PostsPage;
  profilePage: ProfilePage;
  protocolPage: ProtocolPage;
  topicDetailPage: TopicDetailPage;
  userPage: UserManagementPage;
  providerPage: ProviderPage;
  unscheduledDetailPage: UnscheduledDetailPage;
}>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  displayWallPage: async ({ page }, use) => use(new DisplayWallPage(page)),
  keywordPage: async ({ page }, use) => use(new KeywordPage(page)),
  postsPage: async ({ page }, use) => use(new PostsPage(page)),
  profilePage: async ({ page }, use) => use(new ProfilePage(page)),
  protocolPage: async ({ page }, use) => use(new ProtocolPage(page)),
  topicDetailPage: async ({ page }, use) => use(new TopicDetailPage(page)),
  userPage: async ({ page }, use) => use(new UserManagementPage(page)),
  providerPage: async ({ page }, use) => use(new ProviderPage(page)),
  unscheduledDetailPage: async ({ page }, use) => use(new UnscheduledDetailPage(page)),
});

export { expect };
