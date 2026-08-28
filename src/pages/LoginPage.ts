import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Login (/login).
 *
 * Aplikasi kini memakai AUTH ASLI: submit kredensial valid → redirect ke
 * /monitoring/dashboard; kredensial salah → pesan "Invalid username or
 * password" dan tetap di /login.
 */
export class LoginPage extends BasePage {
  readonly usernameInput = this.page.getByLabel('Username');
  readonly passwordInput = this.page.getByLabel('Password');
  readonly rememberMeCheckbox = this.page.getByRole('checkbox', { name: 'Remember me' });
  readonly submitButton = this.page.getByRole('button', { name: 'Log in' });
  readonly heading = this.page.getByRole('heading', { name: 'Log in to your account' });
  readonly validationError = this.page.getByText('Username and password are required.');
  readonly invalidCredentialsError = this.page.getByText('Invalid username or password');
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

  /** Pesan error untuk kredensial yang salah (auth asli). */
  async expectInvalidCredentials() {
    await expect(this.invalidCredentialsError).toBeVisible();
  }

  async expectValidationError() {
    await expect(this.validationError).toBeVisible();
  }

  async expectNoValidationError() {
    await expect(this.validationError).toHaveCount(0);
  }
}
