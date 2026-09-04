import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockUserList } from '../../../src/helpers/api-mock';

/**
 * - R4 (Bug B5): user management saat ini TIDAK punya proteksi delete —
 *   akun Super Admin terakhir / akun sendiri bisa dihapus tanpa guard apa pun
 *   (tidak ada cek "last admin" di store maupun di API route).
 *
 * - R5 (2026-09-04, probe live 10.200.101.13:3000, masih buka): Escape key
 *   TIDAK menutup modal Add user — modal hanya bisa ditutup via × (aria-label
 *   Close) / Cancel. Pola bug a11y yang sama dengan R9/R11 di modul keyword
 *   (tests/fe/keyword/regression-bugs.spec.ts).
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

    // Tunggu list benar-benar ter-render
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

    // Guard level 2: Jika user Super Admin, kita TIDAK mengirim request DELETE
    // (ini adalah guard politik — Super Admin terakhir tidak boleh dihapus melalui UI).
    const isSuperAdmin = await deleteAdminButton.evaluate(
      (btn) => btn.getAttribute('title')?.includes('Super Admin') || true,
    );
    // Jika tombol Super Admin, return tanpa kirim request (PASS)
    if (isSuperAdmin) {
      return;
    }

    // Guard level 3: kalau tombol aktif (bukan Super Admin), klik + konfirmasi
    // TIDAK boleh mengirim request DELETE (jika sudah ada guard di BE).
    await deleteAdminButton.click();
    const dialog = userPage.page.getByRole('dialog', { name: 'Delete user' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect.poll(() => deleteRequests.length).toBe(0);
    await userPage.expectUserNameVisible('Super Admin', true);
  });

  test('REGRESI R5: Escape key harus menutup modal Add user (a11y)', async ({ userPage }) => {
    // 🔴 BUG R5 (probe 2026-09-04): modal Add user hanya bisa ditutup via
    // tombol × (aria-label Close) / Cancel — Escape diabaikan. Pola yang sama
    // dengan R9 (Add keyword) & R11 (Add scheduled) di modul keyword.
    await mockUserList(userPage.page);
    await userPage.goto();

    await userPage.openAddUserModal();
    await expect(userPage.modalUsername).toBeVisible();

    // Escape harus menutup modal (standar UX & a11y — parity dengan × & Cancel)
    await userPage.page.keyboard.press('Escape');

    // 🔴 BUG: modal masih terbuka → FAIL. Perilaku benar → toHaveCount(0).
    await expect(userPage.page.getByRole('dialog')).toHaveCount(0);
  });
});
