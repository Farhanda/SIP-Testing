import { expect } from '../fixtures';
import { test } from '../fixtures';

/**
 * Test Login (FR-10, diadaptasi untuk aplikasi simulasi):
 * aplikasi SIP Insight belum memiliki auth API — form login memvalidasi
 * field kosong lalu menampilkan state "Processing…" (tidak redirect).
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

  test('submit dengan kredensial terisi menampilkan state Processing (simulasi)', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('admin', 'password123');

    // Tidak ada error validasi & button berubah menjadi "Processing…"
    await loginPage.expectNoValidationError();
    await loginPage.expectProcessingState();
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
