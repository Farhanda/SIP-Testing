import { expect } from '../fixtures';
import { test } from '../fixtures';
import { Env } from '../../../src/config/env';

/**
 * A1 (Bug — FIXED): dulu submit login hanya simulasi (state "Processing…" tanpa
 * API & tanpa navigasi). Aplikasi kini memakai auth asli — login valid HARUS
 * mengarahkan user ke dashboard (/monitoring/dashboard).
 *
 * Test memakai kredensial nyata dari .env (UI_TEST_USERNAME / UI_TEST_PASSWORD)
 * dan memanggil auth API asli (tanpa mock) supaya alur login → dashboard
 * selalu terverifikasi end-to-end.
 */
test.describe('Regresi Bug — Login', () => {
  test('REGRESI A1: login dengan kredensial valid harus redirect ke dashboard', async ({ loginPage }) => {
    await loginPage.goto();

    await loginPage.login(Env.testUsername, Env.testPassword);

    // Perilaku yang benar (sudah aktif): sukses login → dashboard
    await expect(loginPage.page).toHaveURL(/\/monitoring\/dashboard/, {
      timeout: 20_000,
    });
  });
});
