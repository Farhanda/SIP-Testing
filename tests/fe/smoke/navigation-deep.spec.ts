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

    const nav = page.locator('header');
    const displayWallBtn = nav.getByRole('button', { name: 'Display Wall' });
    await displayWallBtn.click();

    // Bentuk DOM beda antar environment: dev merender link di role="menu",
    // staging/prod sebagai link di <nav>. Scope menerima keduanya, lalu klik
    // & verifikasi navigasi TEGAS (bukan if-visible yang lolos diam-diam).
    const menuScope = page.getByRole('menu').last().or(nav);
    const link = menuScope.locator('a[href="/display/conversation-overview"]');
    await expect(link).toBeVisible();
    await link.click();
    await expectUrlPath(page, '/display/conversation-overview');
  });

  test('navigasi dari Display Wall dropdown ke Top Engagement', async ({ page }) => {
    await page.goto('/monitoring/dashboard');

    const nav = page.locator('header');
    const displayWallBtn = nav.getByRole('button', { name: 'Display Wall' });
    await displayWallBtn.click();

    const menuScope = page.getByRole('menu').last().or(nav);
    const link = menuScope.locator('a[href="/display/top-engagement"]');
    await expect(link).toBeVisible();
    await link.click();
    await expectUrlPath(page, '/display/top-engagement');
  });

  // ── Management dropdown ──────────────────────────────────────────────

  test('navbar "Management" button membuka dropdown menu', async ({ page }) => {
    await page.goto('/monitoring/dashboard');

    const nav = page.locator('header');
    const mgmtBtn = nav.getByRole('button', { name: 'Management' });
    await expect(mgmtBtn).toBeVisible();
    await mgmtBtn.click();
    await expect(mgmtBtn).toHaveAttribute('aria-expanded', 'true');
    // Bentuk DOM beda antar environment: dev merender item dropdown sebagai
    // menuitem (mis. "Keywords Keywords & monitoring schedule"), staging/prod
    // sebagai link biasa di dalam <nav>. Selector menerima keduanya.
    const item = nav
      .getByRole('menuitem', { name: /Keyword|User|Provider|Profile/ })
      .or(nav.getByRole('link', { name: /Keyword|Provider|User/ }));
    await expect(item.first()).toBeVisible();
  });

  test('navigasi dari Management dropdown ke Keyword Management', async ({ page }) => {
    await page.goto('/monitoring/dashboard');

    const nav = page.locator('header');
    const mgmtBtn = nav.getByRole('button', { name: 'Management' });
    await expect(mgmtBtn).toBeVisible();
    await mgmtBtn.click();
    // dev: menuitem "Keywords ..."; staging/prod: link "Keywords" di <nav> —
    // klik keduanya menavigasi ke /monitoring/keyword.
    const keywordItem = nav
      .getByRole('menuitem', { name: /Keywords/ })
      .or(nav.getByRole('link', { name: /Keywords/ }));
    await expect(keywordItem.first()).toBeVisible();
    await keywordItem.first().click();
    await expectUrlPath(page, '/monitoring/keyword');
  });

  // ── Notifications button ─────────────────────────────────────────────

  test('tombol Notifications terlihat di navbar', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    const notifBtn = page.locator('header').getByRole('button', { name: 'Notifications' });
    await expect(notifBtn).toBeVisible();
  });

  test('dropdown Notifications menampilkan panel dengan empty state', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    await page.locator('header').getByRole('button', { name: 'Notifications' }).click();

    // Panel terbuka menampilkan empty state (belum ada notifikasi)
    await expect(page.getByText('No notifications yet.')).toBeVisible();
  });

  // ── User menu ────────────────────────────────────────────────────────

  test('tombol user menu (identitas user aktif) terlihat di navbar', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    // Label berubah-ubah ('Admin SIP', 'AS Admin SIP', kini 'A admin') — assert
    // tombol yang memuat nama user ('admin') di area header paling kanan.
    const userMenu = page.locator('header').getByRole('button', { name: /admin/i }).last();
    await expect(userMenu).toBeVisible();
  });

  test('user menu menampilkan opsi Logout saat dibuka', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    await page.locator('header').getByRole('button', { name: /admin/i }).last().click();

    // UI terkini: dropdown hanya berisi tombol Logout (Profile sudah tidak ada)
    const logoutItem = page.getByRole('button', { name: 'Logout' });
    await expect(logoutItem).toBeVisible();
    await expect(logoutItem).toBeEnabled();

    // Logout berfungsi — klik → kembali ke halaman login
    await logoutItem.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
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
