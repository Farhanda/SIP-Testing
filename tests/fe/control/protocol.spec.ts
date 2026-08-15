import { expect } from '../fixtures';
import { test } from '../fixtures';

/**
 * Test Display Wall / Control Protocol (FR-12, FR-14):
 * ketiga wall (Alert, Danger, Green) bersifat statis → deterministik,
 * memverifikasi konten indikator & status aktif masing-masing wall.
 */
test.describe('Control Protocol Walls', () => {
  test('alert protocol wall menampilkan status aktif & indikator threshold', async ({ protocolPage }) => {
    await protocolPage.gotoAlert();

    await protocolPage.expectWallTitle('Alert');
    await protocolPage.expectProtocolHeaderVisible();
    await expect(protocolPage.activeSince).toBeVisible();
    await expect(protocolPage.thresholdIndicator).toBeVisible();
    await expect(protocolPage.page.getByText('Danger threshold at 60%')).toBeVisible();
  });

  test('danger protocol wall menampilkan status aktif', async ({ protocolPage }) => {
    await protocolPage.gotoDanger();

    await protocolPage.expectWallTitle('Danger');
    await protocolPage.expectProtocolHeaderVisible();
    await expect(protocolPage.activeSince).toBeVisible();
  });

  test('green protocol wall menampilkan status aktif', async ({ protocolPage }) => {
    await protocolPage.gotoGreen();

    await protocolPage.expectWallTitle('Green — Under Control');
    await protocolPage.expectProtocolHeaderVisible();
  });
});
