import { expect } from './fixtures';
import { test } from './fixtures';
import { Env } from '../../../src/config/env';

/**
 * Test Logout untuk client role.
 *
 * Client dapat logout dari user menu di navbar.
 * Setelah logout, redirect ke /login.
 */
test.describe('Client — Logout', () => {
  test.beforeEach(async ({ page }) => {
    // Auth sudah di-setup oleh client-auth project (storageState)
    // Navigate langsung ke home
    await page.goto('/monitoring/home', { timeout: 20_000 });
  });

  test('user menu menampilkan tombol Logout', async ({ page }) => {
    // Klik user menu (tombol terakhir di header)
    const header = page.locator('header');
    const userMenuBtn = header.locator('button').last();
    await userMenuBtn.click();

    // Logout button visible
    const logoutBtn = page.getByRole('button', { name: 'Logout' });
    await expect(logoutBtn).toBeVisible();
    await expect(logoutBtn).toBeEnabled();
  });

  test('klik Logout → redirect ke /login', async ({ page }) => {
    // Klik user menu
    const header = page.locator('header');
    const userMenuBtn = header.locator('button').last();
    await userMenuBtn.click();

    // Klik Logout
    const logoutBtn = page.getByRole('button', { name: 'Logout' });
    await logoutBtn.click();

    // Redirect ke login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('setelah logout, akses /monitoring/home → redirect ke /login', async ({ page }) => {
    // Logout dulu
    const header = page.locator('header');
    const userMenuBtn = header.locator('button').last();
    await userMenuBtn.click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Coba akses home tanpa login → harus redirect ke /login
    await page.goto('/monitoring/home', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('setelah logout, akses /display/top-engagement tanpa auth', async ({ page }) => {
    // Logout dulu
    const header = page.locator('header');
    const userMenuBtn = header.locator('button').last();
    await userMenuBtn.click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Display wall mungkin tetap accessible (public) atau redirect ke login
    await page.goto('/display/top-engagement', { waitUntil: 'domcontentloaded', timeout: 10_000 });
    // Tidak assert redirect — display wall bisa jadi public
    // Yang penting: tidak crash
    await expect(page).toHaveURL(/\/(display\/top-engagement|login)/);
  });
});
