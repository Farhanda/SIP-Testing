import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * POM halaman User Management (/administration/user).
 * Filter (keyword/role/status), tabel user, pagination, dan modal
 * tambah/edit/reset password.
 */
export class UserManagementPage extends BasePage {
  readonly heading = this.page.getByRole('heading', { name: 'User Management' });
  readonly addUserButton = this.page.getByRole('button', { name: '+ Add user' });
  readonly filterSection = this.page.getByLabel('Filter users');
  readonly searchInput = this.page.getByLabel('Search users');
  readonly roleSelect = this.page.getByLabel('Role');
  readonly statusSelect = this.page.getByLabel('Status');
  readonly applyFilterButton = this.page.getByRole('button', { name: 'Apply filter' });
  readonly resetFilterButton = this.page.getByRole('button', { name: 'Reset filter' });
  readonly userListHeading = this.page.getByRole('heading', { name: 'User list' });
  readonly showingText = this.page.getByText(/Showing \d+-\d+ of \d+ users/);
  readonly emptyState = this.page.getByText('No users match your search.');

  // Field modal form user (dibuka lewat "+ Add user")
  readonly modalUsername = this.page.locator('#username');
  readonly modalName = this.page.locator('#name');
  readonly modalPassword = this.page.locator('#password');
  readonly modalRole = this.page.locator('#role');
  readonly modalStatus = this.page.locator('#status');
  readonly modalSaveButton = this.page.getByRole('dialog').getByRole('button', { name: 'Save' });

  // Pagination (aria-label dari aplikasi)
  readonly paginationPrev = this.page.getByRole('button', { name: 'Previous page' });
  readonly paginationNext = this.page.getByRole('button', { name: 'Next page' });

  // Modal Edit / Reset password / Delete user
  readonly editModal = this.page.getByRole('heading', { name: 'Edit user' });
  readonly resetPasswordModalHeading = this.page.getByRole('heading', { name: 'Reset password' });
  readonly resetPasswordInput = this.page.locator('#resetPassword');
  readonly resetConfirmPasswordInput = this.page.locator('#resetConfirmPassword');
  readonly deleteModalHeading = this.page.getByRole('heading', { name: 'Delete user' });

  async goto() {
    await this.page.goto('/administration/user');
  }

  async searchUser(keyword: string) {
    await this.searchInput.fill(keyword);
    await this.applyFilterButton.click();
  }

  async selectRole(value: string) {
    await this.roleSelect.selectOption(value);
    await this.applyFilterButton.click();
  }

  async selectStatus(value: string) {
    await this.statusSelect.selectOption(value);
    await this.applyFilterButton.click();
  }

  /** Baris tabel yang memuat user `name` (kolom nama). */
  rowOf(name: string) {
    return this.page.getByRole('row').filter({ hasText: name });
  }

  editUserButton(name: string) {
    return this.rowOf(name).getByRole('button', { name: `Edit user ${name}` });
  }

  resetPasswordButton(name: string) {
    return this.rowOf(name).getByRole('button', { name: `Reset password ${name}` });
  }

  deleteUserButton(name: string) {
    return this.rowOf(name).getByRole('button', { name: `Delete user ${name}` });
  }

  async openAddUserModal() {
    await this.addUserButton.click();
    await expect(this.modalUsername).toBeVisible();
  }

  async expectUserNameVisible(name: string, visible: boolean) {
    const cell = this.page.getByRole('cell').filter({ hasText: name });
    if (visible) {
      await expect(cell.first()).toBeVisible();
    } else {
      await expect(this.page.getByText(name, { exact: true })).toHaveCount(0);
    }
  }
}
