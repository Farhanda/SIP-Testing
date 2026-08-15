import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockChangePassword } from '../../../src/helpers/api-mock';

/**
 * Test Profile (FR-12, FR-14): identitas user aktif (simulasi) beserta
 * modal "Change password" (form + validasi zod).
 */
test.describe('Profile', () => {
  test('halaman profile menampilkan identitas, role, dan status user', async ({ profilePage }) => {
    await profilePage.goto();

    await profilePage.expectHeading('Profile');
    await expect(profilePage.nameText).toBeVisible();
    await expect(profilePage.usernameText).toBeVisible();
    await expect(profilePage.roleTag).toBeVisible();
    await expect(profilePage.statusTag).toBeVisible();
    await expect(profilePage.changePasswordButton).toBeVisible();
  });

  test('modal Change password dapat dibuka', async ({ profilePage }) => {
    await profilePage.goto();

    await profilePage.openChangePasswordModal();

    await expect(profilePage.modalNewPassword).toBeVisible();
    await expect(profilePage.modalConfirmNewPassword).toBeVisible();
  });

  test('validasi form Change password: kosong, < 6 karakter, dan konfirmasi tidak cocok', async ({ profilePage }) => {
    await mockChangePassword(profilePage.page, { succeed: true });
    await profilePage.goto();
    await profilePage.openChangePasswordModal();

    // 1. Submit semua kosong → current password wajib
    await profilePage.modalSaveButton.click();
    await profilePage.expectModalValidationError('Current password is required');

    // 2. New password < 6 karakter → ditolak (validasi client)
    await profilePage.modalCurrentPassword.fill('123456');
    await profilePage.modalNewPassword.fill('12345');
    await profilePage.modalConfirmNewPassword.fill('12345');
    await profilePage.modalSaveButton.click();
    await profilePage.expectModalValidationError('Password must be at least 6 characters');

    // 3. Konfirmasi tidak cocok dengan password baru
    await profilePage.modalNewPassword.fill('abcdef');
    await profilePage.modalConfirmNewPassword.fill('abcdefg');
    await profilePage.modalSaveButton.click();
    await profilePage.expectModalValidationError('Password confirmation does not match');

    // 4. Submit valid → toast sukses & modal tertutup
    await profilePage.modalConfirmNewPassword.fill('abcdef');
    await profilePage.modalSaveButton.click();
    await expect(
      profilePage.page.getByText('Password changed successfully.', { exact: true })
    ).toBeVisible();
    await expect(profilePage.modalCurrentPassword).toHaveCount(0);
  });
});
