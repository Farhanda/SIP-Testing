import { expect } from './fixtures';
import { test } from './fixtures';
import { Env } from '../../../src/config/env';

/**
 * Test Login untuk client role.
 *
 * Client login harus redirect ke /monitoring/home (bukan /monitoring/dashboard).
 * Kredensial client dari .env (UI_CLIENT_USERNAME / UI_CLIENT_PASSWORD).
 */
test.describe('Client — Login', () => {
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

  test('submit dengan username/password salah menampilkan pesan error', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('client', 'password-salah-123');

    await loginPage.expectInvalidCredentials();
    await expect(loginPage.page).toHaveURL(/\/login/);
  });

  test('login dengan kredensial client → redirect ke /monitoring/home', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(Env.clientUsername, Env.clientPassword);

    // Client role: sukses login → /monitoring/home (bukan /monitoring/dashboard)
    await expect(loginPage.page).toHaveURL(/\/monitoring\/home/, { timeout: 20_000 });
  });

  test('login client menampilkan heading "Select a monitoring view"', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(Env.clientUsername, Env.clientPassword);

    await expect(loginPage.page).toHaveURL(/\/monitoring\/home/, { timeout: 20_000 });
    await expect(
      loginPage.page.getByRole('heading', { name: 'Select a monitoring view' })
    ).toBeVisible();
  });

  test('halaman login menampilkan panel branding SIP Insight', async ({ loginPage }) => {
    await loginPage.goto();

    await expect(loginPage.brandingPanel).toBeVisible();
  });

  test('checkbox Remember me aktif secara default dan dapat diubah', async ({ loginPage }) => {
    await loginPage.goto();

    await expect(loginPage.rememberMeCheckbox).toBeVisible();
    await expect(loginPage.rememberMeCheckbox).toBeChecked();

    await loginPage.rememberMeCheckbox.uncheck();
    await expect(loginPage.rememberMeCheckbox).not.toBeChecked();
    await loginPage.rememberMeCheckbox.check();
    await expect(loginPage.rememberMeCheckbox).toBeChecked();
  });
});
