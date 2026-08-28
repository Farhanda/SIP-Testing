import { type Page } from '@playwright/test';
import { Env } from '../config/env';

/**
 * Lokasi file storageState sesi login platform FE.
 * Ditulis oleh tests/fe/auth.setup.ts dan dipakai semua project modul
 * (kecuali `login`) via config `use.storageState`.
 */
export const AUTH_STATE_PATH = '.auth/fe-state.json';

/**
 * Login via UI halaman /login lalu tunggu redirect ke dashboard.
 *
 * Aplikasi SIP Insight kini memakai auth asli: submit kredensial valid
 * mengarahkan user ke /monitoring/dashboard. Kredensial default diambil
 * dari .env (UI_TEST_USERNAME / UI_TEST_PASSWORD) — jangan hardcode di spec.
 */
export async function login(
  page: Page,
  username: string = Env.testUsername,
  password: string = Env.testPassword,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/monitoring/dashboard', { timeout: 20_000 });
}
