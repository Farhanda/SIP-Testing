import type { Page } from '@playwright/test';

/**
 * Base class untuk semua Page Object Model (POM).
 * Selector & aksi halaman dipusatkan di class ini dan turunannya —
 * spec tidak boleh berisi selector mentah (FR-05).
 */
export abstract class BasePage {
  constructor(public readonly page: Page) {}

  // ---- Elemen navbar global (ada di semua halaman ber-navbar) ----
  // Pakai getter supaya this.page sudah ter-assign saat locator dibuat.

  /** Tombol lonceng Notifications di navbar. */
  get notificationsButton() {
    return this.page.getByRole('button', { name: 'Notifications' });
  }

  /** Empty state panel Notifications. */
  get notificationsEmptyState() {
    return this.page.getByText('No notifications yet.');
  }

  /** Tombol user menu (avatar + nama user) di navbar. */
  get userMenuButton() {
    return this.page.getByRole('button', { name: /Admin SIP/ });
  }

  // Label "Profile2" sesuai teks aktual aplikasi (kemungkinan bug penamaan).
  get profileMenuItem() {
    return this.page.getByRole('button', { name: 'Profile2' });
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
