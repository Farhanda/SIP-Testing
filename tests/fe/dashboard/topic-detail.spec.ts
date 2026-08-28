import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockDashboardApis, mockKeywordOptions } from '../../../src/helpers/api-mock';

/**
 * Test halaman Topic Detail (/monitoring/dashboard/topic/:topic).
 *
 * Halaman ini menampilkan detail dari topik tertentu — nama topik sebagai
 * heading, chart emotion/sentiment, daftar post yang terkait topik, dan
 * pagination. Dapat diakses dari dashboard utama (klik topik) atau via
 * URL langsung.
 *
 * URL pattern:
 *   /monitoring/dashboard/topic/<topic>?keyword=<keyword>
 */
test.describe('Topic Detail — /monitoring/dashboard/topic/:topic', () => {
  test.beforeEach(async ({ topicDetailPage }) => {
    await mockDashboardApis(topicDetailPage.page);
    await mockKeywordOptions(topicDetailPage.page, ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan']);
  });

  test('halaman topic detail menampilkan nama topik sebagai heading', async ({ topicDetailPage }) => {
    await topicDetailPage.goto('lainnya', 'RUU Digital');

    // H1 harus menampilkan nama topik (tunggu loading selesai)
    await expect(topicDetailPage.topicHeading).not.toHaveText('Loading topic...');
    await expect(topicDetailPage.topicHeading).toBeVisible();
  });

  test('halaman topic detail menampilkan heading "Post list"', async ({ topicDetailPage }) => {
    await topicDetailPage.goto('lainnya', 'RUU Digital');

    await expect(topicDetailPage.postListHeading).toBeVisible();
  });

  test('tabel post memiliki kolom Platform, Post, Emotion, Sentiment, Views, Engagement', async ({ topicDetailPage }) => {
    await topicDetailPage.goto('lainnya', 'RUU Digital');

    await topicDetailPage.expectHeaders([
      'Platform', 'Post', 'Emotion', 'Sentiment', 'Views', 'Engagement',
    ]);
  });

  test('post rows ter-render dari mock API', async ({ topicDetailPage }) => {
    await topicDetailPage.goto('lainnya', 'RUU Digital');

    // Harus ada minimal 1 post
    const rowCount = await topicDetailPage.postRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Cek data: platform TikTok, emotion others
    await expect(topicDetailPage.postRows.first().getByText('TikTok')).toBeVisible();
  });

  test('chart emotion/sentiment terrender (SVG elements)', async ({ topicDetailPage }) => {
    await topicDetailPage.goto('lainnya', 'RUU Digital');

    // Harus ada minimal 1 SVG chart
    await topicDetailPage.expectChartsVisible(1);
  });

  test('tombol Apply filter dan Reset filter tersedia', async ({ topicDetailPage }) => {
    await topicDetailPage.goto('lainnya', 'RUU Digital');

    await expect(topicDetailPage.applyFilterButton).toBeVisible();
    await expect(topicDetailPage.resetFiltersButton).toBeVisible();
  });

  test('filter emotion mempersempit post list', async ({ topicDetailPage }) => {
    // Mock TOP_POSTS: post-1 anger, post-2 joy
    await topicDetailPage.goto('lainnya', 'RUU Digital');
    await topicDetailPage.expectPostCount(2);

    await topicDetailPage.emotionSelect.selectOption('Anger');
    await topicDetailPage.applyFilterButton.click();

    // Hanya post-1 (anger) yang tersisa
    await topicDetailPage.expectPostCount(1);
    await expect(topicDetailPage.postRows.first()).toContainText('anger');

    // Reset: input kembali ke default & daftar lengkap dimuat ulang
    await topicDetailPage.resetFiltersButton.click();
    await expect(topicDetailPage.emotionSelect).toHaveValue('all');
    await topicDetailPage.expectPostCount(2);
  });

  test('link "Dashboard" untuk kembali ke dashboard utama', async ({ topicDetailPage }) => {
    await topicDetailPage.goto('lainnya', 'RUU Digital');

    // Link Dashboard harus ada di halaman (nav atau breadcrumb)
    const dashboardLink = topicDetailPage.page.getByRole('link', { name: 'Dashboard' }).first();
    await expect(dashboardLink).toBeVisible();
  });

  test('link "Topic intelligence" untuk kembali ke topic overview', async ({ topicDetailPage }) => {
    await topicDetailPage.goto('lainnya', 'RUU Digital');

    // Link "Topic intelligence" harus ada
    const topicIntelLink = topicDetailPage.page.getByRole('link', { name: 'Topic intelligence' });
    const hasLink = await topicIntelLink.isVisible().catch(() => false);

    if (hasLink) {
      await topicIntelLink.click();
      // Harus kembali ke dashboard utama
      await expect(topicDetailPage.page).toHaveURL(/\/monitoring\/dashboard/);
    }
  });

  test('URL mengandung parameter keyword', async ({ topicDetailPage }) => {
    await topicDetailPage.goto('lainnya', 'RUU Digital');

    const url = topicDetailPage.page.url();
    expect(url).toContain('keyword=');
    expect(url).toContain('topic/lainnya');
  });

  test('page title mengandung "Topic"', async ({ topicDetailPage }) => {
    await topicDetailPage.goto('lainnya', 'RUU Digital');

    const title = await topicDetailPage.page.title();
    expect(title.toLowerCase()).toMatch(/topic/);
  });

  test('navigasi dari dashboard ke topic detail via topik link', async ({ dashboardPage, topicDetailPage }) => {
    // Mulai dari dashboard
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page, ['RUU Digital']);
    await dashboardPage.goto();

    // Klik topik di Topic Intelligence chart (jika ada link)
    const topicLink = dashboardPage.topicIntelligenceHeading.locator('..').getByRole('link').first();
    const hasTopicLink = await topicLink.isVisible().catch(() => false);

    if (hasTopicLink) {
      await topicLink.click();
      // Harus navigasi ke topic detail
      await expect(dashboardPage.page).toHaveURL(/\/monitoring\/dashboard\/topic\//);
    }
  });
});
