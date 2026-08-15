import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Login (/login).
 *
 * Catatan: di aplikasi SIP Insight (simulasi), submit login TIDAK memanggil
 * API — hanya memvalidasi field kosong lalu menampilkan state "Processing…".
 * Test mengikuti perilaku nyata tersebut (FR-10 diadaptasi).
 */
export class LoginPage extends BasePage {
  readonly usernameInput = this.page.getByLabel('Username');
  readonly passwordInput = this.page.getByLabel('Password');
  readonly rememberMeCheckbox = this.page.getByRole('checkbox', { name: 'Remember me' });
  readonly submitButton = this.page.getByRole('button', { name: 'Log in' });
  readonly heading = this.page.getByRole('heading', { name: 'Log in to your account' });
  readonly validationError = this.page.getByText('Username and password are required.');
  readonly brandingPanel = this.page.getByText('Social Intelligence Platform');

  async goto() {
    await this.page.goto('/login');
  }

  async fillUsername(value: string) {
    await this.usernameInput.fill(value);
  }

  async fillPassword(value: string) {
    await this.passwordInput.fill(value);
  }

  async submit() {
    await this.submitButton.click();
  }

  /** Isi kredensial lalu klik Log in. */
  async login(username: string, password: string) {
    await this.fillUsername(username);
    await this.fillPassword(password);
    await this.submit();
  }

  /**
   * Button berubah menjadi "Processing…" selama ~900ms (simulasi).
   * Timeout sengaja dibatasi agar assertion tidak menunggu lebih lama
   * dari durasi state-nya (mencegah race window 900ms).
   */
  async expectProcessingState() {
    await expect(
      this.page.getByRole('button', { name: 'Processing…' })
    ).toBeVisible({ timeout: 2000 });
  }

  async expectValidationError() {
    await expect(this.validationError).toBeVisible();
  }

  async expectNoValidationError() {
    await expect(this.validationError).toHaveCount(0);
  }
}
