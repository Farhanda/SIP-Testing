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
    const header = page.locator('header');
    await expect(header.getByText('SIP Insight')).toBeVisible();
  });

  test('navbar menampilkan tombol user menu', async ({ page }) => {
    const header = page.locator('header');
    // Client user menu menampilkan inisial nama user — tunggu tombol benar-benar
    // ter-render (header di-render setelah auth/hydration selesai)
    await expect(header.getByRole('button').first()).toBeVisible();
  });

  test('navbar tidak menampilkan link navigasi admin (Dashboard, Keyword, Management)', async ({ page }) => {
    const header = page.locator('header');
    const nav = header.locator('nav');

    // Client navbar kosong — tidak ada link navigasi.
    // ⚠️ Pakai expect Auto-Waiting (bukan count() sekali) agar kebal race
    // saat header masih transisi dari auth/redirect.
    await expect(nav.getByRole('link')).toHaveCount(0);
  });

  test('navbar menampilkan tombol dark mode toggle', async ({ page }) => {
    const header = page.locator('header');
    await expect(header.getByRole('button', { name: /dark mode/i })).toBeVisible();
  });

  test('navbar menampilkan tombol mobile menu di viewport kecil', async ({ page }) => {
    // Tombol "Open menu" hanya visible di viewport < 1051px
    await page.setViewportSize({ width: 375, height: 812 });
    const header = page.locator('header');
    await expect(header.getByRole('button', { name: 'Open menu' })).toBeVisible();
  });
});
