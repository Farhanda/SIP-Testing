import { expect } from '../fixtures';
import { test } from '../fixtures';
import { loadJsonData } from '../../../src/helpers/data';
import {
  mockCreateUser,
  mockResetUserPassword,
  mockUpdateUser,
  mockUserList,
  MockUserItem,
} from '../../../src/helpers/api-mock';

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

  test('filter status "Inactive" menampilkan user sesuai status', async ({ userPage }) => {
    await mockUserList(userPage.page);
    await userPage.goto();

    await userPage.selectStatus('Inactive');

    // Hanya Dewi Lestari yang Inactive di data mock
    await userPage.expectUserNameVisible('Dewi Lestari', true);
    await expect(userPage.page.getByText('Siti Rahma', { exact: true })).toHaveCount(0);
  });

  test('pagination next membuka halaman berikutnya', async ({ userPage }) => {
    // 12 user dengan size default 10 → halaman 2 berisi 2 user
    const items: MockUserItem[] = Array.from({ length: 12 }, (_, i) => ({
      id: `usr-pg-${String(i + 1).padStart(2, '0')}`,
      username: `user${i + 1}`,
      name: `Pagination User ${i + 1}`,
      role: 'Operator',
      status: 'Active',
    }));
    await mockUserList(userPage.page, items);
    await userPage.goto();

    await expect(userPage.showingText).toHaveText('Showing 1-10 of 12 users');
    await userPage.expectUserNameVisible('Pagination User 11', false);

    await userPage.paginationNext.click();

    await expect(userPage.showingText).toHaveText('Showing 11-12 of 12 users');
    await userPage.expectUserNameVisible('Pagination User 11', true);
    await userPage.expectUserNameVisible('Pagination User 12', true);
  });

  test('submit "+ Add user" kosong tidak mengirim request (modal tetap terbuka)', async ({ userPage }) => {
    const page = userPage.page;
    await mockUserList(page);
    await userPage.goto();

    const posts: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/admin/user')) posts.push(req.url());
    });

    await userPage.openAddUserModal();
    await userPage.modalSaveButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(() => posts.length).toBe(0);
  });

  test('submit "+ Add user" terisi mengirim POST & menutup modal', async ({ userPage }) => {
    const page = userPage.page;
    await mockUserList(page);
    await mockCreateUser(page, { succeed: true });
    await userPage.goto();

    const postBodies: Record<string, unknown>[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/admin/user')) {
        try {
          postBodies.push(JSON.parse(req.postData() ?? '{}'));
        } catch {
          postBodies.push({});
        }
      }
    });

    await userPage.openAddUserModal();
    await userPage.modalUsername.fill('qa.automation');
    await userPage.modalName.fill('QA Automation User');
    await userPage.modalPassword.fill('rahasia123');
    await userPage.modalSaveButton.click();

    // Request POST terkirim dengan body sesuai form
    await expect.poll(() => postBodies.length).toBeGreaterThan(0);
    expect(postBodies[0].username).toBe('qa.automation');
    expect(postBodies[0].name).toBe('QA Automation User');

    // Modal menutup setelah sukses
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('modal Edit user terbuka dengan data baris terisi', async ({ userPage }) => {
    await mockUserList(userPage.page);
    await userPage.goto();

    await userPage.editUserButton('Siti Rahma').click();

    await expect(userPage.editModal).toBeVisible();
    await expect(userPage.modalUsername).toHaveValue('siti.rahma');
    await expect(userPage.modalName).toHaveValue('Siti Rahma');

    // Tutup tanpa menyimpan
    await userPage.page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(userPage.editModal).not.toBeAttached();
  });

  test('modal Reset password menampilkan field password & konfirmasi', async ({ userPage }) => {
    await mockUserList(userPage.page);
    await userPage.goto();

    await userPage.resetPasswordButton('Siti Rahma').click();

    await expect(userPage.resetPasswordModalHeading).toBeVisible();
    await expect(userPage.resetPasswordInput).toBeVisible();
    await expect(userPage.resetConfirmPasswordInput).toBeVisible();

    await userPage.page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(userPage.resetPasswordModalHeading).not.toBeAttached();
  });

  test('modal Delete user menampilkan konfirmasi sebelum penghapusan', async ({ userPage }) => {
    const page = userPage.page;
    await mockUserList(page);
    await userPage.goto();

    const deletes: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'DELETE' && req.url().includes('/api/admin/user')) deletes.push(req.url());
    });

    await userPage.deleteUserButton('Siti Rahma').click();

    await expect(userPage.deleteModalHeading).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true })).toBeVisible();

    // Batal — tidak ada request DELETE keluar
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(userPage.deleteModalHeading).not.toBeAttached();
    expect(deletes.length).toBe(0);
  });

  test('submit Edit user mengirim PUT & menutup modal', async ({ userPage }) => {
    const page = userPage.page;
    await mockUserList(page);
    await mockUpdateUser(page, { succeed: true });
    await userPage.goto();

    const putBodies: Record<string, unknown>[] = [];
    page.on('request', (req) => {
      if ((req.method() === 'PUT' || req.method() === 'PATCH') && req.url().includes('/api/admin/user/')) {
        try {
          putBodies.push(JSON.parse(req.postData() ?? '{}'));
        } catch {
          putBodies.push({});
        }
      }
    });

    await userPage.editUserButton('Siti Rahma').click();
    await userPage.modalName.fill('Siti Rahma Edit');
    await userPage.modalSaveButton.click();

    await expect.poll(() => putBodies.length).toBeGreaterThan(0);
    expect(putBodies[0].username).toBe('siti.rahma');
    expect(putBodies[0].name).toBe('Siti Rahma Edit');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Reset password konfirmasi tidak cocok ditolak tanpa mengirim request', async ({ userPage }) => {
    const page = userPage.page;
    await mockUserList(page);
    await mockResetUserPassword(page, { succeed: true });
    await userPage.goto();

    const posts: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/reset-password')) posts.push(req.url());
    });

    await userPage.resetPasswordButton('Siti Rahma').click();
    await userPage.resetPasswordInput.fill('passwordBaru123');
    await userPage.resetConfirmPasswordInput.fill('beda123');
    await page.getByRole('dialog').getByRole('button', { name: 'Reset password' }).click();

    await expect(page.getByText('Password confirmation does not match')).toBeVisible();
    await userPage.expectHeading('User Management'); // halaman tetap
    await expect(page.getByRole('dialog')).toBeVisible(); // modal masih terbuka
    await expect.poll(() => posts.length).toBe(0);

    // Tutup modal
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  });

  test('submit Reset password valid mengirim POST & menampilkan toast sukses', async ({ userPage }) => {
    const page = userPage.page;
    await mockUserList(page);
    await mockResetUserPassword(page, { succeed: true });
    await userPage.goto();

    const postBodies: Record<string, unknown>[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/reset-password')) {
        try {
          postBodies.push(JSON.parse(req.postData() ?? '{}'));
        } catch {
          postBodies.push({});
        }
      }
    });

    await userPage.resetPasswordButton('Siti Rahma').click();
    await userPage.resetPasswordInput.fill('passwordBaru123');
    await userPage.resetConfirmPasswordInput.fill('passwordBaru123');
    await page.getByRole('dialog').getByRole('button', { name: 'Reset password' }).click();

    await expect.poll(() => postBodies.length).toBeGreaterThan(0);
    expect(postBodies[0].password).toBe('passwordBaru123');
    await expect(page.getByText('Password for user "siti.rahma" was reset successfully.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('gagal dari server saat Add user: toast error & modal tetap terbuka', async ({ userPage }) => {
    const page = userPage.page;
    await mockUserList(page);
    await mockCreateUser(page, { succeed: false });
    await userPage.goto();

    await userPage.openAddUserModal();
    await userPage.modalUsername.fill('qa.fail');
    await userPage.modalName.fill('QA Fail User');
    await userPage.modalPassword.fill('rahasia123');
    await userPage.modalSaveButton.click();

    await expect(page.getByText('Failed to add user.')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('pagination prev & nomor halaman berpindah antar halaman', async ({ userPage }) => {
    const items: MockUserItem[] = Array.from({ length: 12 }, (_, i) => ({
      id: `usr-pg-${String(i + 1).padStart(2, '0')}`,
      username: `user${i + 1}`,
      name: `Pagination User ${i + 1}`,
      role: 'Operator',
      status: 'Active',
    }));
    await mockUserList(userPage.page, items);
    await userPage.goto();

    // Halaman 2 lewat tombol next...
    await userPage.paginationNext.click();
    await expect(userPage.showingText).toHaveText('Showing 11-12 of 12 users');

    // ...kembali ke halaman 1 lewat prev...
    await userPage.paginationPrev.click();
    await expect(userPage.showingText).toHaveText('Showing 1-10 of 12 users');

    // ...dan lompat ke halaman 2 lewat nomor halaman
    await userPage.pageNumberButton(2).click();
    await expect(userPage.showingText).toHaveText('Showing 11-12 of 12 users');
  });
});
