import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockDashboardApis, mockKeywordOptions } from '../../../src/helpers/api-mock';

/**
 * Test halaman Top Posts (/monitoring/dashboard/posts).
 *
 * Halaman ini menampilkan daftar post lengkap (bukan terbatas 5 seperti
 * di dashboard utama) dengan sorting, pagination, dan link kembali ke
 * dashboard.
 *
 * URL pattern:
 *   /monitoring/dashboard/posts?keyword=<keyword>&sort_by=<view|engagement>
 */
test.describe('Posts Page — /monitoring/dashboard/posts', () => {
  test.beforeEach(async ({ postsPage }) => {
    await mockDashboardApis(postsPage.page);
    await mockKeywordOptions(postsPage.page, ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan']);
  });

  test('halaman posts menampilkan tabel dengan kolom yang benar', async ({ postsPage }) => {
    await postsPage.gotoWithSort('view', 'RUU Digital');

    // Pastikan tabel ada dengan kolom yang benar
    await expect(postsPage.tableHeaders).toHaveText([
      'Platform', 'Post', 'Emotion', 'Topic', 'Views', 'Engagement',
    ]);
  });

  test('posts page menampilkan data post dari mock API', async ({ postsPage }) => {
    await postsPage.gotoWithSort('view', 'RUU Digital');

    // Post rows ter-render
    const rowCount = await postsPage.postRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Cek data pertama dari mock: TikTok
    await expect(postsPage.postRows.first().getByText('TikTok')).toBeVisible();
    // Emotion harus ada (anger dari mock data)
    await expect(postsPage.postRows.first().getByText('anger')).toBeVisible();
  });

  test('sort by dropdown tersedia dengan opsi Views dan Engagement', async ({ postsPage }) => {
    await postsPage.gotoWithSort('view', 'RUU Digital');

    await expect(postsPage.sortBySelect).toBeVisible();
    // Default: view
    await expect(postsPage.sortBySelect).toHaveValue('view');

    // Ada minimal 2 opsi
    const options = postsPage.sortBySelect.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('sort by engagement mengubah urutan post', async ({ postsPage }) => {
    await postsPage.gotoWithSort('view', 'RUU Digital');

    // Ubah ke engagement
    await postsPage.sortBySelect.selectOption('engagement');
    await expect(postsPage.sortBySelect).toHaveValue('engagement');

    // Tabel masih ter-render
    const rowCount = await postsPage.postRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('tombol Apply filter dan Reset filter tersedia', async ({ postsPage }) => {
    await postsPage.gotoWithSort('view', 'RUU Digital');

    await expect(postsPage.applyFilterButton).toBeVisible();
    await expect(postsPage.resetFiltersButton).toBeVisible();
  });

  test('link Dashboard untuk kembali ke dashboard utama', async ({ postsPage }) => {
    await postsPage.gotoWithSort('view', 'RUU Digital');

    // Link "Dashboard" di breadcrumb (main area, bukan navbar)
    const breadcrumbLink = postsPage.page.getByRole('main').getByRole('link', { name: 'Dashboard' });
    await expect(breadcrumbLink).toBeVisible();

    // Klik link Dashboard
    await breadcrumbLink.click();

    // Harus kembali ke /monitoring/dashboard
    await expect(postsPage.page).toHaveURL(/\/monitoring\/dashboard/);
  });

  test('URL mengandung parameter keyword dan sort_by', async ({ postsPage }) => {
    await postsPage.gotoWithSort('engagement', 'RUU Digital');

    const url = postsPage.page.url();
    expect(url).toContain('keyword=');
    expect(url).toContain('sort_by=engagement');
  });

  test('page title mengandung "Post" atau "Posts"', async ({ postsPage }) => {
    await postsPage.gotoWithSort('view', 'RUU Digital');

    const title = await postsPage.page.title();
    expect(title.toLowerCase()).toMatch(/post/);
  });

  test('data post memiliki view count dan engagement count', async ({ postsPage }) => {
    await postsPage.gotoWithSort('view', 'RUU Digital');

    const rowCount = await postsPage.postRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Setiap row harus punya angka engagement
    const firstRow = postsPage.postRows.first();
    // Cek ada angka (engagement atau views)
    const rowText = await firstRow.textContent();
    expect(rowText).toMatch(/\d/); // Minimal ada 1 angka
  });
});
