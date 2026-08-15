import { expect } from '../fixtures';
import { test } from '../fixtures';
import { expectUrlPath } from '../../../src/helpers/ui-assert';

/**
 * Integrasi FE ↔ API BE (dashboard sudah mengkonsumsi BE):
 *
 * FE memanggil `GET {BASE_URL_BE}/v1/dashboard/summary?keyword=...` secara
 * langsung dari browser untuk kartu KPI (Total post, Total engagement,
 * Views, Engagement rate, Active platforms). Test ini memvalidasi bahwa:
 *
 * 1. Request KPI benar-benar dikirim ke BE (bukan mock).
 * 2. Nilai yang dirender di kartu KPI = nilai dari respons BE yang
 *    diterima halaman (bandingkan dengan body respons asli, sehingga
 *    tidak hardcode angka — aman walau data BE berubah).
 * 3. Ganti keyword → request baru ke BE & KPI ikut berubah.
 *
 * Tidak memakai mock API — ini test integrasi asli (tanpa determinisme
 * buatan). Prasyarat: FE di localhost:3000 & BE di localhost:8080.
 */

const BE_SUMMARY = '**/v1/dashboard/summary**';

/** Tunggu respons BE summary & kembalikan body JSON-nya. */
function waitBeSummary(page: import('@playwright/test').Page, predicate?: (url: URL) => boolean) {
  return new Promise<{ url: string; body: any }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout menunggu respons BE summary')), 20_000);
    page.on('response', async (res) => {
      if (!res.url().includes('/v1/dashboard/summary')) return;
      const url = new URL(res.url());
      if (predicate && !predicate(url)) return;
      clearTimeout(timeout);
      resolve({ url: res.url(), body: await res.json() });
    });
  });
}

test.describe('Dashboard — Integrasi API BE', () => {
  test('KPI dashboard dirender dari data API BE (Total post, Views, dst.)', async ({ page }) => {
    const beResp = waitBeSummary(page);
    await page.goto('/monitoring/dashboard');
    const { body } = await beResp;

    // Kartu KPI menampilkan nilai dari BE (label per metrik).
    await expect(page.locator('article').filter({ hasText: 'Total post' }).first()).toContainText(
      body.data.total_post.label,
    );
    await expect(page.locator('article').filter({ hasText: 'Total engagement' }).first()).toContainText(
      body.data.total_engagement.label,
    );
    await expect(page.locator('article').filter({ hasText: 'Views' }).first()).toContainText(body.data.views.label);
    await expect(page.locator('article').filter({ hasText: 'Engagement rate' }).first()).toContainText(
      body.data.engagement_rate.label,
    );
    await expect(page.locator('article').filter({ hasText: 'Active platforms' }).first()).toContainText(
      `${body.data.active_platforms.active} / ${body.data.active_platforms.total}`,
    );
  });

  test('request KPI dikirim ke BE dengan parameter keyword', async ({ page }) => {
    let seen: string | null = null;
    page.on('request', (req) => {
      if (req.url().includes('/v1/dashboard/summary')) seen = req.url();
    });

    await page.goto('/monitoring/dashboard');
    await expect(page.locator('article').filter({ hasText: 'Total post' }).first()).toBeVisible();

    expect(seen, 'harus ada request ke BE /v1/dashboard/summary').toBeTruthy();
    expect(seen!).toContain('http://localhost:8080');
    const url = new URL(seen!);
    // Auto-select keyword pertama → request membawa keyword (bukan tanpa filter).
    expect(url.searchParams.get('keyword')).toBeTruthy();
  });

  test('ganti keyword → request baru ke BE & kartu KPI ikut berubah', async ({ page }) => {
    // Tangkap request pertama (auto-select) + responsnya.
    await page.goto('/monitoring/dashboard');
    await expect(page.locator('article').filter({ hasText: 'Total post' }).first()).toBeVisible();

    // Ganti keyword lewat dropdown (pilih keyword yang TIDAK punya data di BE,
    // mis. "Layanan Publik" → layanan-publik → total_post = 0).
    const nextBeResp = waitBeSummary(page, (u) => u.searchParams.get('keyword') === 'layanan-publik');
    await page.getByPlaceholder('Search or select a keyword').click();
    await page.getByPlaceholder('Search or select a keyword').fill('Layanan Publik');
    await page.getByRole('option', { name: 'Layanan Publik', exact: true }).click();
    await page.getByRole('button', { name: 'Apply filter' }).click();

    const { body } = await nextBeResp;
    // KPI mengikuti respons BE keyword baru (label-nya).
    await expect(page.locator('article').filter({ hasText: 'Total post' }).first()).toContainText(
      body.data.total_post.label,
    );
    // Keyword tanpa data → total_post = 0 (bukti UI merender respons BE,
    // bukan data lama).
    expect(body.data.total_post.value).toBe(0);
  });

  test('halaman dashboard tetap di path /monitoring/dashboard setelah KPI BE dimuat', async ({ page }) => {
    await page.goto('/monitoring/dashboard');
    await expect(page.locator('article').filter({ hasText: 'Total post' }).first()).toBeVisible();
    await expectUrlPath(page, '/monitoring/dashboard');
  });
});
