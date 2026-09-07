import type { Page } from '@playwright/test';
import { Env } from '../config/env';

/**
 * Base class untuk semua Page Object Model (POM).
 * Selector & aksi halaman dipusatkan di class ini dan turunannya —
 * spec tidak boleh berisi selector mentah (FR-05).
 */
export abstract class BasePage {
  constructor(public readonly page: Page) {}

  // ---- Elemen navbar global (ada di semua halaman ber-navbar) ----
  // Pakai getter supaya this.page sudah ter-assign saat locator dibuat.
  // Live 2026-09-07 (dev): navbar = link Dashboard + dropdown "Display Wall"
  // & "Management" + Notifications + dark-mode toggle + user menu (label
  // mengikuti nama user aktif, mis. "A admin"). Dropdown user hanya berisi
  // Logout (item Profile/Profile2 sudah tidak ada — akses /profile via URL).

  /** Tombol lonceng Notifications di navbar. */
  get notificationsButton() {
    return this.page.getByRole('button', { name: 'Notifications' });
  }

  /** Empty state panel Notifications. */
  get notificationsEmptyState() {
    return this.page.getByText('No notifications yet.');
  }

  /** Tombol user menu — label memuat nama user aktif (dari .env). */
  get userMenuButton() {
    return this.page
      .locator('header')
      .getByRole('button', { name: new RegExp(Env.testUsername, 'i') })
      .last();
  }

  get logoutMenuItem() {
    return this.page.getByRole('button', { name: 'Logout' });
  }

  /** Navigasi langsung ke path (relatif terhadap baseURL). */
  async goto(path: string) {
    await this.page.goto(path);
  }

  /** Navigasi & tunggu sampai heading `name` (level h1) terlihat. */
  async gotoAndExpectHeading(path: string, heading: string) {
    await this.goto(path);
    await this.expectHeading(heading);
  }

  /** Assert heading h1 dengan nama tertentu terlihat. */
  async expectHeading(name: string) {
    await this.page.getByRole('heading', { name, exact: true }).first().waitFor({ state: 'visible' });
  }
}
