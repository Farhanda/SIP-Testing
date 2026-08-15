import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockUserList } from '../../../src/helpers/api-mock';

/**
 * R4 (Bug B5): user management saat ini TIDAK punya proteksi delete —
 * akun Super Admin terakhir / akun sendiri bisa dihapus tanpa guard apa pun
 * (tidak ada cek "last admin" di store maupun di API route).
 *
 * Test meng-encode perilaku yang BENAR: menghapus Super Admin (satu-satunya
 * admin di data mock) harus diblokir. Guard bisa berupa:
 *   1) tombol Delete admin disabled / tidak tersedia → PASS langsung, atau
 *   2) klik + konfirmasi TIDAK mengirim request DELETE & user tetap tampil.
 * → FAIL sekarang (request DELETE terkirim), PASS setelah guard ditambahkan.
 */
test.describe('Regresi Bug — Delete User', () => {
  test('REGRESI R4: user Super Admin tidak dapat dihapus (guard delete)', async ({ userPage }) => {
    await mockUserList(userPage.page);
    await userPage.goto();

    const deleteRequests: string[] = [];
    userPage.page.on('request', (req) => {
      if (req.method() === 'DELETE' && req.url().includes('/api/admin/user/')) {
        deleteRequests.push(req.url());
      }
    });

    // Tunggu list benar-benar ter-render (bukan hanya halaman selesai navigasi),
    // supaya pengecekan tombol di bawah tidak false-positive saat loading.
    await expect(userPage.userListHeading).toBeVisible();
    await expect(userPage.showingText).toBeVisible();

    const deleteAdminButton = userPage.page.getByRole('button', {
      name: 'Delete user Super Admin',
    });

    // Guard level 1: tombol delete admin disabled atau tidak tersedia.
    if (!(await deleteAdminButton.isVisible().catch(() => false))) {
      return;
    }
    if (await deleteAdminButton.isDisabled().catch(() => false)) {
      return;
    }

    // Guard level 2: kalau tombol aktif, klik + konfirmasi TIDAK boleh
    // mengirim request DELETE (Bug B5: saat ini terkirim → poll ini FAIL).
    await deleteAdminButton.click();
    const dialog = userPage.page.getByRole('dialog', { name: 'Delete user' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect.poll(() => deleteRequests.length).toBe(0);
    await userPage.expectUserNameVisible('Super Admin', true);
  });
});
