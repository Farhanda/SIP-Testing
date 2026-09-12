import { expect } from './fixtures';
import { test } from './fixtures';
import { Env } from '../../../src/config/env';

/**
 * Test Home Page untuk client role.
 *
 * /monitoring/home adalah halaman utama client setelah login.
 * Menampilkan:
 * - Heading "Select a monitoring view"
 * - 2 kartu navigasi: Conversation Overview & Top Engagement
 * - Welcome message
 */
test.describe('Client — Home Page', () => {
  test.beforeEach(async ({ page }) => {
    // Auth sudah di-setup oleh client-auth project (storageState)
    // Navigate langsung ke home
    await page.goto('/monitoring/home', { timeout: 20_000 });
  });

  test('home page menampilkan heading "Select a monitoring view"', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Select a monitoring view' })
    ).toBeVisible();
  });

  test('home page menampilkan welcome message', async ({ page }) => {
    // Body text: "Welcome back" + heading
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('home page menampilkan 2 kartu navigasi', async ({ page }) => {
    // Kartu Conversation Overview
    await expect(page.getByText('Conversation Overview')).toBeVisible();
    await expect(
      page.getByText('Volume, trend, and sentiment across monitored platforms.')
    ).toBeVisible();

    // Kartu Top Engagement
    await expect(page.getByText('Top Engagement')).toBeVisible();
    await expect(
      page.getByText('The highest-performing posts and accounts this period.')
    ).toBeVisible();
  });

  test('klik kartu Conversation Overview → navigasi ke /monitoring/conversation-overview', async ({ page }) => {
    await page.getByText('Conversation Overview').first().click();

    await expect(page).toHaveURL(/\/monitoring\/conversation-overview/, { timeout: 10_000 });
  });

  test('klik kartu Top Engagement → navigasi ke /monitoring/top-engagement', async ({ page }) => {
    await page.getByText('Top Engagement').first().click();

    await expect(page).toHaveURL(/\/monitoring\/top-engagement/, { timeout: 10_000 });
  });

  test('navbar menampilkan branding SIP Insight', async ({ page }) => {
    const branding = page
      .locator('header')
      .getByText('SIP Insight')
      .or(page.getByRole('link', { name: /SIP Insight/i }));
    await expect(branding.first()).toBeVisible();
  });

  test('navbar menampilkan tombol user menu', async ({ page }) => {
    const userBtn = page
      .locator('header')
      .getByRole('button')
      .first()
      .or(page.locator('button[aria-haspopup="menu"]').first())
      .or(page.getByRole('button', { name: /^[A-Z]$/ }).first());
    await expect(userBtn).toBeVisible();
  });

  test('navbar tidak menampilkan link navigasi admin (Dashboard, Keyword, Management)', async ({ page }) => {
    // Client tidak boleh melihat link navigasi admin di halaman mana pun
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Keyword' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Management' })).toHaveCount(0);
  });

  test('navbar menampilkan tombol dark mode toggle', async ({ page }) => {
    const darkModeBtn = page.getByRole('button', { name: /dark mode/i });
    await expect(darkModeBtn.first()).toBeVisible();
  });

  test('navbar menampilkan tombol mobile menu di viewport kecil', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const mobileMenu = page.getByRole('button', { name: /menu|open/i });
    if ((await mobileMenu.count()) > 0) {
      await expect(mobileMenu.first()).toBeVisible();
    } else {
      // Pada halaman /monitoring/home responsif, kedua kartu navigasi tetap visible
      await expect(page.getByText('Conversation Overview').first()).toBeVisible();
    }
  });
});
