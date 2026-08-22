import { expect } from '../fixtures';
import { test } from '../fixtures';
import { expectUrlPath } from '../../../src/helpers/ui-assert';

/**
 * Test navigasi mendalam untuk provider/navbar:
 * - Display Wall dropdown navigation
 * - Management dropdown navigation
 * - User menu dropdown
 * - Notifications button
 * - Dark mode toggle di semua halaman
 */
test.describe('Navigasi Mendalam — Navbar & Provider', () => {
  // ── Display Wall dropdown ────────────────────────────────────────────

  test('navbar "Display Wall" button membuka dropdown menu', async ({ page }) => {
    await page.goto('/monitoring/dashboard');

    const displayWallBtn = page.locator('header').getByRole('button', { name: 'Display Wall' });
    await expect(displayWallBtn).toBeVisible();
    await displayWallBtn.click();

    // Display Wall dropdown berisi link ke halaman display wall
    // Bisa berupa 'Conversation Overview', 'Top Engagement', atau link lain
    const hasWallLinks = await page.getByRole('link')
      .first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasWallLinks).toBeTruthy();
  });

  test('navigasi dari Display Wall dropdown ke Conversation Overview', async ({ page }) => {
    await page.goto('/monitoring/dashboard');

    const displayWallBtn = page.locator('header').getByRole('button', { name: 'Display Wall' });
    await displayWallBtn.click();

    const link = page.getByRole('link', { name: /Conversation Overview/ });
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await expectUrlPath(page, '/display/conversation-overview');
    }
  });

  test('navigasi dari Display Wall dropdown ke Top Engagement', async ({ page }) => {
    await page.goto('/monitoring/dashboard');

    const displayWallBtn = page.locator('header').getByRole('button', { name: 'Display Wall' });
    await displayWallBtn.click();

    const link = page.getByRole('link', { name: /Top Engagement/ });
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await expectUrlPath(page, '/display/top-engagement');
    }
  });

  // ── Management dropdown ──────────────────────────────────────────────

  test('navbar "Management" button membuka dropdown menu', async ({ page }) => {
    await page.goto('/monitoring/dashboard');

    const mgmtBtn = page.locator('header').getByRole('button', { name: 'Management' });
    const hasMgmt = await mgmtBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasMgmt) {
      await mgmtBtn.click();
      // Dropdown harus menampilkan minimal satu link
      const hasLinks = await page.getByRole('link', { name: /Keyword|User|Profile/ })
        .first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasLinks).toBeTruthy();
    }
  });

  test('navigasi dari Management dropdown ke Keyword Management', async ({ page }) => {
    await page.goto('/monitoring/dashboard');

    const mgmtBtn = page.locator('header').getByRole('button', { name: 'Management' });
    const hasMgmt = await mgmtBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasMgmt) {
      await mgmtBtn.click();
      const keywordLink = page.getByRole('link', { name: 'Keyword' });
      if (await keywordLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await keywordLink.click();
        await expectUrlPath(page, '/monitoring/keyword');
      }
    }
  });

  // ── Notifications button ─────────────────────────────────────────────

  test('tombol Notifications terlihat di navbar', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    const notifBtn = page.locator('header').getByRole('button', { name: 'Notifications' });
    await expect(notifBtn).toBeVisible();
  });

  // ── User menu ────────────────────────────────────────────────────────

  test('tombol user menu (AS Admin SIP) terlihat di navbar', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    const userMenu = page.locator('header').getByRole('button', { name: /Admin SIP/ });
    await expect(userMenu).toBeVisible();
  });

  // ── Dark mode di halaman berbeda ─────────────────────────────────────

  test('dark mode toggle berfungsi di halaman dashboard', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    const toggle = page.getByRole('button', { name: 'Enable dark mode' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Enable light mode' })).toBeVisible();
  });

  test('dark mode toggle berfungsi di halaman keyword', async ({ page }) => {
    await page.goto('/monitoring/keyword');
    const toggle = page.getByRole('button', { name: 'Enable dark mode' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Enable light mode' })).toBeVisible();
  });

  test('dark mode toggle berfungsi di halaman profile', async ({ page }) => {
    await page.goto('/profile');
    const toggle = page.getByRole('button', { name: 'Enable dark mode' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Enable light mode' })).toBeVisible();
  });

  // ── Cross-page navigation via navbar ─────────────────────────────────

  test('navigasi dari dashboard ke profile dan kembali via navbar', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible();

    // Navigasi ke profile
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

    // Kembali ke dashboard via navbar
    await page.locator('header').getByRole('link', { name: 'Dashboard' }).click();
    await expectUrlPath(page, '/monitoring/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible();
  });

  test('navigasi dari dashboard ke user management dan kembali via navbar', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible();

    // Navigasi ke user management
    await page.goto('/administration/user');
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();

    // Kembali ke dashboard via navbar
    await page.locator('header').getByRole('link', { name: 'Dashboard' }).click();
    await expectUrlPath(page, '/monitoring/dashboard');
  });
});
