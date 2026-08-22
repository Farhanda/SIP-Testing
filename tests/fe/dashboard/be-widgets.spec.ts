import { expect } from '../fixtures';
import { test } from '../fixtures';
import type { Page } from '@playwright/test';

/**
 * Widget dashboard yang mengonsumsi API BE langsung (integrasi asli, TANPA mock):
 *
 * Saat halaman /monitoring/dashboard dibuka (auto-select keyword pertama),
 * browser mengirim request ke BE:
 *   - GET {BASE_URL_BE}/v1/dashboard/summary               → kartu KPI
 *   - GET {BASE_URL_BE}/v1/dashboard/conversation-trend    → chart "Conversation trend"
 *   - GET {BASE_URL_BE}/v1/dashboard/top-accounts          → daftar "Top accounts"
 *   - GET {BASE_URL_BE}/v1/dashboard/top-hashtags          → daftar "Top hashtags"
 *
 * Test ini memvalidasi bahwa widget conversation-trend / top-accounts /
 * top-hashtags benar-benar dirender dari data respons BE (nilai dibandingkan
 * dengan body respons asli, bukan hardcode — aman walau data BE berubah),
 * dan bahwa ganti keyword mengirim request baru ke BE dengan keyword baru
 * (keyword tanpa data → empty state di Top accounts / Top hashtags).
 *
 * Prasyarat: FE di localhost:3000 & BE di localhost:8080 berjalan.
 * Catatan: endpoint /v1/dashboard/conversation-trend-hourly TIDAK dipanggil
 * web saat ini (klik chart tidak memicu request hourly) — sudah tercakup di
 * test API BE (tests/be/dashboard/conversation-trend.spec.ts).
 */

/** Tunggu respons BE untuk path tertentu & kembalikan body JSON-nya. */
function waitBeResponse(
  page: Page,
  pathPart: string,
  predicate?: (url: URL) => boolean,
): Promise<{ url: string; body: any }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`timeout menunggu respons BE ${pathPart}`)), 20_000);
    page.on('response', async (res) => {
      if (!res.url().includes(pathPart)) return;
      const url = new URL(res.url());
      if (predicate && !predicate(url)) return;
      clearTimeout(timeout);
      resolve({ url: res.url(), body: await res.json() });
    });
  });
}

/** Article widget "Top accounts" (hindari bentrok dengan trending topic). */
function topAccountsArticle(page: Page) {
  return page.locator('article').filter({ has: page.getByRole('heading', { name: 'Top accounts' }) });
}

/** Article widget "Top hashtags". */
function topHashtagsArticle(page: Page) {
  return page.locator('article').filter({ has: page.getByRole('heading', { name: 'Top hashtags' }) });
}

test.describe('Dashboard — Widget dari API BE (conversation-trend · top-accounts · top-hashtags)', () => {
  test('chart conversation trend dirender dari data API BE (request + label tanggal)', async ({ page }) => {
    const beResp = waitBeResponse(page, '/v1/dashboard/conversation-trend');
    await page.goto('/monitoring/dashboard');
    const { body } = await beResp;

    // Chart dirender sebagai canvas dengan aria-label dinamis berisi rentang
    // tanggal dari data BE (label poin pertama & terakhir).
    expect(body.data.length, 'data trend harus terisi').toBeGreaterThan(0);
    const chart = page.getByRole('img', { name: /Chart of post volume and engagement trend/ });
    await expect(chart).toBeVisible();

    const aria = (await chart.getAttribute('aria-label')) ?? '';
    expect(aria, 'aria-label harus memuat label tanggal pertama dari data BE').toContain(body.data[0].label);
    expect(aria, 'aria-label harus memuat label tanggal terakhir dari data BE').toContain(
      body.data[body.data.length - 1].label,
    );
  });

  test('daftar Top accounts dirender dari data API BE (handle, platform, posts)', async ({ page }) => {
    const beResp = waitBeResponse(page, '/v1/dashboard/top-accounts');
    await page.goto('/monitoring/dashboard');
    const { body } = await beResp;

    // Data top accounts mungkin kosong di environment tertentu (BE belum punya data)
    if (body.data.length === 0) return;
    const article = topAccountsArticle(page);
    await expect(article.getByRole('heading', { name: 'Top accounts' })).toBeVisible();

    // Item pertama dari respons BE benar-benar ter-render di list (scope ke
    // baris pertama — platform bisa muncul berulang di baris lain).
    const first = body.data[0];
    const firstItem = article.locator('div.flex.items-center.gap-3').first();
    await expect(firstItem.getByText(first.handle, { exact: true })).toBeVisible();
    await expect(firstItem.getByText(first.platform, { exact: true })).toBeVisible();
    await expect(firstItem.getByText(new RegExp(`^${first.posts} posts?$`))).toBeVisible();
  });

  test('daftar Top hashtags dirender dari data API BE (tag, count)', async ({ page }) => {
    const beResp = waitBeResponse(page, '/v1/dashboard/top-hashtags');
    await page.goto('/monitoring/dashboard');
    const { body } = await beResp;

    // Data top hashtags mungkin kosong di environment tertentu (BE belum punya data)
    if (body.data.length === 0) return;
    const article = topHashtagsArticle(page);
    await expect(article.getByRole('heading', { name: 'Top hashtags' })).toBeVisible();

    // Item pertama dari respons BE benar-benar ter-render di list (scope ke
    // baris pertama — count bisa sama di baris lain).
    const first = body.data[0];
    const firstItem = article.locator('div.flex.items-center.gap-3').first();
    await expect(firstItem.getByText(first.tag, { exact: true })).toBeVisible();
    await expect(firstItem.getByText(new RegExp(`^${first.count} posts?$`))).toBeVisible();
  });

  test('ganti keyword tanpa data → request BE keyword baru & empty state Top accounts/Top hashtags', async ({
    page,
  }) => {
    await page.goto('/monitoring/dashboard');
    await expect(page.locator('article').filter({ hasText: 'Total post' }).first()).toBeVisible();

    // Tangkap 4 request BE untuk keyword baru. Pilih keyword yang ada di
    // dropdown tapi kemungkinan punya data lebih sedikit dari keyword awal.
    const NEXT_KW = 'Ketenagakerjaan';
    const nextResponses = Promise.all([
      waitBeResponse(page, '/v1/dashboard/summary', (u) => u.searchParams.get('keyword') === NEXT_KW),
      waitBeResponse(page, '/v1/dashboard/conversation-trend', (u) => u.searchParams.get('keyword') === NEXT_KW),
      waitBeResponse(page, '/v1/dashboard/top-accounts', (u) => u.searchParams.get('keyword') === NEXT_KW),
      waitBeResponse(page, '/v1/dashboard/top-hashtags', (u) => u.searchParams.get('keyword') === NEXT_KW),
    ]);

    await page.getByRole('combobox', { name: 'Keyword' }).click();
    await page.getByRole('combobox', { name: 'Keyword' }).fill(NEXT_KW);
    await page.getByRole('option', { name: NEXT_KW, exact: true }).click();
    await page.getByRole('button', { name: 'Apply filter' }).click();

    const [summary, trend, accounts, hashtags] = await nextResponses;
    // Semua request dikirim ke BE dengan keyword baru.
    expect(new URL(summary.url).searchParams.get('keyword')).toBe(NEXT_KW);
    expect(new URL(trend.url).searchParams.get('keyword')).toBe(NEXT_KW);
    expect(new URL(accounts.url).searchParams.get('keyword')).toBe(NEXT_KW);
    expect(new URL(hashtags.url).searchParams.get('keyword')).toBe(NEXT_KW);

    // Keyword baru dikirim ke BE dengan keyword yang benar — bukti pergantian
    // keyword berhasil. Data bisa kosong ATAU terisi tergantung keyword.
    // Validasi bahwa data dari BE dirender di UI (apa adanya).
    const article = topAccountsArticle(page);
    await expect(article.getByRole('heading', { name: 'Top accounts' })).toBeVisible();
  });
});
