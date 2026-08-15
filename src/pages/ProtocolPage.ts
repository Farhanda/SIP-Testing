import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman Display Wall / Control Protocol
 * (/control/alert-protocol, /control/danger-protocol, /control/green-protocol).
 * Kontennya statis (simulasi wall display) → test deterministik tanpa mock.
 */
export class ProtocolPage extends BasePage {
  readonly activeProtocol = this.page.getByText('Active Protocol');
  readonly activeSince = this.page.getByText('Active since');
  readonly thresholdIndicator = this.page.getByText('Threshold indicator');

  async gotoAlert() {
    await this.page.goto('/control/alert-protocol');
  }

  async gotoDanger() {
    await this.page.goto('/control/danger-protocol');
  }

  async gotoGreen() {
    await this.page.goto('/control/green-protocol');
  }

  /** Assert heading utama wall (Alert / Danger / Green — Under Control). */
  async expectWallTitle(name: string) {
    await expect(this.page.getByRole('heading', { name, exact: true })).toBeVisible();
  }

  /**
   * Assert header umum wall ("Active Protocol"). Catatan: wall Green
   * tidak merender teks "Active since" — assert tersebut hanya dipakai
   * untuk wall Alert & Danger.
   */
  async expectProtocolHeaderVisible() {
    await expect(this.activeProtocol.first()).toBeVisible();
  }
}
