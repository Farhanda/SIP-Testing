import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Profile (/profile).
 * Menampilkan identitas user aktif (simulasi: Admin SIP / Super Admin),
 * beserta modal "Change password".
 */
export class ProfilePage extends BasePage {
  readonly heading = this.page.getByRole('heading', { name: 'Profile' });
  // Scope ke <main> karena identitas user juga ada di navbar.
  readonly main = this.page.locator('main');
  // Nama tampil sebagai avatar inisial + username (mis. "A admin"); identitas
  // kredibel lewat username "admin" & role.
  readonly nameText = this.main.getByText(/admin/i).first();
  readonly usernameText = this.main.getByText('@admin');
  readonly roleTag = this.main.getByText('Super Admin', { exact: true });
  readonly statusTag = this.main.getByText('Active', { exact: true });
  readonly changePasswordButton = this.page.getByRole('button', { name: 'Change password' });

  readonly modalCurrentPassword = this.page.locator('#currentPassword');
  readonly modalNewPassword = this.page.locator('#newPassword');
  readonly modalConfirmNewPassword = this.page.locator('#confirmNewPassword');
  readonly modalSaveButton = this.page.getByRole('button', { name: 'Save', exact: true });

  async goto() {
    await this.page.goto('/profile');
  }

  async openChangePasswordModal() {
    await this.changePasswordButton.click();
    await expect(this.modalCurrentPassword).toBeVisible();
  }

  /**
   * Assert pesan validasi zod tampil. .first(): pesan "Password must be at
   * least 6 characters" bisa muncul 2x (new & confirm keduanya pendek).
   */
  async expectModalValidationError(text: string) {
    await expect(this.page.getByText(text, { exact: true }).first()).toBeVisible();
  }
}
