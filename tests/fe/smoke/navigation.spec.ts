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

  // CATATAN SCOPE (2026-09-07): halaman Keyword Intelligence
  // (/monitoring/keyword-intelligence) & Control Protocol walls
  // (/control/*) DI LUAR LINGKUP testing — fitur belum digunakan produk &
  // tidak ada tombol/link navigasinya di UI (hanya bisa diakses via URL
  // langsung). Test-nya dihapus (tersedia di arsip git bila fitur dirilis).

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

  test('halaman home admin menampilkan 2 kartu monitoring view (live)', async ({ page }) => {
    // Live 2026-09-07 (dev): /monitoring/home bisa diakses admin (bukan
    // hanya client) — menampilkan 2 kartu navigasi ke monitoring view
    // versi admin (/monitoring/*, bukan /display/*).
    await page.goto('/monitoring/home');

    await expect(page.getByRole('heading', { name: 'Select a monitoring view' })).toBeVisible();
    const convLink = page.locator('a[href="/monitoring/conversation-overview"]').first();
    const topLink = page.locator('a[href="/monitoring/top-engagement"]').first();
    await expect(convLink).toBeVisible();
    await expect(topLink).toBeVisible();

    // Kartu Conversation Overview menavigasi ke view admin (bukan /display/)
    await convLink.click();
    await expectUrlPath(page, '/monitoring/conversation-overview');
  });

  // ── Eksplorasi live 2026-09: dropdown navbar Display Wall ─────────────

  test('dropdown Display Wall berisi link Conversation Overview & Top Engagement (live)', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const nav = page.locator('header');
    const displayWallBtn = nav.getByRole('button', { name: 'Display Wall' });
    await displayWallBtn.click();

    // dev: link berada di dalam wadah role="menu"; staging/prod: link langsung
    // di <nav> (tanpa wadah menu). Selector menerima keduanya, lalu cek keduanya
    // — tegas sesuai judul test (bukan optional-check).
    const menuScope = page.getByRole('menu').last().or(nav);
    await expect(
      menuScope.locator('a[href="/display/conversation-overview"]'),
    ).toBeVisible();
    await expect(
      menuScope.locator('a[href="/display/top-engagement"]'),
    ).toBeVisible();
  });
});
