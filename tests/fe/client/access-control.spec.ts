import { expect } from './fixtures';
import { test } from './fixtures';
import { Env } from '../../../src/config/env';

/**
 * Test Access Control (RBAC) untuk client role.
 *
 * Client role TIDAK boleh mengakses halaman admin. Semua halaman berikut
 * harus redirect ke /monitoring/home.
 *
 * Halaman yang diuji:
 * - /monitoring/dashboard
 * - /monitoring/keyword
 * - /monitoring/keyword-intelligence
 * - /monitoring/posts
 * - /control/alert-protocol
 * - /control/danger-protocol
 * - /control/green-protocol
 * - /profile
 * - /administration/user
 * - /administration/provider
 */
test.describe('Client — Access Control (RBAC)', () => {
  test.beforeEach(async ({ page }) => {
    // Auth sudah di-setup oleh client-auth project (storageState)
    // Navigate langsung ke home sebagai starting point
    await page.goto('/monitoring/home', { timeout: 20_000 });
  });

  const restrictedPages = [
    { path: '/monitoring/dashboard', name: 'Dashboard' },
    { path: '/monitoring/keyword', name: 'Keyword' },
    { path: '/monitoring/keyword-intelligence', name: 'Keyword Intelligence' },
    { path: '/monitoring/posts', name: 'Posts' },
    { path: '/control/alert-protocol', name: 'Alert Protocol' },
    { path: '/control/danger-protocol', name: 'Danger Protocol' },
    { path: '/control/green-protocol', name: 'Green Protocol' },
    { path: '/profile', name: 'Profile' },
    { path: '/administration/user', name: 'User Management' },
    { path: '/administration/provider', name: 'Provider Management' },
  ];

  for (const { path, name } of restrictedPages) {
    test(`${name} (${path}) redirect ke /monitoring/home`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 10_000 });

      // Client tidak boleh mengakses halaman ini — harus redirect ke home
      await expect(page).toHaveURL(/\/monitoring\/home/, { timeout: 10_000 });
    });
  }

  test('akses direct URL /monitoring/dashboard → redirect ke /monitoring/home', async ({ page }) => {
    await page.goto('/monitoring/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/monitoring\/home/, { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: 'Select a monitoring view' })
    ).toBeVisible();
  });

  test('akses direct URL /administration/user → redirect ke /monitoring/home', async ({ page }) => {
    await page.goto('/administration/user', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/monitoring\/home/, { timeout: 10_000 });
  });

  test('akses direct URL /profile → redirect ke /monitoring/home', async ({ page }) => {
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/monitoring\/home/, { timeout: 10_000 });
  });

  // ── Halaman yang BOLEH diakses client ─────────────────────────────────

  test('/monitoring/conversation-overview dapat diakses client', async ({ page }) => {
    await page.goto('/monitoring/conversation-overview', { waitUntil: 'domcontentloaded', timeout: 10_000 });

    // Tidak redirect ke home
    await expect(page).toHaveURL(/\/monitoring\/conversation-overview/);
  });

  test('/monitoring/top-engagement dapat diakses client', async ({ page }) => {
    await page.goto('/monitoring/top-engagement', { waitUntil: 'domcontentloaded', timeout: 10_000 });

    // Tidak redirect ke home
    await expect(page).toHaveURL(/\/monitoring\/top-engagement/);
  });
});
