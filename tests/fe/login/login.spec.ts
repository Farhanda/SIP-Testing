import { expect } from '../fixtures';
import { test } from '../fixtures';
import { Env } from '../../../src/config/env';

/**
 * Test Login (FR-10): aplikasi kini memakai AUTH ASLI.
 * - Kredensial valid → redirect ke /monitoring/dashboard.
 * - Kredensial salah → pesan "Invalid username or password", tetap di /login.
 * Kredensial valid diambil dari .env (UI_TEST_USERNAME / UI_TEST_PASSWORD).
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
});
