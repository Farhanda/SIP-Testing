import { expect } from '../fixtures';
import { test } from '../fixtures';
import { Env } from '../../../src/config/env';

/**
 * Test Login (FR-10): aplikasi kini memakai AUTH ASLI.
 * - Kredensial valid → redirect ke /monitoring/dashboard.
 * - Kredensial salah → pesan "Invalid username or password", tetap di /login.
 * Kredensial valid diambil dari .env (UI_TEST_USERNAME / UI_TEST_PASSWORD).
 *
 * + Eksplorasi live 2026-09-04 (http://10.200.101.13:3000) — alur sesi
 *   (lihat describe "Sesi — Logout & redirect param" di bawah):
 *   - Logout dari halaman dalam → kembali ke /login.
 *   - Buka halaman protected setelah logout → /login?redirect=%2F...%2F...
 *   - Login ulang → user dikembalikan ke path di param redirect (BUKAN
 *     selalu dashboard). Perilaku bagus & layak dijaga regresinya.
 *   - Notifications menampilkan empty state "No notifications yet."
 */
test.describe('Login', () => {
  test('form login menampilkan field username, password, dan tombol Log in', async ({ loginPage }) => {
    await loginPage.goto();

    await loginPage.expectHeading('Log in to your account');
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('submit dengan field kosong menampilkan pesan validasi', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.submit();

    await loginPage.expectValidationError();
  });

  test('submit dengan username/password salah menampilkan pesan error dan tidak redirect', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('admin', 'password-salah-123');

    // Auth asli: kredensial salah → pesan error tampil, tetap di /login
    await loginPage.expectInvalidCredentials();
    await expect(loginPage.page).toHaveURL(/\/login/);
  });

  test('login dengan kredensial valid (admin) → redirect ke dashboard', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(Env.testUsername, Env.testPassword);

    // Auth asli: sukses → pindah ke dashboard & heading tampil
    await expect(loginPage.page).toHaveURL(/\/monitoring\/dashboard/, { timeout: 20_000 });
    await expect(
      loginPage.page.getByRole('heading', { name: 'Dashboard Overview' })
    ).toBeVisible();
  });

  test('halaman login menampilkan panel branding SIP Insight', async ({ loginPage }) => {
    await loginPage.goto();

    await expect(loginPage.brandingPanel).toBeVisible();
  });

  test('checkbox Remember me aktif secara default dan dapat diubah', async ({ loginPage }) => {
    await loginPage.goto();

    // Default tercentang (perilaku aplikasi saat ini)
    await expect(loginPage.rememberMeCheckbox).toBeVisible();
    await expect(loginPage.rememberMeCheckbox).toBeChecked();

    // Dapat di-uncheck lalu dicentang kembali
    await loginPage.rememberMeCheckbox.uncheck();
    await expect(loginPage.rememberMeCheckbox).not.toBeChecked();
    await loginPage.rememberMeCheckbox.check();
    await expect(loginPage.rememberMeCheckbox).toBeChecked();
  });

  // ── Eksplorasi live 2026-09: alur sesi (logout & redirect param) ──────

  test.describe('Sesi — Logout & redirect param (Eksplorasi 2026-09)', () => {
    // Jalankan tanpa storageState: kita butuh sesi segar lalu logout di
    // dalam test. test.use di scope describe ini agar tidak memengaruhi
    // test login lain di file ini.
    test.use({ storageState: { cookies: [], origins: [] } });

    test('login → logout → login ulang menghormati param redirect (live)', async ({ page }) => {
      // 1) Login awal
      await page.goto('/login');
      await page.getByLabel('Username').fill(Env.testUsername);
      await page.getByLabel('Password').fill(Env.testPassword);
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page).toHaveURL(/\/monitoring\/dashboard/, { timeout: 20_000 });

      // 2) Buka halaman dalam lalu logout via menu user
      await page.goto('/monitoring/keyword');
      await page.getByRole('button', { name: /admin/i }).last().click();
      await page.getByRole('button', { name: 'Logout' }).click();
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

      // 3) Coba buka halaman protected → /login?redirect=/monitoring/keyword
      await page.goto('/monitoring/keyword');
      await expect(page).toHaveURL(/\/login\?redirect=%2Fmonitoring%2Fkeyword/, {
        timeout: 15_000,
      });

      // 4) Login ulang → dikembalikan ke path redirect (bukan dashboard)
      await page.getByLabel('Username').fill(Env.testUsername);
      await page.getByLabel('Password').fill(Env.testPassword);
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page).toHaveURL(/\/monitoring\/keyword$/, { timeout: 20_000 });
    });

    test('Notifications menampilkan empty state "No notifications yet." (live)', async ({ page }) => {
      // Login sendiri (sesi segar) supaya test mandiri
      await page.goto('/login');
      await page.getByLabel('Username').fill(Env.testUsername);
      await page.getByLabel('Password').fill(Env.testPassword);
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page).toHaveURL(/\/monitoring\/dashboard/, { timeout: 20_000 });

      await page.getByRole('button', { name: 'Notifications' }).click();
      await expect(page.getByText('No notifications yet.')).toBeVisible();
    });
  });
});
