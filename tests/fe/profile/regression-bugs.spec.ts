import { expect } from '../fixtures';
import { test } from '../fixtures';
import { Env } from '../../../src/config/env';

/**
 * C7 (Bug, terkonfirmasi probe 2026-08-12): API /api/profile/change-password
 * TIDAK memverifikasi kebenaran current password — handler hanya menolak bila
 * `!currentPassword` (kosong), tidak pernah membandingkan dengan password asli
 * akun. Probe live: submit dengan current password SALAH → toast
 * "Password changed successfully." & modal tertutup.
 *
 * Test meng-encode perilaku yang BENAR: ganti password dengan current password
 * yang salah HARUS ditolak (modal tetap terbuka, tanpa toast sukses).
 * → FAIL sekarang, PASS setelah API memverifikasi current password.
 *
 * ⚠️ Sengaja TANPA mock API: bug-nya ada di server, mock akan menghilangkannya.
 * Konsekuensi: failRate 10% dari API asli bisa membalas 500 (→ toast error,
 * modal tetap terbuka = PASS kebetulan) — flake ~10% yang diterima.
 */
test.describe('Regresi Bug — Change Password', () => {
  test('REGRESI C7: change password dengan current password salah harus DITOLAK', async ({ profilePage }) => {
    // 1) Verifikasi SERVER langsung — deterministik. Bug C7: server membalas 200
    //    (tidak memverifikasi current password). Diulang 3x karena failRate 10%
    //    bisa membalas 500 secara acak → probabilitas PASS palsu turun ke ~0.1%.
    for (let i = 0; i < 3; i++) {
      const res = await profilePage.page.request.post('/api/profile/change-password', {
        data: { currentPassword: 'salahpassword', newPassword: 'abcdef' },
      });
      expect(res.status()).not.toBe(200);
    }

    // 2) Alur UI end-to-end: submit lewat modal → server harus menolak.
    //    waitForResponse supaya assert tidak false-pass sebelum server membalas
    //    (latensi 400–900ms).
    const changePwResponse = profilePage.page.waitForResponse(
      (res) =>
        res.url().includes('/api/profile/change-password') &&
        res.request().method() === 'POST'
    );

    await profilePage.goto();
    await profilePage.openChangePasswordModal();

    await profilePage.modalCurrentPassword.fill('salahpassword');
    await profilePage.modalNewPassword.fill('abcdef');
    await profilePage.modalConfirmNewPassword.fill('abcdef');
    await profilePage.modalSaveButton.click();

    const response = await changePwResponse;
    expect(response.status()).not.toBe(200);

    // Perilaku benar: modal tetap terbuka & tanpa toast sukses.
    await expect(profilePage.modalCurrentPassword).toBeVisible();
    await expect(
      profilePage.page.getByText('Password changed successfully.', { exact: true })
    ).toHaveCount(0);
  });
});

/**
 * P05 (Positive, pasangan C7): ganti password dengan current password yang
 * BENAR harus SUKSES — server membalas 200, toast "Password changed
 * successfully.", modal tertutup. Memakai API asli (tanpa mock) supaya setelah
 * fix C7 memverifikasi current password, alur sukses tetap terbukti bekerja.
 *
 * "Current password benar" = Env.adminCurrentPassword (dari .env
 * UI_ADMIN_CURRENT_PASSWORD — seed akun admin; jangan hardcode di spec).
 * ⚠️ failRate 10% API asli bisa membalas 500 secara acak → tiap percobaan
 * (verifikasi server + UI flow) di-retry maks 3x; probabilitas gagal palsu
 * turun ke 0.1³ = ~0.1%.
 */
test.describe('Change Password — API asli (pasangan C7)', () => {
  test('change password dengan current password BENAR → toast sukses & modal tertutup', async ({ profilePage }) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      // 1) Verifikasi SERVER langsung: password benar harus 200.
      const res = await profilePage.page.request.post('/api/profile/change-password', {
        data: { currentPassword: Env.adminCurrentPassword, newPassword: 'abcdef' },
      });
      if (res.status() === 500) continue; // failRate acak — ulangi percobaan
      expect(res.status()).toBe(200); // non-500 non-200 → regresi fix, gagal jelas di sini

      // 2) Alur UI end-to-end.
      await profilePage.goto();
      await profilePage.openChangePasswordModal();

      await profilePage.modalCurrentPassword.fill(Env.adminCurrentPassword);
      await profilePage.modalNewPassword.fill('abcdef');
      await profilePage.modalConfirmNewPassword.fill('abcdef');

      const changePwResponse = profilePage.page.waitForResponse(
        (res) =>
          res.url().includes('/api/profile/change-password') &&
          res.request().method() === 'POST'
      );
      await profilePage.modalSaveButton.click();
      const response = await changePwResponse;

      if (response.status() === 500) continue; // failRate acak — ulangi percobaan

      // Perilaku benar: 200, toast sukses, modal tertutup.
      expect(response.status()).toBe(200);
      await expect(
        profilePage.page.getByText('Password changed successfully.', { exact: true })
      ).toBeVisible();
      await expect(profilePage.modalCurrentPassword).toHaveCount(0);
      return;
    }

    throw new Error('Server membalas 500 acak 3x berturut-turut (failRate 10% API asli)');
  });
});
