import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockAuthLogin } from '../../../src/helpers/api-mock';

/**
 * A1 (Bug): submit login di aplikasi saat ini TIDAK redirect — handleSubmit
 * hanya memvalidasi field kosong, menampilkan state "Processing…" selama
 * 900ms, lalu kembali normal (tanpa memanggil API auth & tanpa navigasi).
 *
 * Test meng-encode perilaku yang BENAR: login dengan kredensial valid HARUS
 * mengarahkan user ke dashboard (/monitoring/dashboard).
 * → FAIL sekarang (URL tetap /login), PASS setelah alur login disambungkan.
 */
test.describe('Regresi Bug — Login', () => {
  test('REGRESI A1: login dengan kredensial valid harus redirect ke dashboard', async ({ loginPage }) => {
    // Jaring pengaman: kalau fix memanggil API auth, mock ini memastikan sukses
    // (tidak bergantung pada API asli yang belum ada).
    await mockAuthLogin(loginPage.page, { succeed: true });
    await loginPage.goto();

    await loginPage.login('admin', 'password123');

    // Bug A1: saat ini tidak ada redirect → waitForURL timeout → FAIL.
    await expect(loginPage.page).toHaveURL(/\/monitoring\/dashboard/, {
      timeout: 15_000,
    });
  });
});
