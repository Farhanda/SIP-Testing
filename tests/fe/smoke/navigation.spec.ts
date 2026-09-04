import { expect } from '../fixtures';
import { test } from '../fixtures';
import { expectUrlPath } from '../../../src/helpers/ui-assert';

/**
 * Smoke test (M1 PRD): halaman-halaman utama terbuka & navigasi berfungsi.
 * Berjalan dengan API simulasi ASLI (tanpa mock) — assertion dibatasi pada
 * elemen yang stabil (heading, navbar, struktur) sehingga tidak flaky
 * walaupun API punya random failure.
 *
 * + Eksplorasi live 2026-09-04 (http://10.200.101.13:3000): dropdown navbar
 *   "Display Wall" berisi 2 link ke /display/* (Conversation Overview &
 *   Top Engagement).
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
    // User aktif: label tombol user menu berubah-ubah antar deploy
    // ('Admin SIP', 'AS Admin SIP', kini 'A admin'). Assert tombolnya
    // (yang memuat 'admin') & identitas user visible, bukan teks spesifik.
    await expect(navbar.getByRole('button', { name: /admin/i }).last()).toBeVisible();
  });

  test('halaman Keyword Intelligence dapat diakses', async ({ page }) => {
    // Link 'Keyword Intelligence' tidak lagi ada di navbar utama/dropdown
    // (Management kini berisi Providers & Keywords) — navigasi langsung via URL.
    await page.goto('/monitoring/keyword-intelligence');

    await expectUrlPath(page, '/monitoring/keyword-intelligence');
    await expect(page.getByRole('heading', { name: 'Keyword Intelligence', exact: true })).toBeVisible();
  });

  test('tab On Demand & Scheduled ada di halaman keyword (On Demand default)', async ({ page }) => {
    await page.goto('/monitoring/keyword');

    // UI deploy 2026-09: DUA tab — "On Demand" (default terpilih) & "Scheduled"
    const tabOnDemand = page.getByRole('tab', { name: 'On Demand' });
    const tabScheduled = page.getByRole('tab', { name: 'Scheduled' });
    await expect(tabOnDemand).toBeVisible();
    await expect(tabOnDemand).toHaveAttribute('aria-selected', 'true');
    await expect(tabScheduled).toBeVisible();

    // Pindah ke Scheduled → tab aktif berubah
    await tabScheduled.click();
    await expect(tabScheduled).toHaveAttribute('aria-selected', 'true');
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
    // Main content berisi informasi identitas user aktif
    await expect(page.locator('main').getByText(/admin/i).first()).toBeVisible();
  });

  test('halaman user management dapat diakses', async ({ page }) => {
    await page.goto('/administration/user');

    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add user' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'User list' })).toBeVisible();
  });

  // ── Eksplorasi live 2026-09: dropdown navbar Display Wall ─────────────

  test('dropdown Display Wall berisi link Conversation Overview & Top Engagement (live)', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('header').getByRole('button', { name: 'Display Wall' }).click();

    const menu = page.getByRole('menu').last();
    await expect(menu.locator('a[href="/display/conversation-overview"]')).toBeVisible();
    await expect(menu.locator('a[href="/display/top-engagement"]')).toBeVisible();
  });
});
