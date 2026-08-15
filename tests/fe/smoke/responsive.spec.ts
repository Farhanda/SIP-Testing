import { expect } from '../fixtures';
import { test } from '../fixtures';
import { expectUrlPath } from '../../../src/helpers/ui-assert';

/**
 * Responsif dasar (FR-15, prioritas P2): layout utama tetap berfungsi pada
 * viewport mobile — menu hamburger menggantikan navbar desktop.
 */
test.describe('Responsif', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('menu hamburger muncul & navigasi berfungsi pada viewport mobile (390x844)', async ({ page }) => {
    await page.goto('/monitoring/keyword');

    // Navbar desktop tersembunyi, tombol hamburger muncul
    await expect(page.locator('header').getByRole('button', { name: 'Open menu' })).toBeVisible();
    await expect(page.locator('header').getByRole('link', { name: 'Dashboard' })).toHaveCount(0);

    // Buka menu → pilih Dashboard
    await page.locator('header').getByRole('button', { name: 'Open menu' }).click();
    const mobileMenu = page.locator('header').getByRole('navigation');
    await expect(mobileMenu.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await mobileMenu.getByRole('link', { name: 'Dashboard' }).click();

    await expectUrlPath(page, '/monitoring/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible();
  });
});
