import { expect } from '../fixtures';
import { test } from '../fixtures';
import { expectUrlPath } from '../../../src/helpers/ui-assert';

/**
 * Smoke test (M1 PRD): halaman-halaman utama terbuka & navigasi berfungsi.
 * Berjalan dengan API simulasi ASLI (tanpa mock) — assertion dibatasi pada
 * elemen yang stabil (heading, navbar, struktur) sehingga tidak flaky
 * walaupun API punya random failure.
 */
test.describe('Navigasi & Smoke', () => {
  test('root / redirect ke halaman dashboard', async ({ page }) => {
    await page.goto('/');
    await expectUrlPath(page, '/monitoring/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible();
  });

  test('navbar menampilkan menu Dashboard & Keyword dan identitas user', async ({ page }) => {
    await page.goto('/monitoring/dashboard');

    const navbar = page.locator('header');
    await expect(navbar.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    // Deployed app: 'Keyword' ada di bawah dropdown 'Management'
    const hasKeywordLink = await navbar.getByRole('link', { name: 'Keyword' }).isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasKeywordLink) {
      await expect(navbar.getByRole('button', { name: 'Management' })).toBeVisible();
    }
    await expect(navbar.getByRole('button', { name: 'Notifications' })).toBeVisible();
    // User aktif: 'Admin SIP' atau 'AS Admin SIP'
    const hasAdminSip = await navbar.getByText('Admin SIP').isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasAdminSip).toBeTruthy();
  });

  test('navigasi navbar ke halaman Keyword Intelligence berhasil', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    const navbar = page.locator('header');

    // Label navbar kini "Keyword Intelligence" (route baru 2026-08)
    const kiLink = navbar.locator('a[href="/monitoring/keyword-intelligence"]').first();
    await expect(kiLink).toBeVisible();
    await kiLink.click();

    await expectUrlPath(page, '/monitoring/keyword-intelligence');
    await expect(page.getByRole('heading', { name: 'Keyword Intelligence', exact: true })).toBeVisible();
  });

  test('tab Scheduled & On Demand di halaman keyword dapat dipindahkan', async ({ page }) => {
    await page.goto('/monitoring/keyword');

    const tabScheduled = page.getByRole('tab', { name: 'Scheduled' });
    const tabOnDemand = page.getByRole('tab', { name: 'On Demand' });

    // Default landing kini tab On Demand (perubahan app 2026-08)
    await expect(tabOnDemand).toHaveAttribute('aria-selected', 'true');
    await tabScheduled.click();
    await expect(tabScheduled).toHaveAttribute('aria-selected', 'true');
    await tabOnDemand.click();
    await expect(tabOnDemand).toHaveAttribute('aria-selected', 'true');
  });

  test('halaman control protocol (alert, danger, green) dapat diakses', async ({ page }) => {
    const walls: Array<{ path: string; title: string }> = [
      { path: '/control/alert-protocol', title: 'Alert' },
      { path: '/control/danger-protocol', title: 'Danger' },
      { path: '/control/green-protocol', title: 'Green — Under Control' },
    ];

    for (const wall of walls) {
      await page.goto(wall.path);
      await expect(page.getByText('Active Protocol')).toBeVisible();
      await expect(page.getByRole('heading', { name: wall.title })).toBeVisible();
    }
  });

  test('halaman profile menampilkan informasi user saat ini', async ({ page }) => {
    await page.goto('/profile');

    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    // 'Admin SIP' bisa tampil sebagai 'AS Admin SIP' di deployed app
    const hasAdminSip = await page.locator('main').getByText('Admin SIP').isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasAdminSip).toBeTruthy();
  });

  test('halaman user management dapat diakses', async ({ page }) => {
    await page.goto('/administration/user');

    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add user' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'User list' })).toBeVisible();
  });
});
