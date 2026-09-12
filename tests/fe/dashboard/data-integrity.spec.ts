import { expect } from '../fixtures';
import { test } from '../fixtures';
import type { Response } from '@playwright/test';

/**
 * Helper untuk menunggu response JSON dari endpoint dashboard tertentu.
 */
function waitDashboardResponse<T = any>(page: any, endpointName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timeout menunggu response /v1/dashboard/${endpointName}`)),
      25_000,
    );
    page.on('response', async (res: Response) => {
      if (res.url().includes(`/v1/dashboard/${endpointName}`)) {
        try {
          const json = await res.json();
          clearTimeout(timeout);
          resolve(json);
        } catch {
          // Abaikan bila bukan JSON valid
        }
      }
    });
  });
}

/**
 * Test Suite: Dashboard Data Integrity & Cross-Component Validation (Live Dev Server)
 *
 * Menguji bahwa seluruh metrik numerik yang ditampilkan di dashboard memiliki
 * konsistensi matematis yang valid lintas komponen:
 * 1. Angka Total Post di KPI Summary == total post di tabel posts (top-posts-list)
 * 2. Akumulasi volume & engagement harian Conversation Trend == Total Post & Total Engagement di Summary
 * 3. Drill-down Conversation Trend ke modal per jam == akumulasi 24 jam tepat sama dengan data harian
 * 4. Drill-down Sentiment Trend ke modal per jam membuka modal 24 jam dengan proporsi sentimen
 * 5. Kalkulasi formula Engagement Rate == (Total Engagement / Views) * 100%
 * 6. Invarian pengurutan Top Performers (Top Posts, Top Accounts, Top Hashtags) terurut descending
 */
test.describe('Dashboard — Data Integrity & Cross-Validation (Live)', () => {
  test('total post di summary cocok dengan total data di halaman posts (top-posts-list) (live)', async ({
    dashboardPage,
  }) => {
    const page = dashboardPage.page;
    const summaryPromise = waitDashboardResponse(page, 'summary');
    const topPostsPromise = waitDashboardResponse(page, 'top-posts');

    await dashboardPage.goto();
    const summaryJson = await summaryPromise;
    const topPostsJson = await topPostsPromise;

    const expectedTotalPosts = summaryJson.data.total_post.value;
    expect(expectedTotalPosts, 'Total post di summary harus berupa angka positif').toBeGreaterThan(0);

    // Kartu KPI Total post merender angka yang cocok
    await expect(dashboardPage.totalPostCard).toContainText(String(summaryJson.data.total_post.label));

    // Navigasi ke halaman detail posts (/monitoring/dashboard/posts) via View all → (membuka tab popup baru)
    const popupPromise = page.waitForEvent('popup');
    await dashboardPage.viewAllButton.click();
    const popup = await popupPromise;

    const postsListRes = await popup.waitForResponse(
      (res) => res.url().includes('/v1/dashboard/top-posts-list'),
      { timeout: 25_000 },
    );
    const postsListJson = await postsListRes.json();
    expect(postsListJson.meta.total, 'Total post di top-posts-list API harus sama persis dengan summary').toBe(
      expectedTotalPosts,
    );

    // Verifikasi teks pagination di UI tab baru: "Showing 1-10 of {total} posts"
    const paginationText = popup.locator('p, span').filter({ hasText: new RegExp(`Showing\\s+\\d+-\\d+\\s+of\\s+${expectedTotalPosts}\\s+posts`, 'i') });
    await expect(paginationText.first()).toBeVisible({ timeout: 15_000 });

    // Baris pertama post di dashboard (jika ada) harus sama dengan baris pertama di halaman posts
    if (topPostsJson.data?.length > 0 && postsListJson.data?.posts?.length > 0) {
      const top1Dashboard = topPostsJson.data[0];
      const top1PostsPage = postsListJson.data.posts[0];
      expect(top1PostsPage.views, 'Views post ranking #1 harus konsisten').toBe(top1Dashboard.views);
    }

    await popup.close();
  });

  test('akumulasi harian volume dan engagement di conversation trend cocok dengan KPI summary (live)', async ({
    dashboardPage,
  }) => {
    const page = dashboardPage.page;
    const summaryPromise = waitDashboardResponse(page, 'summary');
    const trendPromise = waitDashboardResponse(page, 'conversation-trend');

    await dashboardPage.goto();
    const summaryJson = await summaryPromise;
    const trendJson = await trendPromise;

    const summaryTotalPosts = summaryJson.data.total_post.value;
    const summaryTotalEngagement = summaryJson.data.total_engagement.value;

    const trendPoints = trendJson.data;
    expect(Array.isArray(trendPoints), 'Data conversation trend harus berupa array').toBe(true);
    expect(trendPoints.length, 'Data conversation trend tidak boleh kosong').toBeGreaterThan(0);

    // Hitung jumlah volume dan engagement harian
    const sumDailyVolume = trendPoints.reduce((acc: number, p: any) => acc + (p.volume || 0), 0);
    const sumDailyEngagement = trendPoints.reduce((acc: number, p: any) => acc + (p.engagement || 0), 0);

    // Integritas matematis: Total Post == Jumlah Seluruh Volume Harian
    expect(
      sumDailyVolume,
      `Akumulasi volume harian (${sumDailyVolume}) harus sama persis dengan summary total_post (${summaryTotalPosts})`,
    ).toBe(summaryTotalPosts);

    // Integritas matematis: Total Engagement == Jumlah Seluruh Engagement Harian
    expect(
      sumDailyEngagement,
      `Akumulasi engagement harian (${sumDailyEngagement}) harus sama persis dengan summary total_engagement (${summaryTotalEngagement})`,
    ).toBe(summaryTotalEngagement);
  });

  test('drill-down conversation trend ke modal hourly memicu request dan total 24 jam cocok dengan data harian (live)', async ({
    dashboardPage,
  }) => {
    const page = dashboardPage.page;
    const trendPromise = waitDashboardResponse(page, 'conversation-trend');

    await dashboardPage.goto();
    const trendJson = await trendPromise;

    const trendPoints = trendJson.data;
    // Cari titik tanggal yang memiliki data volume > 0 agar breakdown jam terisi
    const targetIdx = trendPoints.findIndex((p: any) => (p.volume || 0) > 0);
    expect(targetIdx, 'Harus ada minimal satu tanggal dengan volume > 0').toBeGreaterThanOrEqual(0);

    const targetDay = trendPoints[targetIdx];

    // Siapkan listener response untuk request hourly
    const hourlyPromise = waitDashboardResponse(page, 'conversation-trend-hourly');

    // Buka modal drill-down hourly melalui POM
    await dashboardPage.openConversationTrendHourly(targetIdx);
    const hourlyJson = await hourlyPromise;

    // 1. Verifikasi modal tampil
    await expect(dashboardPage.trendModal).toBeVisible({ timeout: 10_000 });
    await expect(dashboardPage.trendModalHeading).toContainText(/conversation trend detail/i);

    // 2. Verifikasi struktur data respons per jam (tepat 24 jam)
    const hourlyPoints = hourlyJson.data;
    expect(hourlyPoints, 'Data hourly harus memiliki 24 titik jam').toHaveLength(24);

    // 3. Verifikasi integritas akumulasi: sum(24 jam) == volume & engagement hari tersebut
    const sumHourlyVolume = hourlyPoints.reduce((acc: number, p: any) => acc + (p.volume || 0), 0);
    const sumHourlyEngagement = hourlyPoints.reduce((acc: number, p: any) => acc + (p.engagement || 0), 0);

    expect(
      sumHourlyVolume,
      `Total volume 24 jam (${sumHourlyVolume}) harus sama persis dengan volume harian (${targetDay.volume}) pada tanggal ${targetDay.date}`,
    ).toBe(targetDay.volume);

    expect(
      sumHourlyEngagement,
      `Total engagement 24 jam (${sumHourlyEngagement}) harus sama persis dengan engagement harian (${targetDay.engagement}) pada tanggal ${targetDay.date}`,
    ).toBe(targetDay.engagement);

    // 4. Tutup modal dan pastikan bersih kembali
    await dashboardPage.closeTrendModal();
  });

  test('drill-down sentiment trend ke modal hourly memicu request dan membuka detail 24 jam (live)', async ({
    dashboardPage,
  }) => {
    const page = dashboardPage.page;
    const sentimentTrendPromise = waitDashboardResponse(page, 'sentiment-trend');

    await dashboardPage.goto();
    const sentimentJson = await sentimentTrendPromise;
    expect(sentimentJson.data?.length, 'Data sentiment trend harus terisi').toBeGreaterThan(0);

    // Siapkan listener response untuk request sentiment hourly
    const hourlyPromise = waitDashboardResponse(page, 'sentiment-trend-hourly');

    // Buka modal drill-down sentiment hourly pada titik pertama
    await dashboardPage.openSentimentTrendHourly(0);
    const hourlyJson = await hourlyPromise;

    // Verifikasi modal tampil dengan heading yang sesuai
    await expect(dashboardPage.trendModal).toBeVisible({ timeout: 10_000 });
    await expect(dashboardPage.trendModalHeading).toContainText(/sentiment trend detail/i);

    // Verifikasi legend proporsi sentimen dalam modal
    await expect(dashboardPage.trendModal.getByText('Positive', { exact: true })).toBeVisible();
    await expect(dashboardPage.trendModal.getByText('Neutral', { exact: true })).toBeVisible();
    await expect(dashboardPage.trendModal.getByText('Negative', { exact: true })).toBeVisible();

    // Verifikasi data respons hourly
    expect(hourlyJson.data, 'Data sentiment hourly harus berupa array titik jam').toBeTruthy();

    // Tutup modal
    await dashboardPage.closeTrendModal();
  });

  test('formula kalkulasi engagement rate pada summary konsisten dengan total engagement dibagi views (live)', async ({
    dashboardPage,
  }) => {
    const page = dashboardPage.page;
    const summaryPromise = waitDashboardResponse(page, 'summary');

    await dashboardPage.goto();
    const summaryJson = await summaryPromise;

    const totalEngagement = summaryJson.data.total_engagement.value;
    const views = summaryJson.data.views.value;
    const reportedRate = summaryJson.data.engagement_rate.value;

    expect(views, 'Views harus lebih besar dari 0').toBeGreaterThan(0);

    // Formula matematis: Engagement Rate = (Total Engagement / Views) * 100%
    const calculatedRate = (totalEngagement / views) * 100;

    // Toleransi deviasi pembulatan 2 desimal (<= 0.05%)
    expect(
      Math.abs(reportedRate - calculatedRate),
      `Engagement rate (${reportedRate}%) harus konsisten dengan (Total Engagement / Views) * 100 (${calculatedRate.toFixed(2)}%)`,
    ).toBeLessThanOrEqual(0.05);

    // Verifikasi nilai teks pada kartu KPI Engagement rate di UI
    await expect(dashboardPage.engagementRateCard).toContainText(`${reportedRate}%`);
  });

  test('urutan data pada top posts, top accounts, dan top hashtags konsisten menurun (descending) (live)', async ({
    dashboardPage,
  }) => {
    const page = dashboardPage.page;
    const topPostsPromise = waitDashboardResponse(page, 'top-posts');
    const topAccountsPromise = waitDashboardResponse(page, 'top-accounts');
    const topHashtagsPromise = waitDashboardResponse(page, 'top-hashtags');

    await dashboardPage.goto();
    const [topPostsJson, topAccountsJson, topHashtagsJson] = await Promise.all([
      topPostsPromise,
      topAccountsPromise,
      topHashtagsPromise,
    ]);

    // 1. Validasi Top Posts: Terurut menurun berdasarkan views
    const posts = topPostsJson.data ?? [];
    if (posts.length > 1) {
      for (let i = 1; i < posts.length; i++) {
        expect(
          posts[i].views,
          `Top post index ${i} views (${posts[i].views}) harus <= index ${i - 1} views (${posts[i - 1].views})`,
        ).toBeLessThanOrEqual(posts[i - 1].views);
      }
    }

    // 2. Validasi Top Accounts: Terurut menurun berdasarkan posts
    const accounts = topAccountsJson.data ?? [];
    if (accounts.length > 1) {
      for (let i = 1; i < accounts.length; i++) {
        expect(
          accounts[i].posts,
          `Top account index ${i} posts (${accounts[i].posts}) harus <= index ${i - 1} posts (${accounts[i - 1].posts})`,
        ).toBeLessThanOrEqual(accounts[i - 1].posts);
      }
    }

    // 3. Validasi Top Hashtags: Terurut menurun berdasarkan count
    const hashtags = topHashtagsJson.data ?? [];
    if (hashtags.length > 1) {
      for (let i = 1; i < hashtags.length; i++) {
        expect(
          hashtags[i].count,
          `Top hashtag index ${i} count (${hashtags[i].count}) harus <= index ${i - 1} count (${hashtags[i - 1].count})`,
        ).toBeLessThanOrEqual(hashtags[i - 1].count);
      }
    }
  });
});
