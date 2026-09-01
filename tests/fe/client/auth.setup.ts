import { test as setup } from '@playwright/test';
import { loginAsClient, CLIENT_AUTH_STATE_PATH } from '../../../src/helpers/client-auth';

/**
 * Setup auth platform FE untuk client role — login sebagai client
 * (kredensial: client / signalsclient) lalu simpan storageState.
 *
 * Client role memiliki akses terbatas:
 * - /monitoring/home (home page)
 * - /display/top-engagement
 * - /display/conversation-overview
 * - Redirect ke /monitoring/home untuk semua halaman admin
 */
setup('login sebagai client & simpan storage state', async ({ page }) => {
  await loginAsClient(page);
  await page.context().storageState({ path: CLIENT_AUTH_STATE_PATH });
});
