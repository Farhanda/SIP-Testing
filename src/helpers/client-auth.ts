import { type Page } from '@playwright/test';
import { Env } from '../config/env';

/**
 * Lokasi file storageState sesi login client platform FE.
 * Ditulis oleh tests/fe/client/auth.setup.ts dan dipakai semua project
 * client modul via config `use.storageState`.
 */
export const CLIENT_AUTH_STATE_PATH = '.auth/fe-client-state.json';

/**
 * Login via UI sebagai client (role terbatas) lalu tunggu redirect ke /monitoring/home.
 *
 * Client role hanya bisa mengakses:
 * - /monitoring/home (home page dengan 2 kartu navigasi)
 * - /display/top-engagement
 * - /display/conversation-overview
 *
 * Semua halaman lain (dashboard, keyword, control, profile, administration)
 * akan di-redirect ke /monitoring/home.
 */
export async function loginAsClient(
  page: Page,
  username: string = Env.clientUsername,
  password: string = Env.clientPassword,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/monitoring/home', { timeout: 20_000 });
}
