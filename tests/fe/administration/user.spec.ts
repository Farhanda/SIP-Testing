import { expect } from '../fixtures';
import { test } from '../fixtures';
import { loadJsonData } from '../../../src/helpers/data';
import { mockUserList } from '../../../src/helpers/api-mock';

/**
 * Test User Management (FR-12, FR-13, FR-14, FR-20):
 * daftar user di-mock (deterministik) — filter diuji end-to-end UI → API,
 * modal form diverifikasi terbuka, dan empty state saat pencarian kosong.
 */
test.describe('User Management', () => {
  test('halaman user management menampilkan daftar, filter, dan info pagination', async ({ userPage }) => {
    await mockUserList(userPage.page);
    await userPage.goto();

    await userPage.expectHeading('User Management');
    await expect(userPage.addUserButton).toBeVisible();
    await expect(userPage.filterSection).toBeVisible();
    await expect(userPage.userListHeading).toBeVisible();

    // Info pagination (meta dari respons API)
    await expect(userPage.showingText).toHaveText(/Showing 1-\d+ of \d+ users/);

    // Kolom tabel
    for (const header of ['User', 'Role', 'Status']) {
      await expect(userPage.page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }

    // Data mock ter-render
    await userPage.expectUserNameVisible('Siti Rahma', true);
  });

  test('tombol "+ Add user" membuka modal form user', async ({ userPage }) => {
    await mockUserList(userPage.page);
    await userPage.goto();

    await userPage.openAddUserModal();

    // Field form modal tampil
    await expect(userPage.modalName).toBeVisible();
    await expect(userPage.modalPassword).toBeVisible();
    await expect(userPage.modalRole).toBeVisible();
  });

  // Data-driven (FR-20): filter role diuji per data test-data/user-filters.json
  const roleFilters = loadJsonData<
    { role: string; visibleName: string; hiddenName: string }[]
  >('user-filters.json');
  for (const data of roleFilters) {
    test(`filter role "${data.role}" menampilkan user sesuai role`, async ({ userPage }) => {
      await mockUserList(userPage.page);
      await userPage.goto();

      await userPage.selectRole(data.role);

      await userPage.expectUserNameVisible(data.visibleName, true);
      await expect(userPage.page.getByText(data.hiddenName, { exact: true })).toHaveCount(0);
    });
  }

  test('pencarian tanpa hasil menampilkan empty state', async ({ userPage }) => {
    await mockUserList(userPage.page);
    await userPage.goto();

    await userPage.searchUser('zzz-tidak-ada');

    await expect(userPage.emptyState).toBeVisible();
  });
});
