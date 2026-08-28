import { test as setup } from '@playwright/test';
import { login, AUTH_STATE_PATH } from '../../src/helpers/auth';

/**
 * Setup auth platform FE — dependency semua project modul KECUALI `login`
 * (lihat playwright.fe.config.ts & playwright.config.ts).
 *
 * Aplikasi SIP Insight kini memakai auth asli: semua route selain /login dan
 * /display/* di-redirect ke /login bila belum terautentikasi. Setup ini login
 * sekali via UI (kredensial dari .env) lalu menyimpan storageState (cookies)
 * agar semua test modul lain reuse sesi tanpa login ulang per test.
 */
setup('login sebagai user test & simpan storage state', async ({ page }) => {
  await login(page);
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
